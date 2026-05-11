-- Phase 1 Notifications Center hardening.
-- Safe/idempotent: creates missing join-request support objects, adds indexes,
-- and moves join-request approval/rejection into one authenticated RPC.

CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email text,
  status text NOT NULL DEFAULT 'pending',
  message text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_join_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_team_join_requests_pending
  ON public.team_join_requests (team_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_join_requests_team_status_created
  ON public.team_join_requests (team_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_join_requests_user_created
  ON public.team_join_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_join_request_lookup
  ON public.notifications (user_id, type, ((data->>'request_id')))
  WHERE type IN (
    'team_join_request_created',
    'team_join_request_approved',
    'team_join_request_rejected'
  );

ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'team_join_requests'
      AND policyname = 'TeamJoinRequests: requesters can create own pending'
  ) THEN
    CREATE POLICY "TeamJoinRequests: requesters can create own pending"
    ON public.team_join_requests FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'pending');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'team_join_requests'
      AND policyname = 'TeamJoinRequests: requesters and admins can read'
  ) THEN
    CREATE POLICY "TeamJoinRequests: requesters and admins can read"
    ON public.team_join_requests FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.teams t
        WHERE t.id = team_join_requests.team_id
          AND t.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = team_join_requests.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_team_join_request_created(_request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  req record;
  team_name text;
  requester_label text;
  requester_profile text;
  inserted_count int := 0;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id, team_id, user_id, requester_email, status
    INTO req
  FROM public.team_join_requests
  WHERE id = _request_id;

  IF req IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.user_id <> uid THEN RAISE EXCEPTION 'not your request'; END IF;
  IF req.status <> 'pending' THEN RETURN 0; END IF;

  SELECT name INTO team_name FROM public.teams WHERE id = req.team_id;
  SELECT display_name INTO requester_profile FROM public.profiles WHERE id = req.user_id;
  requester_label := COALESCE(requester_profile, req.requester_email, 'משתמש');

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    tm.user_id,
    'team_join_request_created',
    'בקשת הצטרפות חדשה',
    requester_label || ' ביקש להצטרף לקבוצת ' || COALESCE(team_name, ''),
    jsonb_build_object(
      'team_id', req.team_id,
      'team_name', team_name,
      'request_id', req.id,
      'requester_user_id', req.user_id,
      'requester_label', requester_label
    )
  FROM public.team_members tm
  WHERE tm.team_id = req.team_id
    AND tm.role IN ('owner', 'admin')
    AND tm.user_id <> req.user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = tm.user_id
        AND n.type = 'team_join_request_created'
        AND n.data->>'request_id' = req.id::text
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_team_join_request(
  _request_id uuid,
  _approved boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  req record;
  team_name text;
  next_status text;
  notification_type text;
  notification_title text;
  notification_body text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id, team_id, user_id, status
    INTO req
  FROM public.team_join_requests
  WHERE id = _request_id;

  IF req IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = req.team_id AND t.owner_id = uid
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = req.team_id
        AND tm.user_id = uid
        AND tm.role IN ('owner', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'not a team admin';
  END IF;

  IF req.status <> 'pending' THEN
    RETURN false;
  END IF;

  SELECT name INTO team_name FROM public.teams WHERE id = req.team_id;

  IF _approved THEN
    INSERT INTO public.team_members (team_id, user_id, role, member_mode)
    VALUES (req.team_id, req.user_id, 'member', 'unset')
    ON CONFLICT DO NOTHING;

    next_status := 'approved';
    notification_type := 'team_join_request_approved';
    notification_title := 'הצטרפת לקבוצה';
    notification_body := 'אושרת והצטרפת לקבוצת ' || COALESCE(team_name, '');
  ELSE
    next_status := 'rejected';
    notification_type := 'team_join_request_rejected';
    notification_title := 'בקשת ההצטרפות נדחתה';
    notification_body := 'בקשתך להצטרף לקבוצת ' || COALESCE(team_name, '') || ' נדחתה';
  END IF;

  UPDATE public.team_join_requests
  SET status = next_status,
      reviewed_by = uid,
      reviewed_at = now()
  WHERE id = req.id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    req.user_id,
    notification_type,
    notification_title,
    notification_body,
    jsonb_build_object('team_id', req.team_id, 'team_name', team_name, 'request_id', req.id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = req.user_id
      AND n.type = notification_type
      AND n.data->>'request_id' = req.id::text
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_team_join_request_decision(
  _request_id uuid,
  _approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.review_team_join_request(_request_id, _approved);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_team_join_request(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.review_team_join_request(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_team_join_request_created(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_team_join_request_decision(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.notify_team_join_request_created(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_team_join_request_decision(uuid, boolean) TO authenticated;

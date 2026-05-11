
-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;

-- Dedup index for team_evening_started: at most one per (user, evening)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_evening_started
  ON public.notifications (user_id, ((data->>'evening_id')))
  WHERE type = 'team_evening_started';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications: users read own" ON public.notifications;
CREATE POLICY "Notifications: users read own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications: users update own" ON public.notifications;
CREATE POLICY "Notifications: users update own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications: no direct inserts" ON public.notifications;
CREATE POLICY "Notifications: no direct inserts"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Notifications: no direct deletes" ON public.notifications;
CREATE POLICY "Notifications: no direct deletes"
  ON public.notifications FOR DELETE TO authenticated
  USING (false);

-- =========== RPC: join request created -> notify team admins ===========
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
    AND tm.role IN ('owner','admin')
    AND tm.user_id <> req.user_id;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- =========== RPC: join request decided -> notify requester ===========
CREATE OR REPLACE FUNCTION public.notify_team_join_request_decision(_request_id uuid, _approved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  req record;
  team_name text;
  is_admin boolean;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id, team_id, user_id INTO req
  FROM public.team_join_requests WHERE id = _request_id;
  IF req IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;

  -- Caller must be team owner or admin
  is_admin := EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = req.team_id AND t.owner_id = uid
  ) OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = req.team_id AND tm.user_id = uid AND tm.role IN ('owner','admin')
  );
  IF NOT is_admin THEN RAISE EXCEPTION 'not a team admin'; END IF;

  SELECT name INTO team_name FROM public.teams WHERE id = req.team_id;

  IF _approved THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      req.user_id,
      'team_join_request_approved',
      'הצטרפת לקבוצה',
      'אושרת והצטרפת לקבוצת ' || COALESCE(team_name, ''),
      jsonb_build_object('team_id', req.team_id, 'team_name', team_name, 'request_id', req.id)
    );
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      req.user_id,
      'team_join_request_rejected',
      'בקשת ההצטרפות נדחתה',
      'בקשתך להצטרף לקבוצת ' || COALESCE(team_name, '') || ' נדחתה',
      jsonb_build_object('team_id', req.team_id, 'team_name', team_name, 'request_id', req.id)
    );
  END IF;
END;
$$;

-- =========== RPC: tournament started -> notify team members ===========
CREATE OR REPLACE FUNCTION public.notify_team_evening_started(
  _evening_id text,
  _team_id uuid,
  _tournament_mode text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  team_name text;
  inserted_count int := 0;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Caller must be a member of the team
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _team_id AND tm.user_id = uid
  ) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  SELECT name INTO team_name FROM public.teams WHERE id = _team_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    tm.user_id,
    'team_evening_started',
    'טורניר חדש התחיל',
    'קבוצת ' || COALESCE(team_name, '') || ' התחילה ' || COALESCE(_tournament_mode, 'טורניר'),
    jsonb_build_object(
      'team_id', _team_id,
      'team_name', team_name,
      'evening_id', _evening_id,
      'tournament_mode', _tournament_mode
    )
  FROM public.team_members tm
  WHERE tm.team_id = _team_id
    AND tm.user_id <> uid
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

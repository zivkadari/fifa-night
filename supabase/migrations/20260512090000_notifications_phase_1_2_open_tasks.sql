-- Phase 1.2 Notifications Center: open-task notification sync and dismissal.
-- Safe/idempotent. Adds dismissal metadata and authenticated RPCs only.

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_user_active_created
  ON public.notifications (user_id, dismissed_at, created_at DESC);

-- Keep one active identity-required notification per user/team before adding
-- the partial unique index. Older duplicates are dismissed, not deleted.
WITH duplicate_identity_notifications AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, data->>'team_id'
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.notifications
  WHERE type = 'team_identity_required'
    AND dismissed_at IS NULL
    AND data ? 'team_id'
)
UPDATE public.notifications n
SET dismissed_at = now(),
    read_at = COALESCE(n.read_at, now())
FROM duplicate_identity_notifications d
WHERE n.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_identity_required_active
  ON public.notifications (user_id, ((data->>'team_id')))
  WHERE type = 'team_identity_required'
    AND dismissed_at IS NULL
    AND data ? 'team_id';

-- Keep direct writes blocked. Notification state changes go through RPCs.
DROP POLICY IF EXISTS "Notifications: users update own" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: no direct updates" ON public.notifications;
CREATE POLICY "Notifications: no direct updates"
  ON public.notifications FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Notifications: no direct inserts" ON public.notifications;
CREATE POLICY "Notifications: no direct inserts"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Notifications: no direct deletes" ON public.notifications;
CREATE POLICY "Notifications: no direct deletes"
  ON public.notifications FOR DELETE TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.sync_identity_required_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  changed_count int := 0;
  inserted_count int := 0;
  dismissed_count int := 0;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  WITH missing_identity AS (
    SELECT tm.team_id, t.name AS team_name
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = uid
      AND COALESCE(tm.member_mode, 'unset') = 'unset'
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_accounts pa
        JOIN public.team_players tp
          ON tp.team_id = tm.team_id
         AND tp.player_id = pa.player_id
        WHERE pa.user_id = uid
          AND pa.team_id = tm.team_id
      )
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, data, dismissed_at)
    SELECT
      uid,
      'team_identity_required',
      'בחר זהות בקבוצה',
      'אתה חבר בקבוצת ' || COALESCE(team_name, '') || ', אבל עדיין לא בחרת אם אתה שחקן או צופה.',
      jsonb_build_object('team_id', team_id, 'team_name', team_name),
      NULL::timestamptz
    FROM missing_identity
    ON CONFLICT (user_id, ((data->>'team_id')))
      WHERE type = 'team_identity_required'
        AND dismissed_at IS NULL
        AND data ? 'team_id'
      DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;

  WITH resolved_identity AS (
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = uid
      AND NOT (
        COALESCE(tm.member_mode, 'unset') = 'unset'
        AND NOT EXISTS (
          SELECT 1
          FROM public.player_accounts pa
          JOIN public.team_players tp
            ON tp.team_id = tm.team_id
           AND tp.player_id = pa.player_id
          WHERE pa.user_id = uid
            AND pa.team_id = tm.team_id
        )
      )
  ),
  dismissed AS (
    UPDATE public.notifications n
    SET dismissed_at = now(),
        read_at = COALESCE(n.read_at, now())
    FROM resolved_identity r
    WHERE n.user_id = uid
      AND n.type = 'team_identity_required'
      AND n.dismissed_at IS NULL
      AND n.data->>'team_id' = r.team_id::text
    RETURNING n.id
  )
  SELECT COUNT(*) INTO dismissed_count FROM dismissed;

  changed_count := inserted_count + dismissed_count;
  RETURN changed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_join_request_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  updated_count int := 0;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.notifications n
  SET data = COALESCE(n.data, '{}'::jsonb) || jsonb_build_object(
        'handled', true,
        'decision', CASE
          WHEN tjr.status = 'approved' THEN 'approved'
          WHEN tjr.status = 'rejected' THEN 'rejected'
          ELSE tjr.status
        END,
        'handled_at', now()
      ),
      read_at = COALESCE(n.read_at, now())
  FROM public.team_join_requests tjr
  WHERE n.user_id = uid
    AND n.type = 'team_join_request_created'
    AND n.data ? 'request_id'
    AND n.data->>'request_id' = tjr.id::text
    AND tjr.status <> 'pending'
    AND COALESCE(n.data->>'handled', 'false') <> 'true';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_notification(_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.notifications
  SET dismissed_at = COALESCE(dismissed_at, now()),
      read_at = COALESCE(read_at, now())
  WHERE id = _notification_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_read_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.notifications
  SET dismissed_at = COALESCE(dismissed_at, now())
  WHERE user_id = auth.uid()
    AND read_at IS NOT NULL
    AND dismissed_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_identity_required_notifications() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_join_request_notifications() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dismiss_notification(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dismiss_read_notifications() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.sync_identity_required_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_join_request_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_read_notifications() TO authenticated;

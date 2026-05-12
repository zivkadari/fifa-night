-- Live sync stabilization: publish evening updates and cancel by marking rows.

ALTER TABLE public.evenings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'evenings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.evenings;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_evenings_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  is_owner boolean;
  is_editor boolean;
BEGIN
  IF current_setting('app.submit_tournament_score', true) = 'on'
     OR current_setting('app.evening_server_update', true) = 'on'
  THEN
    IF (NEW.id IS DISTINCT FROM OLD.id)
       OR (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
       OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
    THEN
      RAISE EXCEPTION 'Server evening update can only update evening data';
    END IF;
    RETURN NEW;
  END IF;

  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);

  IF is_owner THEN
    RETURN NEW;
  END IF;

  is_editor := EXISTS (
    SELECT 1
    FROM public.evening_members m
    WHERE m.evening_id = OLD.id
      AND m.user_id = uid
      AND m.role = 'editor'
  );

  IF is_editor THEN
    IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
    THEN
      RAISE EXCEPTION 'Editors cannot modify owner, team, or share code';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the owner or editors can modify evening records';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_team_evening(_evening_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.evenings%ROWTYPE;
  is_authorized boolean := false;
  cancelled_by_name text;
  updated_data jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO ev
  FROM public.evenings
  WHERE id = _evening_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evening not found';
  END IF;

  is_authorized := ev.owner_id = uid;

  IF ev.team_id IS NOT NULL THEN
    is_authorized := is_authorized OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = ev.team_id
        AND tm.user_id = uid
        AND tm.role IN ('owner', 'admin')
    );
  END IF;

  is_authorized := is_authorized OR EXISTS (
    SELECT 1
    FROM public.evening_members em
    WHERE em.evening_id = ev.id
      AND em.user_id = uid
      AND em.role IN ('owner', 'editor')
  );

  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Not allowed to stop this evening';
  END IF;

  SELECT p.display_name
  INTO cancelled_by_name
  FROM public.profiles p
  WHERE p.id = uid;

  updated_data := ev.data;
  updated_data := jsonb_set(updated_data, '{cancelled}', 'true'::jsonb, true);
  updated_data := jsonb_set(updated_data, '{cancelled_at}', to_jsonb(now()), true);
  updated_data := jsonb_set(updated_data, '{cancelled_by}', to_jsonb(uid), true);
  updated_data := jsonb_set(updated_data, '{completed}', 'true'::jsonb, true);

  IF cancelled_by_name IS NOT NULL AND btrim(cancelled_by_name) <> '' THEN
    updated_data := jsonb_set(updated_data, '{cancelled_by_name}', to_jsonb(cancelled_by_name), true);
  END IF;

  PERFORM set_config('app.evening_server_update', 'on', true);
  UPDATE public.evenings
  SET data = updated_data,
      updated_at = now()
  WHERE id = ev.id
  RETURNING data INTO updated_data;

  RETURN updated_data;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_team_evening(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_team_evening(text) TO authenticated;

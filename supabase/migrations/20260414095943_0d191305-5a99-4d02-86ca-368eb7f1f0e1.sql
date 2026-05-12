
-- 1) Upgrade existing 'member' roles to 'editor' so current flows don't break
UPDATE public.evening_members SET role = 'editor' WHERE role = 'member';

-- 2) Create RPC to safely create a team evening (enforces one active per team)
CREATE OR REPLACE FUNCTION public.create_team_evening(
  _evening_id text,
  _team_id uuid,
  _data jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  active_count int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify caller is a team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  -- Check for existing active evening (completed != true)
  SELECT COUNT(*) INTO active_count
  FROM public.evenings
  WHERE team_id = _team_id
    AND (data->>'completed')::text IS DISTINCT FROM 'true';

  IF active_count > 0 THEN
    RAISE EXCEPTION 'team already has an active evening';
  END IF;

  -- Create the evening
  INSERT INTO public.evenings (id, owner_id, data, team_id)
  VALUES (_evening_id, uid, _data, _team_id);

  RETURN _evening_id;
END;
$$;

-- 3) Drop the overly permissive member update policies
DROP POLICY IF EXISTS "Evenings: members can update" ON public.evenings;
DROP POLICY IF EXISTS "Evenings: members can update data" ON public.evenings;

-- 4) Keep owner update policy (already exists), add editor-only update policy
DROP POLICY IF EXISTS "Evenings: owner can update" ON public.evenings;

CREATE POLICY "Evenings: owner can update"
ON public.evenings
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Evenings: editor can update"
ON public.evenings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evening_members
    WHERE evening_id = evenings.id
      AND user_id = auth.uid()
      AND role = 'editor'
  )
);

-- 5) Update the trigger to also check editor role for non-owners
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
  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);

  -- Owner can change anything
  IF is_owner THEN
    RETURN NEW;
  END IF;

  -- Check if user is an editor
  is_editor := EXISTS (
    SELECT 1 FROM public.evening_members m
    WHERE m.evening_id = OLD.id AND m.user_id = uid AND m.role = 'editor'
  );

  IF is_editor THEN
    -- Editors can update only the data column
    IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
    THEN
      RAISE EXCEPTION 'Editors cannot modify owner, team, or share code';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-editors cannot update
  RAISE EXCEPTION 'Only the owner or editors can modify evening records';
END;
$$;

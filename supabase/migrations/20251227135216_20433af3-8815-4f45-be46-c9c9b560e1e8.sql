-- Create security definer functions to avoid RLS recursion

-- Check if user is a member of a specific team
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  )
$$;

-- Check if user is a member of a specific evening
CREATE OR REPLACE FUNCTION public.is_evening_member(_user_id uuid, _evening_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.evening_members
    WHERE user_id = _user_id AND evening_id = _evening_id
  )
$$;

-- Get all team_ids for a user
CREATE OR REPLACE FUNCTION public.user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

-- Get all evening_ids for a user
CREATE OR REPLACE FUNCTION public.user_evening_ids(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT evening_id FROM public.evening_members WHERE user_id = _user_id
$$;

-- Update team_members RLS policy
DROP POLICY IF EXISTS "TeamMembers: can see own and teammates" ON team_members;

CREATE POLICY "TeamMembers: can see own and teammates" ON team_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR team_id IN (SELECT public.user_team_ids(auth.uid()))
);

-- Update evening_members RLS policy
DROP POLICY IF EXISTS "EveningMembers: can see own and co-participants" ON evening_members;

CREATE POLICY "EveningMembers: can see own and co-participants" ON evening_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR evening_id IN (SELECT public.user_evening_ids(auth.uid()))
);

-- Update profiles RLS policy
DROP POLICY IF EXISTS "Profiles: authenticated can read" ON profiles;

CREATE POLICY "Profiles: authenticated can read" ON profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id IN (SELECT public.user_team_ids(auth.uid()))
    AND tm.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM evening_members em
    WHERE em.evening_id IN (SELECT public.user_evening_ids(auth.uid()))
    AND em.user_id = profiles.id
  )
);
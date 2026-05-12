-- Step 1: Drop duplicate triggers (keep only one)
DROP TRIGGER IF EXISTS add_team_owner_membership_trg ON teams;
DROP TRIGGER IF EXISTS on_team_created ON teams;
-- Keep trg_teams_add_owner_membership

-- Step 2: Recreate the function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.add_team_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Step 3: Create is_team_owner function
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND owner_id = _user_id
  )
$$;

-- Step 4: Update team_members INSERT policy
DROP POLICY IF EXISTS "TeamMembers: owner can add members" ON team_members;
CREATE POLICY "TeamMembers: owner can add members" ON team_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_team_owner(auth.uid(), team_id)
);

-- Step 5: Update team_members DELETE policy
DROP POLICY IF EXISTS "TeamMembers: owner can remove" ON team_members;
CREATE POLICY "TeamMembers: owner can remove" ON team_members
FOR DELETE TO authenticated
USING (public.is_team_owner(auth.uid(), team_id));

-- Step 6: Update teams SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Teams: members can read" ON teams;
CREATE POLICY "Teams: members can read" ON teams
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() 
  OR id IN (SELECT public.user_team_ids(auth.uid()))
);
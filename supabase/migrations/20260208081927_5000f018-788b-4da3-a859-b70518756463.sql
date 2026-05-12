-- Drop restrictive policies that block all DELETE and UPDATE
DROP POLICY IF EXISTS "Teams: restrict delete" ON teams;
DROP POLICY IF EXISTS "Teams: restrict updates" ON teams;

-- Create new policy: owner can delete their team
CREATE POLICY "Teams: owner can delete"
ON teams FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Create new policy: owner can update their team
CREATE POLICY "Teams: owner can update"
ON teams FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
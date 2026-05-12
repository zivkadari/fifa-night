-- The "members can update" policy was already dropped.
-- The trigger enforce_evenings_update_permissions already prevents members from
-- changing owner_id, team_id, or share_code. So we just need a simple member
-- update policy that lets them through to the trigger.

-- Owner can update anything
DROP POLICY IF EXISTS "Evenings: owner can update" ON public.evenings;
CREATE POLICY "Evenings: owner can update"
ON public.evenings
FOR UPDATE
TO public
USING (owner_id = auth.uid());

-- Members can update (trigger enforces they only change data column)
DROP POLICY IF EXISTS "Evenings: members can update data" ON public.evenings;
CREATE POLICY "Evenings: members can update data"
ON public.evenings
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.evening_members
    WHERE evening_members.evening_id = evenings.id
    AND evening_members.user_id = auth.uid()
  )
);
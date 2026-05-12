-- Drop the old policy that blocks all deletes
DROP POLICY IF EXISTS "Evenings: restrict delete" ON public.evenings;

-- Create new policy - only owner can delete their tournaments
CREATE POLICY "Evenings: owner can delete"
  ON public.evenings
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
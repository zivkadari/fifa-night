-- Remove current restrictive policy
DROP POLICY IF EXISTS "TeamPlayers: restrict delete" ON public.team_players;

-- Create new policy allowing team owner to delete
CREATE POLICY "TeamPlayers: owner can delete"
ON public.team_players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_players.team_id 
    AND t.owner_id = auth.uid()
  )
);
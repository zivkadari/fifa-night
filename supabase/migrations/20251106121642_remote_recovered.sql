-- Drop all existing RLS policies on main tables
DROP POLICY IF EXISTS "Players: insert by owner or admin" ON public.players;
DROP POLICY IF EXISTS "Players: update by owner or admin" ON public.players;
DROP POLICY IF EXISTS "Players: public select" ON public.players;

DROP POLICY IF EXISTS "Select owner, members, or admin" ON public.evenings;
DROP POLICY IF EXISTS "Insert own or admin" ON public.evenings;
DROP POLICY IF EXISTS "Update owner, members, or admin" ON public.evenings;
DROP POLICY IF EXISTS "Admin delete only" ON public.evenings;

DROP POLICY IF EXISTS "Teams: admin delete only" ON public.teams;
DROP POLICY IF EXISTS "Teams: insert own or admin" ON public.teams;
DROP POLICY IF EXISTS "Teams: select owner, members, or admin" ON public.teams;
DROP POLICY IF EXISTS "Teams: update owner, members, or admin" ON public.teams;

DROP POLICY IF EXISTS "TeamPlayers: delete by owner or admin" ON public.team_players;
DROP POLICY IF EXISTS "TeamPlayers: insert by owner or admin" ON public.team_players;
DROP POLICY IF EXISTS "TeamPlayers: select visible to team or admin" ON public.team_players;

-- Create new public access policies
CREATE POLICY "Players: public access"
ON public.players
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Evenings: public access"
ON public.evenings
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Teams: public access"
ON public.teams
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "TeamPlayers: public access"
ON public.team_players
FOR ALL
USING (true)
WITH CHECK (true);

-- Security Fix: Restrict delete operations on all tables to prevent data destruction
-- Make data read-only for anonymous users, allow only inserts/updates

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Teams: public access" ON public.teams;
DROP POLICY IF EXISTS "Evenings: public access" ON public.evenings;
DROP POLICY IF EXISTS "Players: public access" ON public.players;
DROP POLICY IF EXISTS "TeamPlayers: public access" ON public.team_players;

-- Teams: Allow read and insert, restrict update/delete
CREATE POLICY "Teams: public read" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "Teams: public insert" ON public.teams
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Teams: restrict updates" ON public.teams
  FOR UPDATE USING (false);

CREATE POLICY "Teams: restrict delete" ON public.teams
  FOR DELETE USING (false);

-- Evenings: Allow read and insert/update, restrict delete
CREATE POLICY "Evenings: public read" ON public.evenings
  FOR SELECT USING (true);

CREATE POLICY "Evenings: public insert" ON public.evenings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Evenings: public update" ON public.evenings
  FOR UPDATE USING (true);

CREATE POLICY "Evenings: restrict delete" ON public.evenings
  FOR DELETE USING (false);

-- Players: Allow read and insert, restrict update/delete
CREATE POLICY "Players: public read" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "Players: public insert" ON public.players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Players: restrict updates" ON public.players
  FOR UPDATE USING (false);

CREATE POLICY "Players: restrict delete" ON public.players
  FOR DELETE USING (false);

-- TeamPlayers: Allow read and insert, restrict update/delete
CREATE POLICY "TeamPlayers: public read" ON public.team_players
  FOR SELECT USING (true);

CREATE POLICY "TeamPlayers: public insert" ON public.team_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "TeamPlayers: restrict updates" ON public.team_players
  FOR UPDATE USING (false);

CREATE POLICY "TeamPlayers: restrict delete" ON public.team_players
  FOR DELETE USING (false);

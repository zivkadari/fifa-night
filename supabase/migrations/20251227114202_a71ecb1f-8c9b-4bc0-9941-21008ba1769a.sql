-- Player statistics per team
CREATE TABLE public.player_stats_by_team (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  games_drawn INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  alpha_count INTEGER NOT NULL DEFAULT 0,
  beta_count INTEGER NOT NULL DEFAULT 0,
  gamma_count INTEGER NOT NULL DEFAULT 0,
  delta_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, player_id)
);

-- Player global statistics (across all teams)
CREATE TABLE public.player_stats_global (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  games_drawn INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  alpha_count INTEGER NOT NULL DEFAULT 0,
  beta_count INTEGER NOT NULL DEFAULT 0,
  gamma_count INTEGER NOT NULL DEFAULT 0,
  delta_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_stats_by_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats_global ENABLE ROW LEVEL SECURITY;

-- RLS: Team stats readable by team members only
CREATE POLICY "player_stats_by_team: team members can read"
ON public.player_stats_by_team FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = player_stats_by_team.team_id
    AND tm.user_id = auth.uid()
  )
);

-- RLS: Global stats readable if user shares a team with the player
CREATE POLICY "player_stats_global: team members can read"
ON public.player_stats_global FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_players tp
    JOIN team_members tm ON tp.team_id = tm.team_id
    WHERE tp.player_id = player_stats_global.player_id
    AND tm.user_id = auth.uid()
  )
);

-- No direct client writes - managed by backend (correct syntax)
CREATE POLICY "player_stats_by_team: no direct inserts"
ON public.player_stats_by_team FOR INSERT
WITH CHECK (false);

CREATE POLICY "player_stats_by_team: no direct updates"
ON public.player_stats_by_team FOR UPDATE
USING (false);

CREATE POLICY "player_stats_by_team: no direct deletes"
ON public.player_stats_by_team FOR DELETE
USING (false);

CREATE POLICY "player_stats_global: no direct inserts"
ON public.player_stats_global FOR INSERT
WITH CHECK (false);

CREATE POLICY "player_stats_global: no direct updates"
ON public.player_stats_global FOR UPDATE
USING (false);

CREATE POLICY "player_stats_global: no direct deletes"
ON public.player_stats_global FOR DELETE
USING (false);

-- Indexes for performance
CREATE INDEX idx_player_stats_by_team_team ON public.player_stats_by_team(team_id);
CREATE INDEX idx_player_stats_by_team_player ON public.player_stats_by_team(player_id);
CREATE INDEX idx_player_stats_global_player ON public.player_stats_global(player_id);
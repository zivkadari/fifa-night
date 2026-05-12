-- Player lifetime statistics (aggregated from tournaments)
CREATE TABLE public.player_stats (
  player_id TEXT NOT NULL PRIMARY KEY,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_goals_for INTEGER NOT NULL DEFAULT 0,
  total_goals_against INTEGER NOT NULL DEFAULT 0,
  tournaments_played INTEGER NOT NULL DEFAULT 0,
  alpha_count INTEGER NOT NULL DEFAULT 0,
  beta_count INTEGER NOT NULL DEFAULT 0,
  gamma_count INTEGER NOT NULL DEFAULT 0,
  delta_count INTEGER NOT NULL DEFAULT 0,
  longest_win_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Head-to-head matchup statistics between players
CREATE TABLE public.player_matchups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player1_wins INTEGER NOT NULL DEFAULT 0,
  player2_wins INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player1_id, player2_id)
);

-- Football club usage and win statistics
CREATE TABLE public.club_stats (
  club_id TEXT NOT NULL PRIMARY KEY,
  club_name TEXT NOT NULL,
  times_used INTEGER NOT NULL DEFAULT 0,
  times_won INTEGER NOT NULL DEFAULT 0,
  goals_scored INTEGER NOT NULL DEFAULT 0,
  goals_conceded INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_stats ENABLE ROW LEVEL SECURITY;

-- Player stats: readable by authenticated users who share a team with the player
CREATE POLICY "player_stats: team members can read"
ON public.player_stats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_players tp1
    JOIN team_members tm ON tp1.team_id = tm.team_id
    WHERE tp1.player_id = player_stats.player_id
    AND tm.user_id = auth.uid()
  )
);

-- Player matchups: readable by authenticated users who share a team with either player
CREATE POLICY "player_matchups: team members can read"
ON public.player_matchups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_players tp
    JOIN team_members tm ON tp.team_id = tm.team_id
    WHERE tp.player_id IN (player_matchups.player1_id, player_matchups.player2_id)
    AND tm.user_id = auth.uid()
  )
);

-- Club stats: readable by all authenticated users (public leaderboard)
CREATE POLICY "club_stats: authenticated can read"
ON public.club_stats FOR SELECT
USING (auth.uid() IS NOT NULL);

-- No direct inserts/updates/deletes - stats are managed by backend functions
CREATE POLICY "player_stats: no direct writes"
ON public.player_stats FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "player_matchups: no direct writes"
ON public.player_matchups FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "club_stats: no direct writes"
ON public.club_stats FOR ALL
USING (false)
WITH CHECK (false);

-- Indexes for performance
CREATE INDEX idx_player_matchups_player1 ON public.player_matchups(player1_id);
CREATE INDEX idx_player_matchups_player2 ON public.player_matchups(player2_id);
CREATE INDEX idx_club_stats_times_won ON public.club_stats(times_won DESC);
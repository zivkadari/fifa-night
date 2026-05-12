-- Create player_accounts table to link auth users to logical players
CREATE TABLE IF NOT EXISTS public.player_accounts (
  player_id text PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_accounts_user_id ON public.player_accounts(user_id);

-- Enable Row Level Security
ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;

-- Policies: only the owner can manage/view their mapping
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_accounts' AND policyname = 'Users can view their own player mapping'
  ) THEN
    CREATE POLICY "Users can view their own player mapping"
    ON public.player_accounts
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_accounts' AND policyname = 'Users can claim a player'
  ) THEN
    CREATE POLICY "Users can claim a player"
    ON public.player_accounts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_accounts' AND policyname = 'Users can update their own mapping'
  ) THEN
    CREATE POLICY "Users can update their own mapping"
    ON public.player_accounts
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_accounts' AND policyname = 'Users can delete their own mapping'
  ) THEN
    CREATE POLICY "Users can delete their own mapping"
    ON public.player_accounts
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function + trigger: when a user claims a player, add them as a member in all teams that include that player
CREATE OR REPLACE FUNCTION public.sync_team_members_on_player_claim()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT tp.team_id, NEW.user_id, 'member'
  FROM public.team_players tp
  WHERE tp.player_id = NEW.player_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_team_members_on_player_claim ON public.player_accounts;
CREATE TRIGGER trg_sync_team_members_on_player_claim
AFTER INSERT ON public.player_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_members_on_player_claim();

-- Function + trigger: when a player is added to a team, if that player is claimed by a user, add that user as a team member
CREATE OR REPLACE FUNCTION public.sync_team_members_on_team_player_insert()
RETURNS trigger AS $$
DECLARE
  uid uuid;
BEGIN
  SELECT pa.user_id INTO uid FROM public.player_accounts pa WHERE pa.player_id = NEW.player_id;
  IF uid IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.team_id, uid, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_team_members_on_team_players_insert ON public.team_players;
CREATE TRIGGER trg_sync_team_members_on_team_players_insert
AFTER INSERT ON public.team_players
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_members_on_team_player_insert();
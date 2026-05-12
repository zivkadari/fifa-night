-- =====================================================
-- 1. Create profiles table (linked to auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read profiles
CREATE POLICY "Profiles: public read"
ON public.profiles FOR SELECT
USING (true);

-- RLS: Only owner can update their profile
CREATE POLICY "Profiles: owner can update"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

-- RLS: No direct insert (handled by trigger)
CREATE POLICY "Profiles: no direct insert"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- RLS: No delete
CREATE POLICY "Profiles: no delete"
ON public.profiles FOR DELETE
USING (false);

-- Trigger to update updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  display_name_value text;
BEGIN
  -- Extract and validate display name from metadata
  display_name_value := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  
  -- Validate length (max 50 characters)
  IF length(display_name_value) > 50 THEN
    display_name_value := substring(display_name_value, 1, 50);
  END IF;
  
  -- Remove leading/trailing whitespace
  display_name_value := trim(display_name_value);
  
  -- Ensure not empty
  IF length(display_name_value) = 0 THEN
    display_name_value := split_part(NEW.email, '@', 1);
  END IF;
  
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, display_name_value, NULL)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. Create player_accounts table (links players to users)
-- =====================================================
CREATE TABLE public.player_accounts (
  player_id text PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: Owner can read their own claim
CREATE POLICY "PlayerAccounts: owner can read"
ON public.player_accounts FOR SELECT
USING (user_id = auth.uid());

-- RLS: Authenticated user can claim unclaimed player
CREATE POLICY "PlayerAccounts: user can claim"
ON public.player_accounts FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS: No updates
CREATE POLICY "PlayerAccounts: no updates"
ON public.player_accounts FOR UPDATE
USING (false);

-- RLS: Owner can unclaim
CREATE POLICY "PlayerAccounts: owner can delete"
ON public.player_accounts FOR DELETE
USING (user_id = auth.uid());

-- =====================================================
-- 3. Create team_members table (links users to teams)
-- =====================================================
CREATE TABLE public.team_members (
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS: Members can see their team memberships
CREATE POLICY "TeamMembers: user can see own memberships"
ON public.team_members FOR SELECT
USING (user_id = auth.uid());

-- RLS: Team owner can add members
CREATE POLICY "TeamMembers: owner can add members"
ON public.team_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.owner_id = auth.uid()
  )
);

-- RLS: No direct updates
CREATE POLICY "TeamMembers: no updates"
ON public.team_members FOR UPDATE
USING (false);

-- RLS: Team owner can remove members
CREATE POLICY "TeamMembers: owner can remove"
ON public.team_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.owner_id = auth.uid()
  )
);

-- =====================================================
-- 4. Auto-add team owner as member when team is created
-- =====================================================
CREATE OR REPLACE FUNCTION public.add_team_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_created ON public.teams;
CREATE TRIGGER on_team_created
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.add_team_owner_membership();

-- =====================================================
-- 5. Sync team_members when player is added to team (if player is claimed)
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_team_members_on_team_player_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END;
$$;

DROP TRIGGER IF EXISTS on_team_player_added ON public.team_players;
CREATE TRIGGER on_team_player_added
AFTER INSERT ON public.team_players
FOR EACH ROW EXECUTE FUNCTION public.sync_team_members_on_team_player_insert();

-- =====================================================
-- 6. Sync team_members when player is claimed
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_team_members_on_player_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT tp.team_id, NEW.user_id, 'member'
  FROM public.team_players tp
  WHERE tp.player_id = NEW.player_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_player_claimed ON public.player_accounts;
CREATE TRIGGER on_player_claimed
AFTER INSERT ON public.player_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_team_members_on_player_claim();
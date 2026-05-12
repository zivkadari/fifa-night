
-- 1) Enforce restrictive RLS on evenings and remove public read

ALTER TABLE public.evenings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view all evenings" ON public.evenings;

-- 2) Enforce share_code normalization and uniqueness

CREATE OR REPLACE FUNCTION public.normalize_evenings_share_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_code IS NOT NULL THEN
    NEW.share_code := upper(NEW.share_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evenings_normalize_share_code ON public.evenings;

CREATE TRIGGER trg_evenings_normalize_share_code
BEFORE INSERT OR UPDATE ON public.evenings
FOR EACH ROW
EXECUTE FUNCTION public.normalize_evenings_share_code();

-- Unique index for share_code
-- Note: If this fails due to duplicates, we will need to deduplicate existing data first.
CREATE UNIQUE INDEX IF NOT EXISTS evenings_share_code_unique
ON public.evenings (share_code);

-- 3) Restrict updates of sensitive columns to owner or admin only

CREATE OR REPLACE FUNCTION public.enforce_evenings_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  is_owner boolean;
  is_admin boolean;
BEGIN
  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);
  is_admin := public.has_role(uid, 'admin');

  -- Allow owner/admin to change anything
  IF is_owner OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Members can update only data and updated_at; protect sensitive columns
  IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
     OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
  THEN
    RAISE EXCEPTION 'Only the owner or admin can modify owner_id, team_id, or share_code';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evenings_restrict_update ON public.evenings;

CREATE TRIGGER trg_evenings_restrict_update
BEFORE UPDATE ON public.evenings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_evenings_update_permissions();

-- 4) Lock search_path on SECURITY DEFINER/trigger functions

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.add_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_team_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_team_members_on_team_player_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_team_members_on_player_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT tp.team_id, NEW.user_id, 'member'
  FROM public.team_players tp
  WHERE tp.player_id = NEW.player_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 5) Add missing triggers for membership automation

-- Add owner membership on evening creation
DROP TRIGGER IF EXISTS trg_evenings_add_owner_membership ON public.evenings;
CREATE TRIGGER trg_evenings_add_owner_membership
AFTER INSERT ON public.evenings
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_membership();

-- Add team owner membership on team creation
DROP TRIGGER IF EXISTS trg_teams_add_owner_membership ON public.teams;
CREATE TRIGGER trg_teams_add_owner_membership
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.add_team_owner_membership();

-- Sync team members when adding a player to a team
DROP TRIGGER IF EXISTS trg_team_players_sync_members ON public.team_players;
CREATE TRIGGER trg_team_players_sync_members
AFTER INSERT ON public.team_players
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_members_on_team_player_insert();

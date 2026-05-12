-- Security Fix: Add search_path to functions that are missing it
-- This prevents potential security issues with function execution

-- Fix normalize_evenings_share_code
CREATE OR REPLACE FUNCTION public.normalize_evenings_share_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.share_code IS NOT NULL THEN
    NEW.share_code := upper(NEW.share_code);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix add_team_owner_membership
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

-- Fix sync_team_members_on_team_player_insert
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

-- Fix sync_team_members_on_player_claim
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

-- Fix add_owner_membership
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

-- Fix update_updated_at_column
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

-- Fix update_updated_at_profile
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

-- Security Fix: Add INSERT policy for evening_members
-- This allows users to join evenings through the join_evening_by_code RPC

-- Helper function to validate evening join
CREATE OR REPLACE FUNCTION public.can_join_evening(_evening_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.evenings
    WHERE id = _evening_id
  );
$$;

-- Add INSERT policy for evening_members
CREATE POLICY "Users can join evenings via RPC"
ON evening_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  public.can_join_evening(evening_id)
);
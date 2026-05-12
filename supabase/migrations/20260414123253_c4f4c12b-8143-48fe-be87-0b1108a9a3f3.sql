
-- Add invite_code to teams
ALTER TABLE public.teams
ADD COLUMN invite_code text NOT NULL DEFAULT substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8);

-- Make invite_code unique
CREATE UNIQUE INDEX idx_teams_invite_code ON public.teams (invite_code);

-- Uppercase normalize trigger for invite codes
CREATE OR REPLACE FUNCTION public.normalize_team_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.invite_code IS NOT NULL THEN
    NEW.invite_code := upper(NEW.invite_code);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_normalize_team_invite_code
BEFORE INSERT OR UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.normalize_team_invite_code();

-- RPC: join a team by invite code
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text)
RETURNS TABLE(team_id uuid, team_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID;
  tid UUID;
  tname TEXT;
  recent_attempts INT;
  cleaned_code TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  cleaned_code := upper(trim(_code));

  IF length(cleaned_code) > 20 OR length(cleaned_code) = 0 THEN
    RAISE EXCEPTION 'invalid code format';
  END IF;

  IF cleaned_code !~ '^[A-Z0-9]+$' THEN
    RAISE EXCEPTION 'invalid code format';
  END IF;

  -- Rate limit using join_attempts table
  SELECT COUNT(*) INTO recent_attempts
  FROM public.join_attempts
  WHERE user_id = uid
  AND attempted_at > now() - interval '1 hour';

  IF recent_attempts >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;

  -- Find the team
  SELECT id, name INTO tid, tname FROM public.teams WHERE invite_code = cleaned_code;

  -- Log attempt
  INSERT INTO public.join_attempts (user_id, success)
  VALUES (uid, tid IS NOT NULL);

  IF tid IS NULL THEN
    RAISE EXCEPTION 'invalid code';
  END IF;

  -- Add as member (safe default role)
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (tid, uid, 'member')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT tid, tname;
END;
$function$;

-- RPC: get team invite code (owner only)
CREATE OR REPLACE FUNCTION public.get_team_invite_code(_team_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  code text;
BEGIN
  SELECT invite_code INTO code
  FROM public.teams
  WHERE id = _team_id AND owner_id = auth.uid();
  
  RETURN code;
END;
$function$;

-- RPC: regenerate invite code (owner only)
CREATE OR REPLACE FUNCTION public.regenerate_team_invite_code(_team_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_code text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not team owner';
  END IF;

  new_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  
  UPDATE public.teams SET invite_code = new_code WHERE id = _team_id;
  
  RETURN new_code;
END;
$function$;

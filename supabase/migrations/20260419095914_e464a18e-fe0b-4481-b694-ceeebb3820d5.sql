CREATE OR REPLACE FUNCTION public.resolve_invite_code(_code text)
RETURNS TABLE(kind text, team_id uuid, team_name text, evening_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_code text;
BEGIN
  cleaned_code := upper(trim(_code));

  IF cleaned_code IS NULL OR length(cleaned_code) = 0 OR length(cleaned_code) > 20 THEN
    RETURN;
  END IF;

  IF cleaned_code !~ '^[A-Z0-9-]+$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'team'::text, t.id, t.name, NULL::text
  FROM public.teams t
  WHERE t.invite_code = cleaned_code
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'evening'::text, e.team_id, NULL::text, e.id
  FROM public.evenings e
  WHERE e.share_code = cleaned_code
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_evenings(_team_id uuid)
RETURNS TABLE(id text, data jsonb, team_id uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = _team_id
      AND tm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  RETURN QUERY
  SELECT e.id, e.data, e.team_id, e.created_at, e.updated_at
  FROM public.evenings e
  WHERE e.team_id = _team_id
  ORDER BY e.updated_at DESC;
END;
$$;
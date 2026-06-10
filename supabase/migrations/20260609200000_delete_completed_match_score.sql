CREATE OR REPLACE FUNCTION public.delete_completed_match_score(
  _evening_id text,
  _round_index integer,
  _match_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.evenings%ROWTYPE;
  is_owner_admin boolean := false;
  updated_data jsonb;
  round_data jsonb;
  match_data jsonb;
  new_matches jsonb := '[]'::jsonb;
  pair_scores jsonb := '{}'::jsonb;
  matches_len integer;
  new_matches_len integer;
  i integer;
  key text;
  m jsonb;
  w text;
  previous_wins integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _round_index IS NULL OR _round_index < 0 THEN
    RAISE EXCEPTION 'Invalid round index';
  END IF;

  IF _match_index IS NULL OR _match_index < 0 THEN
    RAISE EXCEPTION 'Invalid match index';
  END IF;

  SELECT *
  INTO ev
  FROM public.evenings
  WHERE id = _evening_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evening not found';
  END IF;

  IF COALESCE(ev.data ->> 'completed', 'false') = 'true' THEN
    RAISE EXCEPTION 'Cannot update a completed evening';
  END IF;

  IF ev.data ? 'schedule' OR COALESCE(ev.data ->> 'mode', '') = 'five-player-doubles' THEN
    RAISE EXCEPTION 'This function supports regular pairs only';
  END IF;

  is_owner_admin := ev.owner_id = uid;

  IF ev.team_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = ev.team_id
        AND tm.user_id = uid
        AND tm.role IN ('owner', 'admin')
    )
    INTO is_owner_admin;

    is_owner_admin := is_owner_admin OR ev.owner_id = uid;
  END IF;

  IF NOT is_owner_admin THEN
    RAISE EXCEPTION 'Only owner/admin can delete a completed match';
  END IF;

  IF jsonb_typeof(ev.data -> 'rounds') <> 'array'
     OR _round_index >= jsonb_array_length(ev.data -> 'rounds')
  THEN
    RAISE EXCEPTION 'Target round not found';
  END IF;

  round_data := ev.data -> 'rounds' -> _round_index;

  IF jsonb_typeof(round_data -> 'matches') <> 'array'
     OR _match_index >= jsonb_array_length(round_data -> 'matches')
  THEN
    RAISE EXCEPTION 'Target match not found';
  END IF;

  match_data := round_data -> 'matches' -> _match_index;

  IF COALESCE(match_data ->> 'completed', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Only completed matches can be deleted';
  END IF;

  matches_len := jsonb_array_length(round_data -> 'matches');

  FOR i IN 0..(matches_len - 1)
  LOOP
    IF i <> _match_index THEN
      new_matches := new_matches || jsonb_build_array(round_data -> 'matches' -> i);
    END IF;
  END LOOP;

  IF jsonb_typeof(round_data -> 'pairScores') = 'object' THEN
    FOR key IN SELECT jsonb_object_keys(round_data -> 'pairScores')
    LOOP
      pair_scores := jsonb_set(pair_scores, ARRAY[key], '0'::jsonb, true);
    END LOOP;
  END IF;

  new_matches_len := jsonb_array_length(new_matches);

  IF new_matches_len > 0 THEN
    FOR i IN 0..(new_matches_len - 1)
    LOOP
      m := new_matches -> i;

      IF COALESCE(m ->> 'completed', 'false') = 'true' THEN
        w := COALESCE(m ->> 'winner', '');

        IF w <> '' THEN
          previous_wins := COALESCE(NULLIF(pair_scores ->> w, ''), '0')::integer;
          pair_scores := jsonb_set(pair_scores, ARRAY[w], to_jsonb(previous_wins + 1), true);
        END IF;
      END IF;
    END LOOP;
  END IF;

  updated_data := ev.data;

  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'matches'],
    new_matches,
    true
  );

  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'pairScores'],
    pair_scores,
    true
  );

  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'completed'],
    'false'::jsonb,
    true
  );

  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'isDeciderMatch'],
    'false'::jsonb,
    true
  );

  PERFORM set_config('app.submit_tournament_score', 'on', true);

  UPDATE public.evenings
  SET data = updated_data,
      updated_at = now()
  WHERE id = ev.id
  RETURNING data INTO updated_data;

  RETURN updated_data;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_completed_match_score(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_completed_match_score(text, integer, integer) TO authenticated;
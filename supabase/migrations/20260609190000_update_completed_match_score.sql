CREATE OR REPLACE FUNCTION public.update_completed_match_score(
  _evening_id text,
  _round_index integer,
  _match_index integer,
  _score_a integer,
  _score_b integer
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
  is_playing_member boolean := false;
  updated_data jsonb;
  round_data jsonb;
  match_data jsonb;
  score_json jsonb := to_jsonb(ARRAY[_score_a, _score_b]);
  winner_id text := '';
  pair_scores jsonb := '{}'::jsonb;
  matches_len integer;
  i integer;
  key text;
  m jsonb;
  w text;
  previous_wins integer;
  pair_a_id text;
  pair_b_id text;
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

  IF _score_a IS NULL OR _score_b IS NULL OR _score_a < 0 OR _score_b < 0 THEN
    RAISE EXCEPTION 'Invalid score';
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

    SELECT EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.player_accounts pa
        ON pa.team_id = tm.team_id
       AND pa.user_id = tm.user_id
      WHERE tm.team_id = ev.team_id
        AND tm.user_id = uid
        AND COALESCE(tm.member_mode, 'unset') <> 'spectator'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(ev.data -> 'players', '[]'::jsonb)) p
          WHERE p ->> 'id' = pa.player_id::text
        )
    )
    INTO is_playing_member;
  END IF;

  IF NOT (is_owner_admin OR is_playing_member) THEN
    RAISE EXCEPTION 'Not allowed to edit a score for this evening';
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
    RAISE EXCEPTION 'Only completed matches can be edited';
  END IF;

  IF _score_a > _score_b THEN
    winner_id := COALESCE(match_data #>> '{pairs,0,id}', '');
  ELSIF _score_b > _score_a THEN
    winner_id := COALESCE(match_data #>> '{pairs,1,id}', '');
  ELSE
    winner_id := '';
  END IF;

  match_data := jsonb_set(match_data, '{score}', score_json, true);
  match_data := jsonb_set(match_data, '{winner}', to_jsonb(winner_id), true);
  match_data := jsonb_set(match_data, '{completed}', 'true'::jsonb, true);

  updated_data := ev.data;
  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'matches', _match_index::text],
    match_data,
    false
  );

  round_data := updated_data -> 'rounds' -> _round_index;

  IF jsonb_typeof(round_data -> 'pairScores') = 'object' THEN
    FOR key IN SELECT jsonb_object_keys(round_data -> 'pairScores')
    LOOP
      pair_scores := jsonb_set(pair_scores, ARRAY[key], '0'::jsonb, true);
    END LOOP;
  END IF;

  pair_a_id := COALESCE(match_data #>> '{pairs,0,id}', '');
  pair_b_id := COALESCE(match_data #>> '{pairs,1,id}', '');

  IF pair_a_id <> '' THEN
    pair_scores := jsonb_set(pair_scores, ARRAY[pair_a_id], '0'::jsonb, true);
  END IF;

  IF pair_b_id <> '' THEN
    pair_scores := jsonb_set(pair_scores, ARRAY[pair_b_id], '0'::jsonb, true);
  END IF;

  matches_len := jsonb_array_length(round_data -> 'matches');

  IF matches_len > 0 THEN
    FOR i IN 0..(matches_len - 1)
    LOOP
      m := round_data -> 'matches' -> i;

      IF COALESCE(m ->> 'completed', 'false') = 'true' THEN
        w := COALESCE(m ->> 'winner', '');

        IF w <> '' THEN
          previous_wins := COALESCE(NULLIF(pair_scores ->> w, ''), '0')::integer;
          pair_scores := jsonb_set(pair_scores, ARRAY[w], to_jsonb(previous_wins + 1), true);
        END IF;
      END IF;
    END LOOP;
  END IF;

  updated_data := jsonb_set(
    updated_data,
    ARRAY['rounds', _round_index::text, 'pairScores'],
    pair_scores,
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

REVOKE ALL ON FUNCTION public.update_completed_match_score(text, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_completed_match_score(text, integer, integer, integer, integer) TO authenticated;
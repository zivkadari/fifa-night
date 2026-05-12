-- Phase 1.5A fix: targeted first-time score submission.
-- Regular playing team members can update only one unscored target match.

CREATE OR REPLACE FUNCTION public.submit_match_score(
  _evening_id text,
  _round_index integer,
  _match_index integer,
  _score_a integer,
  _score_b integer,
  _club_a jsonb DEFAULT NULL,
  _club_b jsonb DEFAULT NULL
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
  mode text;
  updated_data jsonb;
  round_data jsonb;
  match_data jsonb;
  score_json jsonb := to_jsonb(ARRAY[_score_a, _score_b]);
  winner_id text := '';
  pair_scores jsonb;
  previous_wins integer;
  games_len integer;
  next_game_index integer;
  i integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
    RAISE EXCEPTION 'Not allowed to submit a score for this evening';
  END IF;

  mode := COALESCE(ev.data ->> 'type', 'pairs');
  updated_data := ev.data;

  IF mode = 'singles' THEN
    IF _round_index IS NOT NULL THEN
      RAISE EXCEPTION 'Singles score submission must not include a round index';
    END IF;

    IF jsonb_typeof(ev.data -> 'gameSequence') <> 'array'
       OR _match_index >= jsonb_array_length(ev.data -> 'gameSequence')
    THEN
      RAISE EXCEPTION 'Target game not found';
    END IF;

    match_data := ev.data -> 'gameSequence' -> _match_index;

    IF (match_data ? 'score') AND COALESCE(jsonb_typeof(match_data -> 'score') <> 'null', false) THEN
      RAISE EXCEPTION 'Match already has a score';
    END IF;

    IF COALESCE(match_data ->> 'completed', 'false') = 'true' THEN
      RAISE EXCEPTION 'Match is already completed';
    END IF;

    IF _score_a > _score_b THEN
      winner_id := COALESCE(match_data #>> '{players,0,id}', '');
    ELSE
      winner_id := COALESCE(match_data #>> '{players,1,id}', '');
    END IF;

    IF winner_id = '' THEN
      RAISE EXCEPTION 'Could not determine match winner';
    END IF;

    match_data := jsonb_set(match_data, '{score}', score_json, true);
    match_data := jsonb_set(match_data, '{winner}', to_jsonb(winner_id), true);
    match_data := jsonb_set(match_data, '{completed}', 'true'::jsonb, true);
    updated_data := jsonb_set(updated_data, ARRAY['gameSequence', _match_index::text], match_data, false);

    games_len := jsonb_array_length(updated_data -> 'gameSequence');
    next_game_index := games_len;
    FOR i IN 0..(games_len - 1) LOOP
      IF COALESCE(updated_data #>> ARRAY['gameSequence', i::text, 'completed'], 'false') <> 'true' THEN
        next_game_index := i;
        EXIT;
      END IF;
    END LOOP;
    updated_data := jsonb_set(updated_data, '{currentGameIndex}', to_jsonb(next_game_index), true);
  ELSE
    IF _round_index IS NULL OR _round_index < 0 THEN
      RAISE EXCEPTION 'Invalid round index';
    END IF;

    IF ev.data ? 'schedule' OR COALESCE(ev.data ->> 'mode', '') = 'five-player-doubles' THEN
      RAISE EXCEPTION 'Five-player score submissions by regular members are not supported in Phase 1.5A';
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

    IF (match_data ? 'score') AND COALESCE(jsonb_typeof(match_data -> 'score') <> 'null', false) THEN
      RAISE EXCEPTION 'Match already has a score';
    END IF;

    IF COALESCE(match_data ->> 'completed', 'false') = 'true' THEN
      RAISE EXCEPTION 'Match is already completed';
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

    IF COALESCE(match_data #>> '{clubs,0,id}', '') = ''
       AND COALESCE(match_data #>> '{clubs,1,id}', '') = ''
       AND _club_a IS NOT NULL
       AND _club_b IS NOT NULL
       AND COALESCE(_club_a ->> 'id', '') <> ''
       AND COALESCE(_club_b ->> 'id', '') <> ''
    THEN
      match_data := jsonb_set(match_data, '{clubs}', jsonb_build_array(_club_a, _club_b), true);
    END IF;

    updated_data := jsonb_set(updated_data, ARRAY['rounds', _round_index::text, 'matches', _match_index::text], match_data, false);

    IF winner_id <> '' THEN
      pair_scores := COALESCE(round_data -> 'pairScores', '{}'::jsonb);
      IF COALESCE(pair_scores ->> winner_id, '0') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Invalid pair score state';
      END IF;
      previous_wins := COALESCE((pair_scores ->> winner_id)::integer, 0);
      pair_scores := jsonb_set(pair_scores, ARRAY[winner_id], to_jsonb(previous_wins + 1), true);
      updated_data := jsonb_set(updated_data, ARRAY['rounds', _round_index::text, 'pairScores'], pair_scores, true);
    END IF;
  END IF;

  PERFORM set_config('app.submit_tournament_score', 'on', true);
  UPDATE public.evenings
  SET data = updated_data,
      updated_at = now()
  WHERE id = ev.id
  RETURNING data INTO updated_data;

  RETURN updated_data;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_match_score(text, integer, integer, integer, integer, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_match_score(text, integer, integer, integer, integer, jsonb, jsonb) TO authenticated;

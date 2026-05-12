-- Phase 1.5A: allow authenticated team members to submit one first-time score safely.
-- This does not make evenings broadly writable; regular member writes go through
-- public.submit_tournament_score only and are constrained to one missing result.

CREATE OR REPLACE FUNCTION public._is_valid_score_array(_score jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(_score) = 'array'
    AND jsonb_array_length(_score) = 2
    AND COALESCE(_score ->> 0, '') ~ '^[0-9]+$'
    AND COALESCE(_score ->> 1, '') ~ '^[0-9]+$';
$$;

CREATE OR REPLACE FUNCTION public._is_first_time_pairs_score_update(_old_data jsonb, _new_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  old_stripped jsonb := _old_data;
  new_stripped jsonb := _new_data;
  rounds_len integer;
  matches_len integer;
  i integer;
  j integer;
  old_round jsonb;
  new_round jsonb;
  old_match jsonb;
  new_match jsonb;
  old_has_score boolean;
  new_has_score boolean;
  new_winner text;
  old_pair_scores jsonb;
  expected_pair_scores jsonb;
  previous_wins integer;
  candidate_count integer := 0;
BEGIN
  IF COALESCE(_old_data ->> 'type', 'pairs') = 'singles'
     OR COALESCE(_new_data ->> 'type', 'pairs') = 'singles'
  THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(_old_data -> 'rounds') <> 'array'
     OR jsonb_typeof(_new_data -> 'rounds') <> 'array'
  THEN
    RETURN false;
  END IF;

  rounds_len := jsonb_array_length(_old_data -> 'rounds');
  IF jsonb_array_length(_new_data -> 'rounds') <> rounds_len THEN
    RETURN false;
  END IF;

  FOR i IN 0..(rounds_len - 1) LOOP
    old_round := _old_data -> 'rounds' -> i;
    new_round := _new_data -> 'rounds' -> i;

    IF jsonb_typeof(old_round -> 'matches') <> 'array'
       OR jsonb_typeof(new_round -> 'matches') <> 'array'
    THEN
      RETURN false;
    END IF;

    matches_len := jsonb_array_length(old_round -> 'matches');
    IF jsonb_array_length(new_round -> 'matches') <> matches_len THEN
      RETURN false;
    END IF;

    FOR j IN 0..(matches_len - 1) LOOP
      old_match := old_round -> 'matches' -> j;
      new_match := new_round -> 'matches' -> j;
      old_has_score := (old_match ? 'score') AND COALESCE(jsonb_typeof(old_match -> 'score') <> 'null', false);
      new_has_score := (new_match ? 'score') AND COALESCE(jsonb_typeof(new_match -> 'score') <> 'null', false);

      IF old_has_score = false AND new_has_score = true THEN
        candidate_count := candidate_count + 1;
        IF candidate_count > 1 THEN
          RETURN false;
        END IF;

        IF NOT public._is_valid_score_array(new_match -> 'score') THEN
          RETURN false;
        END IF;

        IF COALESCE(new_match ->> 'completed', 'false') <> 'true' THEN
          RETURN false;
        END IF;

        new_winner := COALESCE(new_match ->> 'winner', '');
        IF new_winner <> ''
           AND new_winner <> COALESCE(old_match #>> '{pairs,0,id}', '')
           AND new_winner <> COALESCE(old_match #>> '{pairs,1,id}', '')
        THEN
          RETURN false;
        END IF;

        old_pair_scores := COALESCE(old_round -> 'pairScores', '{}'::jsonb);
        expected_pair_scores := old_pair_scores;
        IF new_winner <> '' THEN
          IF COALESCE(old_pair_scores ->> new_winner, '0') !~ '^[0-9]+$' THEN
            RETURN false;
          END IF;
          previous_wins := COALESCE((old_pair_scores ->> new_winner)::integer, 0);
          expected_pair_scores := jsonb_set(old_pair_scores, ARRAY[new_winner], to_jsonb(previous_wins + 1), true);
        END IF;

        IF COALESCE(new_round -> 'pairScores', '{}'::jsonb) <> expected_pair_scores THEN
          RETURN false;
        END IF;

        old_stripped := old_stripped
          #- ARRAY['rounds', i::text, 'matches', j::text, 'score']
          #- ARRAY['rounds', i::text, 'matches', j::text, 'winner']
          #- ARRAY['rounds', i::text, 'matches', j::text, 'completed']
          #- ARRAY['rounds', i::text, 'pairScores'];
        new_stripped := new_stripped
          #- ARRAY['rounds', i::text, 'matches', j::text, 'score']
          #- ARRAY['rounds', i::text, 'matches', j::text, 'winner']
          #- ARRAY['rounds', i::text, 'matches', j::text, 'completed']
          #- ARRAY['rounds', i::text, 'pairScores'];
      END IF;
    END LOOP;
  END LOOP;

  RETURN candidate_count = 1 AND old_stripped = new_stripped;
END;
$$;

CREATE OR REPLACE FUNCTION public._is_first_time_singles_score_update(_old_data jsonb, _new_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  old_stripped jsonb := _old_data;
  new_stripped jsonb := _new_data;
  games_len integer;
  i integer;
  old_game jsonb;
  new_game jsonb;
  old_has_score boolean;
  new_has_score boolean;
  new_winner text;
  candidate_count integer := 0;
BEGIN
  IF COALESCE(_old_data ->> 'type', 'pairs') <> 'singles'
     OR COALESCE(_new_data ->> 'type', 'pairs') <> 'singles'
  THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(_old_data -> 'gameSequence') <> 'array'
     OR jsonb_typeof(_new_data -> 'gameSequence') <> 'array'
  THEN
    RETURN false;
  END IF;

  games_len := jsonb_array_length(_old_data -> 'gameSequence');
  IF jsonb_array_length(_new_data -> 'gameSequence') <> games_len THEN
    RETURN false;
  END IF;

  FOR i IN 0..(games_len - 1) LOOP
    old_game := _old_data -> 'gameSequence' -> i;
    new_game := _new_data -> 'gameSequence' -> i;
    old_has_score := (old_game ? 'score') AND COALESCE(jsonb_typeof(old_game -> 'score') <> 'null', false);
    new_has_score := (new_game ? 'score') AND COALESCE(jsonb_typeof(new_game -> 'score') <> 'null', false);

    IF old_has_score = false AND new_has_score = true THEN
      candidate_count := candidate_count + 1;
      IF candidate_count > 1 THEN
        RETURN false;
      END IF;

      IF NOT public._is_valid_score_array(new_game -> 'score') THEN
        RETURN false;
      END IF;

      IF COALESCE(new_game ->> 'completed', 'false') <> 'true' THEN
        RETURN false;
      END IF;

      new_winner := COALESCE(new_game ->> 'winner', '');
      IF new_winner = ''
         OR (
           new_winner <> COALESCE(old_game #>> '{players,0,id}', '')
           AND new_winner <> COALESCE(old_game #>> '{players,1,id}', '')
         )
      THEN
        RETURN false;
      END IF;

      old_stripped := old_stripped
        #- ARRAY['gameSequence', i::text, 'score']
        #- ARRAY['gameSequence', i::text, 'winner']
        #- ARRAY['gameSequence', i::text, 'completed']
        #- ARRAY['currentGameIndex'];
      new_stripped := new_stripped
        #- ARRAY['gameSequence', i::text, 'score']
        #- ARRAY['gameSequence', i::text, 'winner']
        #- ARRAY['gameSequence', i::text, 'completed']
        #- ARRAY['currentGameIndex'];
    END IF;
  END LOOP;

  RETURN candidate_count = 1 AND old_stripped = new_stripped;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_evenings_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  is_owner boolean;
  is_editor boolean;
BEGIN
  IF current_setting('app.submit_tournament_score', true) = 'on' THEN
    IF (NEW.id IS DISTINCT FROM OLD.id)
       OR (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
       OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
    THEN
      RAISE EXCEPTION 'Score submission can only update evening data';
    END IF;
    RETURN NEW;
  END IF;

  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);

  IF is_owner THEN
    RETURN NEW;
  END IF;

  is_editor := EXISTS (
    SELECT 1
    FROM public.evening_members m
    WHERE m.evening_id = OLD.id
      AND m.user_id = uid
      AND m.role = 'editor'
  );

  IF is_editor THEN
    IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
    THEN
      RAISE EXCEPTION 'Editors cannot modify owner, team, or share code';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the owner or editors can modify evening records';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_tournament_score(_evening_id text, _data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.evenings%ROWTYPE;
  is_owner_admin boolean := false;
  is_team_member boolean := false;
  is_evening_member boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
      WHERE tm.team_id = ev.team_id
        AND tm.user_id = uid
        AND COALESCE(tm.member_mode, 'unset') <> 'spectator'
    )
    INTO is_team_member;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.evening_members em
    WHERE em.evening_id = ev.id
      AND em.user_id = uid
      AND em.role IN ('owner', 'editor', 'member')
  )
  INTO is_evening_member;

  IF NOT (is_owner_admin OR is_team_member OR is_evening_member) THEN
    RAISE EXCEPTION 'Not allowed to submit a score for this evening';
  END IF;

  IF is_owner_admin THEN
    PERFORM set_config('app.submit_tournament_score', 'on', true);
    UPDATE public.evenings
    SET data = _data,
        updated_at = now()
    WHERE id = ev.id
    RETURNING data INTO ev.data;

    RETURN ev.data;
  END IF;

  IF _data ? 'schedule' OR COALESCE(_data ->> 'mode', '') = 'five-player-doubles' THEN
    RAISE EXCEPTION 'Five-player score submissions by regular members are not supported in Phase 1.5A';
  END IF;

  IF NOT (
    public._is_first_time_pairs_score_update(ev.data, _data)
    OR public._is_first_time_singles_score_update(ev.data, _data)
  ) THEN
    RAISE EXCEPTION 'Only one first-time score submission is allowed';
  END IF;

  PERFORM set_config('app.submit_tournament_score', 'on', true);
  UPDATE public.evenings
  SET data = _data,
      updated_at = now()
  WHERE id = ev.id
  RETURNING data INTO ev.data;

  RETURN ev.data;
END;
$$;

REVOKE ALL ON FUNCTION public._is_valid_score_array(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._is_first_time_pairs_score_update(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._is_first_time_singles_score_update(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_tournament_score(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tournament_score(text, jsonb) TO authenticated;

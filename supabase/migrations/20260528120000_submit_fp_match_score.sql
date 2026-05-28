create or replace function public.submit_fp_match_score(
  _evening_id text,
  _match_global_index integer,
  _score_a integer,
  _score_b integer,
  _club_a jsonb,
  _club_b jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.evenings%rowtype;
  is_owner_admin boolean := false;
  is_playing_member boolean := false;
  updated_data jsonb;
  match_data jsonb;
  schedule_len integer;
  next_index integer;
  i integer;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if _match_global_index is null or _match_global_index < 0 then
    raise exception 'Invalid match index';
  end if;

  if _score_a is null or _score_b is null or _score_a < 0 or _score_b < 0 then
    raise exception 'Invalid score';
  end if;

  select *
  into ev
  from public.evenings
  where id = _evening_id
  for update;

  if not found then
    raise exception 'Evening not found';
  end if;

  if coalesce(ev.data ->> 'completed', 'false') = 'true' then
    raise exception 'Cannot update a completed evening';
  end if;

  if not (ev.data ? 'schedule') then
    raise exception 'This is not a five-player evening';
  end if;

  is_owner_admin := ev.owner_id = uid;

  if ev.team_id is not null then
    select exists (
      select 1
      from public.team_members tm
      where tm.team_id = ev.team_id
        and tm.user_id = uid
        and tm.role in ('owner', 'admin')
    )
    into is_owner_admin;

    is_owner_admin := is_owner_admin or ev.owner_id = uid;

    select exists (
      select 1
      from public.team_members tm
      join public.player_accounts pa
        on pa.team_id = tm.team_id
       and pa.user_id = tm.user_id
      where tm.team_id = ev.team_id
        and tm.user_id = uid
        and coalesce(tm.member_mode, 'unset') <> 'spectator'
        and exists (
          select 1
          from jsonb_array_elements(coalesce(ev.data -> 'players', '[]'::jsonb)) p
          where p ->> 'id' = pa.player_id::text
        )
    )
    into is_playing_member;
  end if;

  if not (is_owner_admin or is_playing_member) then
    raise exception 'Not allowed to submit a score for this evening';
  end if;

  updated_data := ev.data;

  if jsonb_typeof(updated_data -> 'schedule') <> 'array' then
    raise exception 'Invalid schedule';
  end if;

  schedule_len := jsonb_array_length(updated_data -> 'schedule');

  if _match_global_index >= schedule_len then
    raise exception 'Target match not found';
  end if;

  match_data := updated_data -> 'schedule' -> _match_global_index;

  if coalesce(match_data ->> 'completed', 'false') = 'true' then
    raise exception 'Match is already completed';
  end if;

  if coalesce(_club_a ->> 'id', '') = '' or coalesce(_club_b ->> 'id', '') = '' then
    raise exception 'Missing clubs';
  end if;

  match_data := jsonb_set(match_data, '{clubA}', _club_a, true);
  match_data := jsonb_set(match_data, '{clubB}', _club_b, true);
  match_data := jsonb_set(match_data, '{scoreA}', to_jsonb(_score_a), true);
  match_data := jsonb_set(match_data, '{scoreB}', to_jsonb(_score_b), true);
  match_data := jsonb_set(match_data, '{completed}', 'true'::jsonb, true);

  updated_data := jsonb_set(
    updated_data,
    array['schedule', _match_global_index::text],
    match_data,
    false
  );

  next_index := schedule_len;

  for i in 0..(schedule_len - 1) loop
    if coalesce(updated_data #>> array['schedule', i::text, 'completed'], 'false') <> 'true' then
      next_index := i;
      exit;
    end if;
  end loop;

  if next_index >= schedule_len then
    updated_data := jsonb_set(updated_data, '{completed}', 'true'::jsonb, true);
    updated_data := jsonb_set(updated_data, '{completedAt}', to_jsonb(now()::text), true);
  else
    updated_data := jsonb_set(updated_data, '{currentMatchIndex}', to_jsonb(next_index), true);
  end if;

  update public.evenings
  set data = updated_data,
      updated_at = now()
  where id = ev.id
  returning data into updated_data;

  return updated_data;
end;
$$;

revoke all on function public.submit_fp_match_score(text, integer, integer, integer, integer, jsonb, jsonb) from public, anon;
grant execute on function public.submit_fp_match_score(text, integer, integer, integer, integer, jsonb, jsonb) to authenticated;
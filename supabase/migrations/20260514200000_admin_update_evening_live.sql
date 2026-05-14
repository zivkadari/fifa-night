-- Phase 1.5 live sync fix:
-- Owner/admin safe RPC for updating live tournament state.
-- This is used for full tournament updates by authorized users only.
-- Regular members should not use this path for edits.

create or replace function public.update_evening_live_admin(
  _evening_id text,
  _data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_evening public.evenings%rowtype;
  v_is_team_admin boolean := false;
  v_is_evening_editor boolean := false;
  v_updated_data jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_evening
  from public.evenings
  where id = _evening_id
  for update;

  if not found then
    raise exception 'Evening not found';
  end if;

  if coalesce((v_evening.data ->> 'cancelled')::boolean, false) = true then
    raise exception 'Tournament is cancelled';
  end if;

  -- Owner of the evening can update.
  if v_evening.owner_id = v_user_id then
    v_is_team_admin := true;
  end if;

  -- Team owner/admin can update team evenings.
  if not v_is_team_admin and v_evening.team_id is not null then
    select exists (
      select 1
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.team_id = v_evening.team_id
        and tm.user_id = v_user_id
        and (
          tm.role in ('owner', 'admin')
          or t.owner_id = v_user_id
        )
    )
    into v_is_team_admin;
  end if;

  -- Existing evening_members editor/owner can update if the table exists and is populated.
  if not v_is_team_admin then
    select exists (
      select 1
      from public.evening_members em
      where em.evening_id = _evening_id
        and em.user_id = v_user_id
        and em.role in ('owner', 'admin', 'editor')
    )
    into v_is_evening_editor;
  end if;

  if not (v_is_team_admin or v_is_evening_editor) then
    raise exception 'Not allowed to update this tournament';
  end if;

  update public.evenings
  set
    data = _data,
    updated_at = now()
  where id = _evening_id
  returning data
  into v_updated_data;

  return v_updated_data;
end;
$$;

revoke all on function public.update_evening_live_admin(text, jsonb) from public;
revoke all on function public.update_evening_live_admin(text, jsonb) from anon;
grant execute on function public.update_evening_live_admin(text, jsonb) to authenticated;
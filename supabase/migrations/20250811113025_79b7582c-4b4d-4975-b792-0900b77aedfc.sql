-- Helper functions to avoid RLS recursion between teams, team_members, and team_players
create or replace function public.is_team_owner(uid uuid, tid uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.teams t
    where t.id = tid and t.owner_id = uid
  );
$$;

create or replace function public.is_team_member(uid uuid, tid uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = tid and tm.user_id = uid
  );
$$;

-- TEAMS policies
drop policy if exists "Teams: admin delete only" on public.teams;
drop policy if exists "Teams: insert own or admin" on public.teams;
drop policy if exists "Teams: select owner, members, or admin" on public.teams;
drop policy if exists "Teams: update owner, members, or admin" on public.teams;

create policy "Teams: admin delete only"
on public.teams
for delete
using (public.has_role(auth.uid(), 'admin'));

create policy "Teams: insert own or admin"
on public.teams
for insert
with check ((owner_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));

create policy "Teams: select owner, members, or admin"
on public.teams
for select
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), id)
  or public.is_team_member(auth.uid(), id)
);

create policy "Teams: update owner, members, or admin"
on public.teams
for update
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), id)
  or public.is_team_member(auth.uid(), id)
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), id)
  or public.is_team_member(auth.uid(), id)
);

-- TEAM_MEMBERS policies
drop policy if exists "TeamMembers: delete by owner or admin" on public.team_members;
drop policy if exists "TeamMembers: insert by owner or admin" on public.team_members;
drop policy if exists "TeamMembers: select visible to team or admin" on public.team_members;

create policy "TeamMembers: delete by owner or admin"
on public.team_members
for delete
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
);

create policy "TeamMembers: insert by owner or admin"
on public.team_members
for insert
with check (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
);

create policy "TeamMembers: select visible to team or admin"
on public.team_members
for select
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
  or public.is_team_member(auth.uid(), team_id)
);

-- TEAM_PLAYERS policies
drop policy if exists "TeamPlayers: delete by owner or admin" on public.team_players;
drop policy if exists "TeamPlayers: insert by owner or admin" on public.team_players;
drop policy if exists "TeamPlayers: select visible to team or admin" on public.team_players;

create policy "TeamPlayers: delete by owner or admin"
on public.team_players
for delete
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
);

create policy "TeamPlayers: insert by owner or admin"
on public.team_players
for insert
with check (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
);

create policy "TeamPlayers: select visible to team or admin"
on public.team_players
for select
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_team_owner(auth.uid(), team_id)
  or public.is_team_member(auth.uid(), team_id)
);

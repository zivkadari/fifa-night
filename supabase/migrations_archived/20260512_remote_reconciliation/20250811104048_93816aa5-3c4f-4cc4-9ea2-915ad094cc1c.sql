-- Create teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_teams_updated_at
before update on public.teams
for each row execute function public.update_updated_at_column();

alter table public.teams enable row level security;

create policy "Teams: insert own or admin"
  on public.teams for insert
  with check ((owner_id = auth.uid()) or has_role(auth.uid(), 'admin'));

create policy "Teams: select owner, members, or admin"
  on public.teams for select
  using (
    (owner_id = auth.uid())
    or has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.team_members m
      where m.team_id = teams.id and m.user_id = auth.uid()
    )
  );

create policy "Teams: update owner, members, or admin"
  on public.teams for update
  using (
    (owner_id = auth.uid())
    or has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.team_members m
      where m.team_id = teams.id and m.user_id = auth.uid()
    )
  )
  with check (
    (owner_id = auth.uid())
    or has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.team_members m
      where m.team_id = teams.id and m.user_id = auth.uid()
    )
  );

create policy "Teams: admin delete only"
  on public.teams for delete
  using (has_role(auth.uid(), 'admin'));

-- Team members table
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key(team_id, user_id)
);

alter table public.team_members enable row level security;

create policy "TeamMembers: select visible to team or admin"
  on public.team_members for select
  using (
    has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm where tm.team_id = team_members.team_id and tm.user_id = auth.uid()
    )
  );

create policy "TeamMembers: insert by owner or admin"
  on public.team_members for insert
  with check (
    has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

create policy "TeamMembers: delete by owner or admin"
  on public.team_members for delete
  using (
    has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- Owner auto-membership trigger
create or replace function public.add_team_owner_membership()
returns trigger as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;$$ language plpgsql;

create trigger add_team_owner_membership_trg
after insert on public.teams
for each row execute function public.add_team_owner_membership();

-- Players registry
create table public.players (
  id text primary key,
  display_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_players_updated_at
before update on public.players
for each row execute function public.update_updated_at_column();

alter table public.players enable row level security;

create policy "Players: public select"
  on public.players for select
  using (true);

create policy "Players: insert by owner or admin"
  on public.players for insert
  with check ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'));

create policy "Players: update by owner or admin"
  on public.players for update
  using ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'))
  with check ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'));

-- Team-Players
create table public.team_players (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(team_id, player_id)
);

alter table public.team_players enable row level security;

create policy "TeamPlayers: select visible to team or admin"
  on public.team_players for select
  using (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.team_id = team_players.team_id and tm.user_id = auth.uid())
  );

create policy "TeamPlayers: insert by owner or admin"
  on public.team_players for insert
  with check (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
  );

create policy "TeamPlayers: delete by owner or admin"
  on public.team_players for delete
  using (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
  );

-- Indexes
create index idx_team_members_team on public.team_members(team_id);
create index idx_team_players_team on public.team_players(team_id);
create index idx_players_name on public.players(lower(display_name));

-- Link evenings to teams
alter table public.evenings add column team_id uuid references public.teams(id) on delete set null;
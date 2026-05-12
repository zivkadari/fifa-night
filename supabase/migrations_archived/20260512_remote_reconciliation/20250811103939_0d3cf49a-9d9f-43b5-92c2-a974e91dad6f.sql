-- 1) Teams for organizing evenings
-- Create teams table
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure updated_at trigger function exists (already in project)
-- Create trigger for teams
create or replace trigger update_teams_updated_at
before update on public.teams
for each row execute function public.update_updated_at_column();

-- Enable RLS
alter table public.teams enable row level security;

-- Policies for teams
create policy if not exists "Teams: insert own or admin"
  on public.teams for insert
  with check ((owner_id = auth.uid()) or has_role(auth.uid(), 'admin'));

create policy if not exists "Teams: select owner, members, or admin"
  on public.teams for select
  using (
    (owner_id = auth.uid())
    or has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.team_members m
      where m.team_id = teams.id and m.user_id = auth.uid()
    )
  );

create policy if not exists "Teams: update owner, members, or admin"
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

create policy if not exists "Teams: admin delete only"
  on public.teams for delete
  using (has_role(auth.uid(), 'admin'));

-- Team members table (auth-linked)
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key(team_id, user_id)
);

alter table public.team_members enable row level security;

-- Policies for team_members
create policy if not exists "TeamMembers: select visible to team or admin"
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

create policy if not exists "TeamMembers: insert by owner or admin"
  on public.team_members for insert
  with check (
    has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

create policy if not exists "TeamMembers: delete by owner or admin"
  on public.team_members for delete
  using (
    has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- Auto-add owner to team_members on team creation
create or replace function public.add_team_owner_membership()
returns trigger as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;$$ language plpgsql;

create or replace trigger add_team_owner_membership_trg
after insert on public.teams
for each row execute function public.add_team_owner_membership();

-- 2) Players registry (by name, not auth user)
create table if not exists public.players (
  id text primary key,
  display_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger update_players_updated_at
before update on public.players
for each row execute function public.update_updated_at_column();

alter table public.players enable row level security;

-- RLS for players
create policy if not exists "Players: public select"
  on public.players for select
  using (true);

create policy if not exists "Players: insert by owner or admin"
  on public.players for insert
  with check ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'));

create policy if not exists "Players: update by owner or admin"
  on public.players for update
  using ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'))
  with check ((created_by = auth.uid()) or has_role(auth.uid(), 'admin'));

-- 3) Team-Players junction
create table if not exists public.team_players (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(team_id, player_id)
);

alter table public.team_players enable row level security;

create policy if not exists "TeamPlayers: select visible to team or admin"
  on public.team_players for select
  using (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.team_id = team_players.team_id and tm.user_id = auth.uid())
  );

create policy if not exists "TeamPlayers: insert by owner or admin"
  on public.team_players for insert
  with check (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
  );

create policy if not exists "TeamPlayers: delete by owner or admin"
  on public.team_players for delete
  using (
    has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teams t where t.id = team_players.team_id and t.owner_id = auth.uid())
  );

-- Helpful indexes
create index if not exists idx_team_members_team on public.team_members(team_id);
create index if not exists idx_team_players_team on public.team_players(team_id);
create index if not exists idx_players_name on public.players(lower(display_name));

-- 4) Link evenings to teams
alter table public.evenings add column if not exists team_id uuid references public.teams(id) on delete set null;
-- Keep existing RLS for evenings; no change needed

-- Create evenings table
create table if not exists public.evenings (
  id text primary key,
  owner_email text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Ensure updated_at is refreshed on updates
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_evenings_updated_at
before update on public.evenings
for each row execute function public.set_updated_at();

-- Enable RLS with permissive policies for now (public shared data)
alter table public.evenings enable row level security;

-- Allow anyone to read evenings
create policy if not exists "Allow public read"
  on public.evenings
  for select
  using (true);

-- Allow anyone to insert evenings (no auth yet)
create policy if not exists "Allow public insert"
  on public.evenings
  for insert
  with check (true);

-- Allow anyone to update evenings (no auth yet)
create policy if not exists "Allow public update"
  on public.evenings
  for update
  using (true);

-- Allow anyone to delete evenings (can be tightened later with auth)
create policy if not exists "Allow public delete"
  on public.evenings
  for delete
  using (true);

-- Realtime configuration
alter table public.evenings replica identity full;
alter publication supabase_realtime add table public.evenings;

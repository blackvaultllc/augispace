create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  score numeric,
  report jsonb,
  created_at timestamptz not null default now()
);
create index if not exists investigations_user_created_idx
  on public.investigations (user_id, created_at desc);

create table if not exists public.ip_dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip text not null,
  report jsonb,
  notes text,
  lookup_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ip)
);
alter table public.ip_dossiers
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
create index if not exists ip_dossiers_user_updated_idx
  on public.ip_dossiers (user_id, updated_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.investigations enable row level security;
alter table public.ip_dossiers enable row level security;
alter table public.assistant_messages enable row level security;

drop policy if exists "own investigations" on public.investigations;
create policy "own investigations" on public.investigations
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own dossiers" on public.ip_dossiers;
create policy "own dossiers" on public.ip_dossiers
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own assistant messages" on public.assistant_messages;
create policy "own assistant messages" on public.assistant_messages
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
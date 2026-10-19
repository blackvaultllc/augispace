create table if not exists public.incident_events (
  id text primary key,
  occurred_on date,
  occurred_year integer,
  title text not null,
  summary text,
  victim text,
  country text,
  latitude double precision not null,
  longitude double precision not null,
  category text not null default 'breach',
  confidence text not null default 'confirmed',
  source_name text not null,
  source_url text not null check (source_url ~* '^https?://'),
  created_at timestamptz not null default now()
);

create index if not exists incident_events_year_idx on public.incident_events (occurred_year desc);
create index if not exists incident_events_country_idx on public.incident_events (country);

alter table public.incident_events enable row level security;

drop policy if exists "signed-in users read incidents" on public.incident_events;
create policy "signed-in users read incidents" on public.incident_events
  for select to authenticated using (true);

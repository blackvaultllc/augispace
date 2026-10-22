-- Food truck tracker: verified operators, public listings, live locations, community engagement.

create table if not exists public.food_trucks (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  license_number text not null,
  license_state text not null,
  cuisine text,
  description text,
  truck_photo_url text,
  menu_photo_url text,
  verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_id)
);

-- Current public location (null = not on the map right now).
create table if not exists public.food_truck_locations (
  truck_id uuid primary key references public.food_trucks(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  place_note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Community comments. Reactions stored as a simple emoji tally per comment is
-- handled by a separate table to keep counting cheap.
create table if not exists public.food_truck_comments (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.food_trucks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  emoji text,
  created_at timestamptz not null default now()
);
create index if not exists food_truck_comments_truck_idx on public.food_truck_comments (truck_id, created_at);

alter table public.food_trucks enable row level security;
alter table public.food_truck_locations enable row level security;
alter table public.food_truck_comments enable row level security;

-- Public can read trucks, locations, and comments.
drop policy if exists "public read trucks" on public.food_trucks;
create policy "public read trucks" on public.food_trucks for select using (true);

drop policy if exists "public read locations" on public.food_truck_locations;
create policy "public read locations" on public.food_truck_locations for select using (true);

drop policy if exists "public read comments" on public.food_truck_comments;
create policy "public read comments" on public.food_truck_comments for select using (true);

-- Operators manage their own truck and location.
drop policy if exists "operator writes truck" on public.food_trucks;
create policy "operator writes truck" on public.food_trucks
  for all to authenticated using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

drop policy if exists "operator writes location" on public.food_truck_locations;
create policy "operator writes location" on public.food_truck_locations
  for all to authenticated
  using (exists (select 1 from public.food_trucks where id = truck_id and operator_id = auth.uid()))
  with check (exists (select 1 from public.food_trucks where id = truck_id and operator_id = auth.uid()));

-- Any signed-in member can comment on a truck.
drop policy if exists "members comment" on public.food_truck_comments;
create policy "members comment" on public.food_truck_comments
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "author deletes comment" on public.food_truck_comments;
create policy "author deletes comment" on public.food_truck_comments
  for delete to authenticated using (author_id = auth.uid());

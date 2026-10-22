-- Holiday calendar & seasonal experience.
--
-- Read access model: the theme/settings tables are written by the server
-- (direct pool) only. Public pages read holiday data through the Next.js
-- server (direct pool or RLS-filtered views), never from the browser.

-- 1. Holidays: dates, regions, recurrence, attribution, admin control.
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  -- fixed = same date every year; easter_relative / lunar etc. computed per
  -- year by the seeding process (stored as concrete dates for a cycle).
  recurrence text not null default 'fixed' check (recurrence in ('fixed','manual')),
  month int check (month between 1 and 12),
  day int check (day between 1 and 31),
  -- concrete next occurrence (recomputed by seed/refresh; movable holidays
  -- are updated manually or by a maintenance task, not computed in SQL).
  occurrence_date date not null,
  regions text[] not null default '{US}',
  source_ref text not null default 'Admin-entered',
  theme jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists holidays_date_idx on public.holidays (occurrence_date, enabled);

-- 2. Seasonal themes (radar assets, page banners). Separate from location
--    and vendor data by design; keyed by holiday slug.
create table if not exists public.holiday_themes (
  holiday_slug text primary key references public.holidays(slug) on delete cascade,
  radar_marker text not null default 'default' check (radar_marker in ('default','pumpkin','snowflake','heart','firework','star','leaf','clover','flag')),
  accent_color text not null default '#8ce8dc',
  banner_emoji text not null default '',
  page_copy text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 3. Admin-configured holiday page content (activities, resources, notes).
create table if not exists public.holiday_content (
  holiday_slug text primary key references public.holidays(slug) on delete cascade,
  body_md text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- RLS deny-all at the API layer; server pages use the direct pool.
alter table public.holidays enable row level security;
alter table public.holiday_themes enable row level security;
alter table public.holiday_content enable row level security;

-- 4. Seed: the 2026-2027 cycle of widely observed US holidays + seasonal
--    events, each with a source attribution. Movable holidays carry their
--    known next dates; the owner can correct any of them in the admin UI.
--    Idempotent: only inserts missing slugs, never overwrites admin edits.
insert into public.holidays (slug, name, recurrence, month, day, occurrence_date, regions, source_ref, enabled) values
  ('halloween', 'Halloween', 'fixed', 10, 31, '2026-10-31', '{US}', 'Widely observed US cultural holiday (fixed date)', true),
  ('thanksgiving', 'Thanksgiving', 'fixed', 11, 26, '2026-11-26', '{US}', 'Fourth Thursday of November (US federal); 2026 date', true),
  ('christmas', 'Christmas Day', 'fixed', 12, 25, '2026-12-25', '{US}', 'US federal holiday (fixed date)', true),
  ('new_years_day', 'New Year''s Day', 'fixed', 1, 1, '2027-01-01', '{US}', 'US federal holiday (fixed date)', true),
  ('mlk_day', 'Martin Luther King Jr. Day', 'fixed', 1, 18, '2027-01-18', '{US}', 'Third Monday of January (US federal); 2027 date', true),
  ('presidents_day', 'Presidents'' Day', 'fixed', 2, 15, '2027-02-15', '{US}', 'Third Monday of February (US federal); 2027 date', true),
  ('memorial_day', 'Memorial Day', 'fixed', 5, 31, '2027-05-31', '{US}', 'Last Monday of May (US federal); 2027 date', true),
  ('junkanoo', 'Junkanoo', 'fixed', 12, 26, '2026-12-26', '{US}', 'Cultural celebration observed in parts of the Gulf Coast (fixed date)', true),
  ('junenth', 'Juneteenth', 'fixed', 6, 19, '2027-06-19', '{US}', 'US federal holiday (fixed date)', true),
  ('independence_day', 'Independence Day', 'fixed', 7, 4, '2027-07-04', '{US}', 'US federal holiday (fixed date)', true)
on conflict (slug) do nothing;

-- Seasonal themes: pumpkin markers for the Halloween window (directive
-- requirement), sensible defaults for others.
insert into public.holiday_themes (holiday_slug, radar_marker, accent_color, banner_emoji, page_copy) values
  ('halloween', 'pumpkin', '#ff9a3c', '🎃', 'Spooky season is on the radar — find trucks serving up treats.'),
  ('thanksgiving', 'leaf', '#d8a24a', '🦃', 'Plates and pies on the move — trucks feeding the holiday crowd.'),
  ('christmas', 'snowflake', '#7ab8ff', '🎄', 'Lights, cocoa, and late-night bites on the map.'),
  ('new_years_day', 'firework', '#9a8bfa', '🎆', 'First meals of the year, tracked live.'),
  ('junkanoo', 'star', '#35e0c4', '🥁', 'Parades and festival food across the Gulf Coast.'),
  ('juneteenth', 'star', '#35e0c4', '✊', 'Community celebrations and cookouts, mapped.'),
  ('independence_day', 'flag', '#f19184', '🎆', 'Fireworks nights and parade-day food, live.')
on conflict (holiday_slug) do nothing;

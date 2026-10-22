-- Site media: owner-uploaded videos/images shown on public pages.
-- Placement keys map to slots in the UI, e.g. truck_hero_video.

create table if not exists public.media_assets (
  placement text primary key,
  url text not null,
  kind text not null check (kind in ('image', 'video')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.media_assets enable row level security;

-- Public pages read; only the server route (service role / owner-verified) writes.
drop policy if exists "public read media" on public.media_assets;
create policy "public read media" on public.media_assets for select using (true);

-- Public storage bucket for uploaded media.
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

drop policy if exists "auth upload site media" on storage.objects;
create policy "auth upload site media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media');

drop policy if exists "auth replace site media" on storage.objects;
create policy "auth replace site media" on storage.objects
  for update to authenticated using (bucket_id = 'site-media');

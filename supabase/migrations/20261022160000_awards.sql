-- Awards & Achievements: private per-user accomplishment records + files.
-- Private by default; ownership enforced by RLS and by server-side checks.

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  issuer text check (issuer is null or length(issuer) <= 160),
  category text not null default 'other'
    check (category in ('academic','graduation','athletics','professional','creative','community','other')),
  description text check (description is null or length(description) <= 2000),
  received_on date,
  year_group int,
  school_year text,
  tags text[] not null default '{}',
  file_path text,               -- storage path inside the private bucket
  file_name text,               -- original display name (sanitized)
  file_kind text check (file_kind in ('image','document') or file_kind is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists awards_user_created_idx on public.awards (user_id, created_at desc);
create index if not exists awards_user_category_idx on public.awards (user_id, category);
create index if not exists awards_user_received_idx on public.awards (user_id, received_on desc);

alter table public.awards enable row level security;

drop policy if exists "awards owner all" on public.awards;
create policy "awards owner all" on public.awards
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private storage bucket: signed URLs only, no public access.
insert into storage.buckets (id, name, public)
values ('award-files', 'award-files', false)
on conflict (id) do nothing;

drop policy if exists "award files owner all" on storage.objects;
create policy "award files owner all" on storage.objects
  for all to authenticated
  using (bucket_id = 'award-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'award-files' and (storage.foldername(name))[1] = auth.uid()::text);

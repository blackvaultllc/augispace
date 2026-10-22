-- Roles, member profiles (billing tier), staff invites, and encrypted integration settings.

-- 1. app_users: role registry (owner / staff / member)
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'staff', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_users_role_idx on public.app_users (role);

-- 2. staff_invites: owner invites an email before that person signs up.
create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'staff' check (role in ('staff', 'member')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

-- 3. profiles: public-facing tier used by subscription billing.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  tier text not null default 'observer' check (tier in ('observer', 'analyst', 'command')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. integration_settings: encrypted server-side secrets (API keys).
create table if not exists public.integration_settings (
  key text primary key,
  value_enc text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.staff_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.integration_settings enable row level security;

-- Helper: role of the current user (security definer so policies can read it).
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.app_users where user_id = auth.uid() $$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_role() in ('owner', 'staff'), false) $$;

-- app_users policies -------------------------------------------------------
drop policy if exists "read app users" on public.app_users;
create policy "read app users" on public.app_users
  for select to authenticated using (true);

drop policy if exists "self register" on public.app_users;
create policy "self register" on public.app_users
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and email = coalesce(auth.jwt() ->> 'email', '')
    and (
      role = 'member'
      or (role = 'owner' and email = 'blackhatterxvi@gmail.com')
      or (role = 'staff' and exists (
        select 1 from public.staff_invites
        where email = coalesce(auth.jwt() ->> 'email', '')
          and status = 'pending'
      ))
    )
  );

drop policy if exists "admins manage roles" on public.app_users;
create policy "admins manage roles" on public.app_users
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- staff_invites policies ---------------------------------------------------
drop policy if exists "admins read invites" on public.staff_invites;
create policy "admins read invites" on public.staff_invites
  for select to authenticated
  using (public.is_app_admin() or email = coalesce(auth.jwt() ->> 'email', ''));

drop policy if exists "admins write invites" on public.staff_invites;
create policy "admins write invites" on public.staff_invites
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- profiles policies --------------------------------------------------------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid() and email = coalesce(auth.jwt() ->> 'email', ''));

-- Tier changes come only from the Stripe webhook (service role bypasses RLS).

-- integration_settings policies --------------------------------------------
-- Encrypted values are never readable through the PostgREST API; only the
-- Node server (service role / direct pool) decrypts them.
drop policy if exists "no direct secret reads" on public.integration_settings;
create policy "no direct secret reads" on public.integration_settings
  for select to authenticated using (false);

create table if not exists public."user" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "role" text not null default 'member',
  "tier" text not null default 'observer',
  "stripeCustomerId" text unique,
  "stripeSubscriptionId" text unique,
  "stripeSubscriptionStatus" text
);

create table if not exists public."session" (
  "id" text primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references public."user"("id") on delete cascade
);
create index if not exists session_user_idx on public."session" ("userId");

create table if not exists public."account" (
  "id" text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references public."user"("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists account_user_idx on public."account" ("userId");

create table if not exists public."verification" (
  "id" text primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

create table if not exists public."augi_assistant_message" (
  "id" text primary key,
  "userId" text not null references public."user"("id") on delete cascade,
  "role" text not null,
  "content" text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public."augi_investigation" (
  "id" text primary key,
  "userId" text not null,
  "domain" text not null,
  "score" integer not null,
  "report" jsonb not null,
  "createdAt" timestamptz not null default now()
);

-- These hold sessions, tokens and Stripe IDs. Turning on RLS with no
-- policies blocks Supabase's public API from reading them. Better-auth
-- connects directly to Postgres as the owner, so it is not affected.
alter table public."user" enable row level security;
alter table public."session" enable row level security;
alter table public."account" enable row level security;
alter table public."verification" enable row level security;
alter table public."augi_assistant_message" enable row level security;
alter table public."augi_investigation" enable row level security;
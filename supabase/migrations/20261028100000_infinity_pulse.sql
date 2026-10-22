-- Infinity Pulse: trend intelligence & verified publishing.
-- Access model: workflow tables are owner-only (RLS deny-all, server uses the
-- direct pool, same pattern as the President's Office tables). Public article
-- reads go through Next.js server pages that filter to status='published',
-- never through the API.

-- 1. Cached provider responses (bounded, deduplicating).
create table if not exists public.pulse_provider_cache (
  provider text not null,
  category text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (provider, category)
);
create index if not exists pulse_provider_cache_fetched_idx
  on public.pulse_provider_cache (fetched_at desc);

-- 2. Trend observations: one row per headline/observation, deduplicated by
--    (category, normalized title hash) so repeated refreshes do not grow
--    unbounded; old rows are pruned at write time.
create table if not exists public.pulse_trends (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  provider text not null,
  external_key text not null,
  title text not null,
  url text not null,
  source_label text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  region text,
  related jsonb not null default '[]',
  unique (category, external_key)
);
create index if not exists pulse_trends_lookup_idx
  on public.pulse_trends (category, retrieved_at desc);

-- 3. Articles: draft lifecycle with explicit human approval gate.
--    status: draft -> in_review -> approved -> published -> withdrawn/archived
create table if not exists public.pulse_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  headline text not null,
  alt_headline text,
  summary text not null,
  body_md text not null,
  -- AI/generated narrative is stored separately from sourced facts so the
  -- distinction survives every transformation.
  analysis_md text not null default '',
  seo_title text not null default '',
  meta_description text not null default '',
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','published','withdrawn','archived')),
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pulse_articles_public_idx
  on public.pulse_articles (published_at desc) where status = 'published';
create index if not exists pulse_articles_status_idx on public.pulse_articles (status, updated_at desc);

-- 4. Source references attached to each article (traceability).
create table if not exists public.pulse_article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.pulse_articles(id) on delete cascade,
  title text not null,
  url text not null,
  publisher text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  claim_note text not null default ''
);

-- 5. Revisions: every saved edit preserves the prior body before overwriting.
create table if not exists public.pulse_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.pulse_articles(id) on delete cascade,
  version int not null,
  headline text not null,
  summary text not null,
  body_md text not null,
  analysis_md text not null default '',
  change_note text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pulse_article_revisions_idx
  on public.pulse_article_revisions (article_id, version desc);

-- 6. Workflow audit trail.
create table if not exists public.pulse_article_history (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.pulse_articles(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists pulse_article_history_idx on public.pulse_article_history (article_id, created_at desc);

-- 7. Rate limiter buckets (fixed-window; server-enforced).
create table if not exists public.pulse_rate_limit (
  bucket text primary key,
  window_start timestamptz not null default now()
);
alter table public.pulse_rate_limit enable row level security;

-- Lock everything down at the API layer (direct pool bypasses RLS).
alter table public.pulse_provider_cache enable row level security;
alter table public.pulse_trends enable row level security;
alter table public.pulse_articles enable row level security;
alter table public.pulse_article_sources enable row level security;
alter table public.pulse_article_revisions enable row level security;
alter table public.pulse_article_history enable row level security;

-- Public published-article count is served through a SECURITY DEFINER
-- function used by public pages; anon/authenticated cannot select the tables.
create or replace function public.pulse_published_count()
returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.pulse_articles where status = 'published' $$;

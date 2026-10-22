-- President's Office: private documentation library, findings register,
-- and document revision history. Owner-only content.
--
-- Access model: RLS is enabled with NO permissive policies, so the PostgREST
-- API cannot read or write any of it, even for authenticated users. The
-- server reads/writes through the direct pool (service-role equivalent),
-- exactly like lib/integration-secrets.ts. There is deliberately no
-- 'authenticated can read own' policy here: office records are never
-- per-user content.

create table if not exists public.office_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  section text not null check (section in ('architecture','security','testing','operations','archive','claims')),
  title text not null,
  body_md text not null,
  version int not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.office_documents(id) on delete cascade,
  version int not null,
  body_md text not null,
  change_note text not null default 'seeded from repository source',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.office_findings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  severity text not null check (severity in ('critical','high','medium','low','info')),
  component text not null,
  title text not null,
  description text not null,
  evidence text not null default '',
  status text not null default 'open' check (status in ('open','mitigated','closed','accepted_risk')),
  discovered_at timestamptz not null default now(),
  discovered_version text,
  remediation_note text,
  retest_note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_documents_section_idx on public.office_documents (section, slug);
create index if not exists office_findings_status_idx on public.office_findings (status, severity);

-- Findings change history (audit trail: who changed what, when).
create table if not exists public.office_finding_history (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.office_findings(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Lock everything down at the API layer (direct pool bypasses RLS).
alter table public.office_documents enable row level security;
alter table public.office_document_revisions enable row level security;
alter table public.office_findings enable row level security;
alter table public.office_finding_history enable row level security;

-- Verification helper for the diagnostics dashboard: returns nothing to
-- anonymous/authenticated callers; the server calls it with SECURITY DEFINER.
create or replace function public.office_record_counts()
returns table (documents int, findings int, open_findings int)
language sql stable security definer set search_path = public as
$$
  select
    (select count(*)::int from public.office_documents),
    (select count(*)::int from public.office_findings),
    (select count(*)::int from public.office_findings where status in ('open'))
$$;

revoke execute on function public.office_record_counts() from anon, authenticated;

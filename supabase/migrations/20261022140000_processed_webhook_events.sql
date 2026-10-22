-- Processed Stripe webhook event IDs (idempotency for billing/replay safety).
-- Safe to re-run: drops and recreates if the table exists in a prior shape.
create table if not exists public.processed_webhook_event (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Retention: processed event markers are not sensitive, but old ones have no
-- purpose. Keep 90 days.
create or replace function public.prune_processed_webhook_events()
returns trigger
language plpgsql
as $$
begin
  delete from public.processed_webhook_event
  where received_at < now() - interval '90 days';
  return null;
end;
$$;

drop trigger if exists processed_webhook_event_prune on public.processed_webhook_event;
create trigger processed_webhook_event_prune
  after insert on public.processed_webhook_event
  for each row execute function public.prune_processed_webhook_events();

-- The application service role writes this table directly (Drizzle, direct
-- Postgres connection via Hyperdrive), so RLS on this table is not relied on.
alter table public.processed_webhook_event enable row level security;

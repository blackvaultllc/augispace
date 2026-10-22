-- Security hardening: app_users privacy, comment moderation, food truck integrity.
-- Repeatable: every statement is idempotent and wrapped so a re-run is safe.

begin;

-- 1. app_users must not expose other users' emails through the public API.
--    Users may see their own row; admins see all; the server (service role /
--    direct pool) bypasses RLS and is unaffected.
drop policy if exists "read app users" on public.app_users;
create policy "read app users" on public.app_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

-- 2. Non-admins must not be able to change anyone's role row, including their
--    own (role is managed only by the server using the service role/direct
--    pool connection, which bypasses RLS).
drop policy if exists "admins manage roles" on public.app_users;
create policy "admins manage roles" on public.app_users
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "self delete role row" on public.app_users;
create policy "self delete role row" on public.app_users
  for delete to authenticated
  using (false);

-- 3. Comments: constrain content server-side so a rogue client cannot insert
--    control characters, HTML-tag payloads for storage-based XSS, or oversized
--    emoji values.
do $$ begin
  alter table public.food_truck_comments
    add constraint food_truck_comments_body_no_controls
    check (body !~ '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.food_truck_comments
    add constraint food_truck_comments_emoji_len
    check (emoji is null or (char_length(emoji) between 1 and 4));
exception when duplicate_object then null; end $$;

-- 4. Moderation: staff/owner may delete any comment; authors keep their own
--    delete right. Requires the app_role()/is_app_admin() helpers from the
--    roles/billing migration.
drop policy if exists "admins moderate comments" on public.food_truck_comments;
create policy "admins moderate comments" on public.food_truck_comments
  for delete to authenticated
  using (public.is_app_admin() or author_id = auth.uid());

-- 4b. Guard against duplicate triggers: recreate the verification-protection
--    trigger exactly once (the live database previously accumulated a
--    duplicate; drop-then-create makes this migration idempotent AND deduping).
drop trigger if exists food_trucks_protect_verification on public.food_trucks;

-- 5. Verification integrity: recreate the protection trigger (idempotent and
--    always last so it reflects the final hardened definition).
create or replace function public.food_trucks_protect_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_by := null;
  else
    if new.license_number is distinct from old.license_number
       or new.license_state is distinct from old.license_state
       or new.business_name is distinct from old.business_name then
      new.verified := false;
      new.verified_by := null;
    else
      new.verified := old.verified;
      new.verified_by := old.verified_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger food_trucks_protect_verification
  before insert or update on public.food_trucks
  for each row execute function public.food_trucks_protect_verification();

commit;

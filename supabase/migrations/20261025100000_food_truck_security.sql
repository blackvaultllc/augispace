-- Food truck security hardening.

-- 1. Operators must not be able to verify themselves.
create or replace function public.food_trucks_protect_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role and the SQL editor (postgres) may verify trucks.
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_by := null;
  else
    new.verified := old.verified;
    new.verified_by := old.verified_by;
  end if;
  return new;
end;
$$;

drop trigger if exists food_trucks_protect_verification on public.food_trucks;
create trigger food_trucks_protect_verification
  before insert or update on public.food_trucks
  for each row execute function public.food_trucks_protect_verification();

-- 2. Hide license data from the public API (service role still sees it).
revoke select on public.food_trucks from anon, authenticated;
grant select (
  id, operator_id, business_name, cuisine, description,
  truck_photo_url, menu_photo_url, verified, verified_by,
  created_at, updated_at
) on public.food_trucks to anon, authenticated;

-- 3. Basic comment limits.
do $$
begin
  alter table public.food_truck_comments
    add constraint food_truck_comments_body_len
    check (char_length(body) between 1 and 1000);
exception when duplicate_object then null;
end;
$$;
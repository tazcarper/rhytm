-- Rename-proof estimate add-on matching: a stable key designating which add-on
-- plays each estimate role (ammo / gear / cart), so admins can rename the
-- add-on freely without dropping it from the estimate. At most one of each key
-- per property.

alter table public.add_ons add column if not exists estimate_add_on_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.add_ons'::regclass
      and conname = 'add_ons_estimate_add_on_key_check'
  ) then
    alter table public.add_ons
      add constraint add_ons_estimate_add_on_key_check
      check (estimate_add_on_key in ('ammo','gear','cart'));
  end if;
end$$;

create unique index if not exists add_ons_estimate_key_unique
  on public.add_ons (property_id, estimate_add_on_key)
  where estimate_add_on_key is not null;

-- Seed keys from the current names (only where unset, so re-runnable).
update public.add_ons set estimate_add_on_key = 'ammo'
  where estimate_add_on_key is null and lower(name) in ('ammunition pack','ammunition');
update public.add_ons set estimate_add_on_key = 'gear'
  where estimate_add_on_key is null and lower(name) in ('firearm / gear rental','firearm/gear rental','gear rental');
update public.add_ons set estimate_add_on_key = 'cart'
  where estimate_add_on_key is null and lower(name) in ('drink cart','extra drink cart');

-- Estimate visibility is now just is_active: if an experience/add-on is active
-- it shows on the estimate; deactivate to hide. Removes the separate
-- show_on_estimate gate and the add-on "estimate role" key.

-- Experiences: drop the show_on_estimate gate (pricing_kind still describes HOW
-- to price each one — that stays).
alter table public.services drop column if exists show_on_estimate;

-- Add-ons: drop the role key + its constraints/index.
drop index if exists public.add_ons_estimate_key_unique;
alter table public.add_ons drop constraint if exists add_ons_estimate_add_on_key_check;
alter table public.add_ons drop column if exists estimate_add_on_key;

-- The one estimate add-on behaviour worth keeping as an option: the member
-- retail discount (members 20% off goods like ammo/gear). Optional per add-on,
-- defaults off so a newly added add-on just shows at full price.
alter table public.add_ons
  add column if not exists estimate_member_discount boolean not null default false;

-- Preserve current behaviour: ammo + gear carried the member discount.
update public.add_ons set estimate_member_discount = true
  where lower(name) in (
    'ammunition pack','ammunition','firearm / gear rental','firearm/gear rental','gear rental'
  );

-- Add-on control is now derived from max_quantity (1 = Yes/No, >1 = stepper).
-- Gear rental was a per-shooter quantity, so give it a real cap to keep its
-- stepper (only if still at the default 1).
update public.add_ons set max_quantity = 20
  where max_quantity = 1
    and lower(name) in ('firearm / gear rental','firearm/gear rental','gear rental');

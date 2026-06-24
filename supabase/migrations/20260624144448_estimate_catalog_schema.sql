-- Phase 1A — Admin-managed estimate catalog: schema only (no data; seed is a
-- separate migration so the new enum value can be USED there in its own
-- transaction).

-- 1. Per-experience pricing strategy + estimate visibility, co-located on
--    services so one experience row fully describes its own pricing.
alter table public.services
  add column if not exists pricing_kind     text    not null default 'quote',
  add column if not exists show_on_estimate boolean not null default true,
  add column if not exists members_only     boolean not null default false,
  add column if not exists lesson_ladder      numeric(10,2)[],
  add column if not exists lesson_cohort_size int     not null default 5,
  add column if not exists class_price_member numeric(10,2),
  add column if not exists class_price_public numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_pricing_kind_check'
  ) then
    alter table public.services
      add constraint services_pricing_kind_check
      check (pricing_kind in ('guest_fee_tier','lesson_ladder','class_per_person','quote'));
  end if;
end$$;

-- 2. A dedicated audience for the per-property estimate guest-fee schedule.
--    Kept distinct from 'public' so the estimate's tiered guest fee lives in
--    its own pricing_rules row and never collides with the /book
--    plan_a_visit/public rule. Added here (its own migration) because a new
--    enum value cannot be referenced in the same transaction it is created.
alter type public.audience_type_enum add value if not exists 'estimate';

-- 3. F&B catering (Hog Heaven + Packsaddle only; HSB dining runs through The
--    Club). Single-table; RLS mirrors add_ons.
create table if not exists public.catering_options (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  tier           text not null,
  vendor_name    text not null,
  price_per_head numeric(10,2) not null check (price_per_head >= 0),
  is_active      boolean not null default true,
  display_order  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists catering_options_property_idx
  on public.catering_options(property_id);

alter table public.catering_options enable row level security;

drop policy if exists "catering_options: public read active" on public.catering_options;
create policy "catering_options: public read active" on public.catering_options
  for select using (is_active = true);

drop policy if exists "catering_options: admin read all" on public.catering_options;
create policy "catering_options: admin read all" on public.catering_options
  for select using (
    (select ((auth.jwt() -> 'app_metadata') ->> 'role')) = any (array['super_admin','admin'])
  );

drop policy if exists "catering_options: admin write" on public.catering_options;
create policy "catering_options: admin write" on public.catering_options
  for all using (
    (select ((auth.jwt() -> 'app_metadata') ->> 'role')) = any (array['super_admin','admin'])
  );

drop policy if exists "catering_options: property_manager write" on public.catering_options;
create policy "catering_options: property_manager write" on public.catering_options
  for all
  using (auth_role() = 'property_manager' and property_id = auth_property_id())
  with check (auth_role() = 'property_manager' and property_id = auth_property_id());

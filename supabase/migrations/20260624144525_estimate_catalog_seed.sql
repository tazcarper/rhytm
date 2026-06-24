-- Phase 1B — Seed the estimate catalog from the (now retired) rules.ts values.
-- Idempotent + reconciling: matches existing /book rows by name, UPDATEs their
-- estimate pricing fields, and INSERTs only the experiences that don't exist.
-- Re-runnable safely.

-- ============================ HORSESHOE BAY ============================
do $$
declare pid uuid;
begin
  select id into pid from public.properties where slug = 'horseshoe-bay';
  if pid is null then raise notice 'horseshoe-bay not found, skipping'; return; end if;

  -- Default every HSB service OFF the estimate; estimate experiences turned on below.
  update public.services set show_on_estimate = false where property_id = pid;

  -- clays + pistol: existing /book disciplines reused as guest-fee-tier experiences.
  update public.services set show_on_estimate = true, pricing_kind = 'guest_fee_tier', members_only = false
    where property_id = pid and name = 'Sporting Clays';
  update public.services set show_on_estimate = true, pricing_kind = 'guest_fee_tier', members_only = false
    where property_id = pid and name = 'Pistol Bays';

  -- Private Lesson (lesson ladder, 5-student cohort).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Private Lesson', 'Hourly · 2-hr recommended', 100
    where not exists (select 1 from public.services where property_id = pid and name = 'Private Lesson');
  update public.services
    set show_on_estimate = true, pricing_kind = 'lesson_ladder',
        lesson_ladder = '{200,100,50,50,50}'::numeric(10,2)[], lesson_cohort_size = 5, members_only = false
    where property_id = pid and name = 'Private Lesson';

  -- Clinic / League (per-person class; HSB clinic $65 member & public).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Clinic / League', 'Group class · $65 / person', 101
    where not exists (select 1 from public.services where property_id = pid and name = 'Clinic / League');
  update public.services
    set show_on_estimate = true, pricing_kind = 'class_per_person',
        class_price_member = 65, class_price_public = 65, members_only = false
    where property_id = pid and name = 'Clinic / League';

  -- Tournament / Event (quote; HSB members-only).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Tournament / Event', 'Registered event', 102
    where not exists (select 1 from public.services where property_id = pid and name = 'Tournament / Event');
  update public.services
    set show_on_estimate = true, pricing_kind = 'quote', members_only = true
    where property_id = pid and name = 'Tournament / Event';

  -- Estimate guest-fee schedule (audience = estimate). Bands from rules.ts.
  insert into public.pricing_rules (property_id, booking_type, audience_type, tiers)
    values (pid, 'plan_a_visit', 'estimate', '[
      {"min_guests":1,"max_guests":4,"rate_per_person":85,"junior_rate_per_person":55},
      {"min_guests":5,"max_guests":9,"rate_per_person":110,"junior_rate_per_person":80},
      {"min_guests":10,"max_guests":14,"rate_per_person":130,"junior_rate_per_person":100},
      {"min_guests":15,"max_guests":19,"rate_per_person":150,"junior_rate_per_person":120},
      {"min_guests":20,"max_guests":24,"rate_per_person":160,"junior_rate_per_person":130}
    ]'::jsonb)
    on conflict (property_id, booking_type, audience_type)
    do update set tiers = excluded.tiers, updated_at = now();

  -- Add-ons: estimate rates (ammo $17, gear $40 per-person, cart $75).
  update public.add_ons set price = 17 where property_id = pid and name = 'Ammunition Pack';
  update public.add_ons set price = 75 where property_id = pid and name = 'Drink Cart';
  insert into public.add_ons (property_id, name, description, price, display_order)
    select pid, 'Firearm / gear rental', 'Per shooter · retail', 40, 50
    where not exists (select 1 from public.add_ons where property_id = pid and name = 'Firearm / gear rental');
end$$;

-- ============================== HOG HEAVEN ==============================
do $$
declare pid uuid;
begin
  select id into pid from public.properties where slug = 'hog-heaven';
  if pid is null then raise notice 'hog-heaven not found, skipping'; return; end if;

  update public.services set show_on_estimate = false where property_id = pid;

  update public.services set show_on_estimate = true, pricing_kind = 'guest_fee_tier', members_only = false
    where property_id = pid and name = 'Sporting Clays';

  -- Pistol Bay (no existing /book discipline at HH → insert).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Pistol Bay', '2-hr bay session', 99
    where not exists (select 1 from public.services where property_id = pid and name = 'Pistol Bay');
  update public.services set show_on_estimate = true, pricing_kind = 'guest_fee_tier', members_only = false
    where property_id = pid and name = 'Pistol Bay';

  insert into public.services (property_id, name, description, display_order)
    select pid, 'Private Lesson', 'Hourly · 2-hr recommended', 100
    where not exists (select 1 from public.services where property_id = pid and name = 'Private Lesson');
  update public.services
    set show_on_estimate = true, pricing_kind = 'lesson_ladder',
        lesson_ladder = '{200,100,50,50,50}'::numeric(10,2)[], lesson_cohort_size = 5, members_only = false
    where property_id = pid and name = 'Private Lesson';

  -- Class / Clinic (free for members, $200 public).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Class / Clinic', 'Free for members · $200 public', 101
    where not exists (select 1 from public.services where property_id = pid and name = 'Class / Clinic');
  update public.services
    set show_on_estimate = true, pricing_kind = 'class_per_person',
        class_price_member = 0, class_price_public = 200, members_only = false
    where property_id = pid and name = 'Class / Clinic';

  -- Event (quote; not members-only at HH).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'Event', 'Registered event', 102
    where not exists (select 1 from public.services where property_id = pid and name = 'Event');
  update public.services set show_on_estimate = true, pricing_kind = 'quote', members_only = false
    where property_id = pid and name = 'Event';

  -- General Facility Usage (quote; wedding / event space).
  insert into public.services (property_id, name, description, display_order)
    select pid, 'General Facility Usage', 'Wedding · bridal · event space', 103
    where not exists (select 1 from public.services where property_id = pid and name = 'General Facility Usage');
  update public.services set show_on_estimate = true, pricing_kind = 'quote', members_only = false
    where property_id = pid and name = 'General Facility Usage';

  insert into public.pricing_rules (property_id, booking_type, audience_type, tiers)
    values (pid, 'plan_a_visit', 'estimate', '[
      {"min_guests":1,"max_guests":4,"rate_per_person":50,"junior_rate_per_person":35},
      {"min_guests":5,"max_guests":9,"rate_per_person":75,"junior_rate_per_person":55},
      {"min_guests":10,"max_guests":14,"rate_per_person":95,"junior_rate_per_person":70},
      {"min_guests":15,"max_guests":19,"rate_per_person":115,"junior_rate_per_person":85},
      {"min_guests":20,"max_guests":24,"rate_per_person":125,"junior_rate_per_person":95}
    ]'::jsonb)
    on conflict (property_id, booking_type, audience_type)
    do update set tiers = excluded.tiers, updated_at = now();

  update public.add_ons set price = 17 where property_id = pid and name = 'Ammunition Pack';
  update public.add_ons set price = 75 where property_id = pid and name = 'Drink Cart';
  insert into public.add_ons (property_id, name, description, price, display_order)
    select pid, 'Firearm / gear rental', 'Per shooter · retail', 40, 50
    where not exists (select 1 from public.add_ons where property_id = pid and name = 'Firearm / gear rental');

  -- Catering (Good / Better / Best vendors).
  insert into public.catering_options (property_id, tier, vendor_name, price_per_head, display_order)
    select pid, v.tier, v.vendor_name, v.price_per_head, v.display_order
    from (values
      ('Good',   'County Line BBQ',     24::numeric, 0),
      ('Better', 'The Salt Lick BBQ',   34::numeric, 1),
      ('Best',   'Contigo · Hill Country', 58::numeric, 2)
    ) as v(tier, vendor_name, price_per_head, display_order)
    where not exists (
      select 1 from public.catering_options c where c.property_id = pid and c.tier = v.tier
    );
end$$;

-- ============================== PACKSADDLE ==============================
-- Coming soon: no estimate experiences. Ensure its /book services stay OFF the
-- estimate, and seed catering (Good/Better/Best) for when it opens.
do $$
declare pid uuid;
begin
  select id into pid from public.properties where slug = 'packsaddle';
  if pid is null then raise notice 'packsaddle not found, skipping'; return; end if;

  update public.services set show_on_estimate = false where property_id = pid;

  insert into public.catering_options (property_id, tier, vendor_name, price_per_head, display_order)
    select pid, v.tier, v.vendor_name, v.price_per_head, v.display_order
    from (values
      ('Good',   'County Line BBQ',     24::numeric, 0),
      ('Better', 'The Salt Lick BBQ',   34::numeric, 1),
      ('Best',   'Contigo · Hill Country', 58::numeric, 2)
    ) as v(tier, vendor_name, price_per_head, display_order)
    where not exists (
      select 1 from public.catering_options c where c.property_id = pid and c.tier = v.tier
    );
end$$;

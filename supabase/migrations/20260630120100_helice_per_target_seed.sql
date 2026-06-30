-- Per-target pricing (Helice) — Phase 5: seed the HSB + Hog Heaven Helice rows.
-- Idempotent: updates an existing Helice row to the per_target config (HSB has a
-- 'quote' placeholder) and inserts one where absent (Hog Heaven, or a fresh DB).
-- Re-running is a no-op. Rates per the approved spec; staff can adjust later in
-- the admin dashboard. Packsaddle is intentionally excluded.

-- Horseshoe Bay — member $2.50 / public $2.95 per target.
update public.services
  set pricing_kind            = 'per_target',
      per_target_rate_member  = 2.50,
      per_target_rate_public  = 2.95,
      target_allotment_size   = 30,
      target_unit_label       = 'target',
      session_fee             = 49.50,
      session_fee_label       = 'Setup / ring fee',
      session_fee_description = 'We staff the ring every session.',
      is_active               = true,
      updated_at              = now()
where property_id = (select id from public.properties where slug = 'horseshoe-bay')
  and name = 'Helice';

insert into public.services
  (property_id, name, description, pricing_kind, per_target_rate_member,
   per_target_rate_public, target_allotment_size, target_unit_label,
   session_fee, session_fee_label, session_fee_description, is_active)
select p.id, 'Helice', 'Driven targets, priced per bird. Sold in 30-bird allotments.',
       'per_target', 2.50, 2.95, 30, 'target',
       49.50, 'Setup / ring fee', 'We staff the ring every session.', true
from public.properties p
where p.slug = 'horseshoe-bay'
  and not exists (
    select 1 from public.services s
    where s.property_id = p.id and s.name = 'Helice'
  );

-- Hog Heaven — member $2.25 / public $2.75 per target.
update public.services
  set pricing_kind            = 'per_target',
      per_target_rate_member  = 2.25,
      per_target_rate_public  = 2.75,
      target_allotment_size   = 30,
      target_unit_label       = 'target',
      session_fee             = 49.50,
      session_fee_label       = 'Setup / ring fee',
      session_fee_description = 'We staff the ring every session.',
      is_active               = true,
      updated_at              = now()
where property_id = (select id from public.properties where slug = 'hog-heaven')
  and name = 'Helice';

insert into public.services
  (property_id, name, description, pricing_kind, per_target_rate_member,
   per_target_rate_public, target_allotment_size, target_unit_label,
   session_fee, session_fee_label, session_fee_description, is_active)
select p.id, 'Helice', 'Driven targets, priced per bird. Sold in 30-bird allotments.',
       'per_target', 2.25, 2.75, 30, 'target',
       49.50, 'Setup / ring fee', 'We staff the ring every session.', true
from public.properties p
where p.slug = 'hog-heaven'
  and not exists (
    select 1 from public.services s
    where s.property_id = p.id and s.name = 'Helice'
  );

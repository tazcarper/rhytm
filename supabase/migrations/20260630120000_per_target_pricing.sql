-- Per-target pricing (Helice) — Phase 1: schema only.
-- Adds a new `per_target` pricing kind (rate × targets sold in fixed
-- allotments, member vs public rate) plus a REUSABLE per-outing flat fee
-- (session_fee) that any pricing kind can carry. No data; clubs are seeded /
-- configured in the admin dashboard once the kind exists. See
-- plan/per-target-pricing-model.md.

-- 1. Per-target rate (member vs public) + allotment size + unit label, and the
--    reusable per-outing session fee. All co-located on the services row so one
--    experience row fully describes its own pricing — same pattern as the
--    lesson_ladder / class_per_person fields.
--      session_fee             — flat fee charged once per outing to EVERYONE
--                                 (member + non-member). Null = no session fee.
--      session_fee_label       — short name shown on the line item.
--      session_fee_description — optional admin-editable "what this fee is for".
alter table public.services
  add column if not exists per_target_rate_member  numeric(10,2),
  add column if not exists per_target_rate_public  numeric(10,2),
  add column if not exists target_allotment_size   int  not null default 30,
  add column if not exists target_unit_label       text not null default 'target',
  add column if not exists session_fee             numeric(10,2),
  add column if not exists session_fee_label       text,
  add column if not exists session_fee_description text;

-- 2. Widen the pricing-kind check to admit per_target. Drop + re-add (the
--    original was created conditionally in 20260624144448); the new constraint
--    is a strict superset, so every existing row still satisfies it.
alter table public.services
  drop constraint if exists services_pricing_kind_check;

alter table public.services
  add constraint services_pricing_kind_check
  check (pricing_kind in
    ('guest_fee_tier','lesson_ladder','class_per_person','quote','per_target'));

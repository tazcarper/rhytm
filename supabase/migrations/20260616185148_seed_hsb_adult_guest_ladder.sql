-- =============================================================
-- HSB (Horseshoe Bay) — real adult guest-fee ladder + lesson guest fee
--
-- Replaces the placeholder plan_a_visit tiers and the placeholder
-- private_lesson per-guest fee with the canonical Horseshoe Bay numbers
-- confirmed in the Notion Pricing schema (Charter "Confirmed Pricing
-- Levels — HSB"):
--
--   Adult guest fee (bundles cart + clays), by group size:
--     1-4   -> $85/person
--     5-9   -> $110/person
--     10-14 -> $130/person
--     15-19 -> $150/person
--     20-24 -> $160/person
--
--   Private lesson: $200/hr (already correct); non-member guest fee is
--   the tier-1 adult guest fee of $85 (was a $50 placeholder).
--
-- Scope: Horseshoe Bay ONLY. Hog Heaven and Packsaddle remain on
-- placeholders until their real pricing is confirmed.
--
-- NOTE: junior (<=15) pricing is a separate canonical ladder that needs
-- a guest-type split the app does not model yet; it lands in a later
-- change. This migration sets adult rates only.
-- =============================================================

-- ---- plan_a_visit (public): canonical 5-tier adult ladder ----
UPDATE pricing_rules
SET tiers = jsonb_build_array(
  jsonb_build_object('min_guests', 1,  'max_guests', 4,  'rate_per_person', 85.00),
  jsonb_build_object('min_guests', 5,  'max_guests', 9,  'rate_per_person', 110.00),
  jsonb_build_object('min_guests', 10, 'max_guests', 14, 'rate_per_person', 130.00),
  jsonb_build_object('min_guests', 15, 'max_guests', 19, 'rate_per_person', 150.00),
  jsonb_build_object('min_guests', 20, 'max_guests', 24, 'rate_per_person', 160.00)
)
WHERE booking_type = 'plan_a_visit'
  AND audience_type = 'public'
  AND property_id = (SELECT id FROM properties WHERE slug = 'horseshoe-bay');

-- ---- private_lesson (public): non-member guest fee $50 -> $85 ----
UPDATE pricing_rules
SET per_guest_fee = 85.00
WHERE booking_type = 'private_lesson'
  AND audience_type = 'public'
  AND property_id = (SELECT id FROM properties WHERE slug = 'horseshoe-bay');

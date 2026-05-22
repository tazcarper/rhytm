-- =============================================================
-- Placeholder seed: pricing_rules (public audience only)
--
-- BLOCKING ON Q5 (full pricing formula confirmation). Private lesson
-- at $200/hr is confirmed; everything else is a reasonable placeholder
-- so the App 2.5 live estimate has data to render.
--
-- Sweep with `DELETE FROM pricing_rules` when Q5 returns and reseed
-- from the confirmed formula. The (property_id, booking_type,
-- audience_type) UNIQUE constraint protects against accidental dupes.
--
-- All rules created for audience_type='public'. Member + partner rates
-- come with App 4 / App 5.
-- =============================================================

-- ---- private_lesson: $200/hour flat (confirmed from Q5) ----
INSERT INTO pricing_rules (property_id, booking_type, audience_type, rate_per_unit, unit, minimum_fee)
SELECT p.id, 'private_lesson'::booking_type_enum, 'public'::audience_type_enum, 200.00, 'hour', 200.00
FROM properties p
ON CONFLICT (property_id, booking_type, audience_type) DO NOTHING;

-- ---- plan_a_visit: tiered per-person rate by group size (PLACEHOLDER) ----
INSERT INTO pricing_rules (property_id, booking_type, audience_type, tiers)
SELECT p.id, 'plan_a_visit'::booking_type_enum, 'public'::audience_type_enum,
  jsonb_build_array(
    jsonb_build_object('min_guests', 1, 'max_guests', 4,  'rate_per_person', 150.00),
    jsonb_build_object('min_guests', 5, 'max_guests', 8,  'rate_per_person', 130.00),
    jsonb_build_object('min_guests', 9, 'max_guests', 12, 'rate_per_person', 110.00)
  )
FROM properties p
ON CONFLICT (property_id, booking_type, audience_type) DO NOTHING;

-- ---- host_an_occasion: team-quoted (rule row exists with a starting-fee
--      so the UI can show "Starting from $X — team-quoted") ----
INSERT INTO pricing_rules (property_id, booking_type, audience_type, minimum_fee)
SELECT p.id, 'host_an_occasion'::booking_type_enum, 'public'::audience_type_enum, 2000.00
FROM properties p
ON CONFLICT (property_id, booking_type, audience_type) DO NOTHING;

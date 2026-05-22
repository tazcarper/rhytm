-- =============================================================
-- pricing_rules: add per_guest_fee + fix the placeholder tier inversion
--
-- Adds `per_guest_fee` (optional flat fee added per extra guest beyond the
-- first). Today's user of this column: private_lesson — per the build
-- proposal, lessons are "$200/hour flat rate, with a guest fee for
-- non-members." Seed each property's public private_lesson rule with $50.
--
-- Also fixes a placeholder pricing inversion on plan_a_visit: with the
-- previous tier 3 rate of $110/person, 8 guests at $130 = $1040 cost MORE
-- than 9 guests at $110 = $990. Bump tier 3 to $125 so the curve is
-- monotonic. Still placeholder; Q5 will deliver real numbers.
-- =============================================================

ALTER TABLE pricing_rules
  ADD COLUMN per_guest_fee numeric(10,2)
    CHECK (per_guest_fee IS NULL OR per_guest_fee >= 0);

COMMENT ON COLUMN pricing_rules.per_guest_fee IS
  'Optional flat fee added per extra guest beyond the first. NULL means no per-guest fee (booking_type pricing is purely hourly/tiered).';

-- ---- Seed lesson guest fee: $50/extra guest, public audience, all properties ----
UPDATE pricing_rules
  SET per_guest_fee = 50.00
  WHERE booking_type = 'private_lesson'
    AND audience_type = 'public';

-- ---- Fix plan_a_visit tier inversion (8 guests cheaper than 9 guests) ----
UPDATE pricing_rules
  SET tiers = jsonb_build_array(
    jsonb_build_object('min_guests', 1, 'max_guests', 4,  'rate_per_person', 150.00),
    jsonb_build_object('min_guests', 5, 'max_guests', 8,  'rate_per_person', 130.00),
    jsonb_build_object('min_guests', 9, 'max_guests', 12, 'rate_per_person', 125.00)
  )
  WHERE booking_type = 'plan_a_visit'
    AND audience_type = 'public';

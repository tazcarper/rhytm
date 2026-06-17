-- =============================================================
-- Junior guest pricing — schema
--
-- The HSB Sporting Club guest fee is age-tiered (canonical HSBC Q&A
-- 5.12.26): Adult (16+) and Junior (15 & under) pay different flat
-- per-head rates, both bundling cart + clays. The app modeled only a
-- single per-head rate. This adds the storage for the junior side:
--
--   * bookings.junior_guest_count   — how many of guest_count are juniors.
--   * pricing_rules.junior_per_guest_fee — junior counterpart to
--     per_guest_fee (flat model, e.g. private_lesson companions).
--
-- The tiered model's junior rate rides inside the existing `tiers` JSONB
-- as an optional `junior_rate_per_person` key (no DDL needed there).
--
-- Both additions are nullable / default-0 and back-compatible: rules
-- without a junior rate simply charge every head the adult rate.
-- =============================================================

ALTER TABLE bookings
  ADD COLUMN junior_guest_count integer NOT NULL DEFAULT 0
    CHECK (junior_guest_count >= 0 AND junior_guest_count <= guest_count);

COMMENT ON COLUMN bookings.junior_guest_count IS
  'How many of guest_count are juniors (15 & under). Adults = guest_count - junior_guest_count. Drives age-tiered guest fees.';

ALTER TABLE pricing_rules
  ADD COLUMN junior_per_guest_fee numeric(10,2)
    CHECK (junior_per_guest_fee IS NULL OR junior_per_guest_fee >= 0);

COMMENT ON COLUMN pricing_rules.junior_per_guest_fee IS
  'Junior (15 & under) counterpart to per_guest_fee for the flat model. NULL means juniors pay the adult per_guest_fee.';

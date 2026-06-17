-- =============================================================
-- Phase 0 — bid_line_items foundation
--
-- Today a bid's price is stored as opaque totals (bookings.estimated_price
-- / confirmed_price) plus booking_add_ons (the only itemized lines). This
-- introduces a real, materialized line breakdown for a bid so that:
--   * the admin and (later) customer surfaces can show an itemized quote,
--   * Phase 1 per-line waive/comp overrides have a stable line id to target,
--   * per-line tax status seeds the Bundle-Trap (TX §151.0048) foundation.
--
-- Keyed on booking_id (bids ↔ bookings is 1:1) so the RLS mirrors
-- booking_add_ons verbatim — a proven child-of-bookings policy set with no
-- cross-table recursion. Lines are materialized by a server service
-- (src/services/bids/bid-line-items.ts) from buildBookingSummary + the
-- booking_add_ons snapshots; this migration only defines the shape.
--
-- Additive and non-destructive: existing price columns and flows are
-- untouched. The line subtotal mirrors estimated_price for new bids.
-- =============================================================

CREATE TYPE line_item_kind AS ENUM (
  'base_experience',  -- the core experience charge (tiered guest fee / hourly lesson)
  'guest_fee',        -- per-head club entry fee (flat model, e.g. lessons)
  'add_on',           -- a booked add-on (mirrors a booking_add_ons row)
  'instructor',       -- per-instructor labor (forward-compat: partner_group, exempt)
  'fee',              -- misc fee line
  'other'
);

CREATE TYPE line_item_tax_status AS ENUM ('taxable', 'exempt');

CREATE TABLE bid_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind              line_item_kind NOT NULL,
  label             text NOT NULL,
  quantity          numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_amount       numeric(10,2) NOT NULL,
  line_amount       numeric(10,2) NOT NULL,
  -- Bundle Trap (TX §151.0048): instructor / pure-instruction lines are
  -- exempt and must stay isolated. Default taxable; materializer sets exempt.
  tax_status        line_item_tax_status NOT NULL DEFAULT 'taxable',
  -- Provenance (nullable): links an add_on line back to its catalog rows.
  source_service_id uuid REFERENCES services(id),
  source_add_on_id  uuid REFERENCES add_ons(id),
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bid_line_items_booking_id_idx ON bid_line_items(booking_id);

CREATE TRIGGER set_bid_line_items_updated_at
  BEFORE UPDATE ON bid_line_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ---- RLS: mirrors booking_add_ons exactly (read by staff + the owning
--      member/partner via the booking; writes are service-role only). ----
ALTER TABLE bid_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_line_items: admin read"
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "bid_line_items: property_manager read"
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
        AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

CREATE POLICY "bid_line_items: member read own"
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.member_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bid_line_items: partner read own"
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

-- Writes are service role only (the materializer runs with the service key).

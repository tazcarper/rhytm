-- =============================================================
-- Phase 1 — per-line override bidder: bid_line_overrides + bid_pricing_events
--
-- Phase 0 materialized a bid's quote into bid_line_items. Phase 1 lets a
-- concierge waive or comp a SPECIFIC line, shows the customer a transparent
-- discount, and records an admin-only audit trail. Two append-only tables:
--
--   * bid_line_overrides — the waive/comp records. Immutable: no UPDATE/DELETE
--     path is exposed; a mistake is corrected by appending a *reversing* row
--     (new_amount back to original_amount), never an edit. `reason` is
--     ADMIN-ONLY and must never reach the customer.
--
--   * bid_pricing_events — a source-tagged audit of every confirmed_price
--     change, from BOTH mechanisms: the new line-override path AND the
--     pre-existing manual PricingEditor path (which was previously unaudited).
--     A price-change timeline can therefore always tell the two apart.
--
-- Both are keyed on booking_id to match bid_line_items (bids <-> bookings is
-- 1:1). RLS is deliberately NARROWER than bid_line_items: staff only. The
-- owning member/partner can read bid_line_items, but must NOT read these —
-- `reason` is admin-only. The customer sees the discount only through the
-- service-role get-bid path (PR-2), which derives it arithmetically from the
-- line subtotal vs. the effective total and never selects `reason`/actor.
--
-- Writes are service-role only (no INSERT/UPDATE/DELETE policy). FORCE ROW
-- LEVEL SECURITY is not used on this project (CLAUDE.md rule 7), so the
-- service role and SECURITY DEFINER functions bypass RLS as expected.
-- =============================================================

-- ---- bid_line_overrides — append-only waive/comp records ----
CREATE TABLE bid_line_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  line_item_id          uuid NOT NULL REFERENCES bid_line_items(id) ON DELETE CASCADE,
  -- Snapshot of the line's bid_line_items.line_amount at override time. The
  -- line row itself is never mutated, so its line_amount remains the
  -- authoritative original quote; this snapshot guards against a later add-on
  -- rematerialize changing the row out from under a historical override.
  original_amount       numeric(10,2) NOT NULL,
  -- The comped amount. 0 = a full waive. A comp only ever lowers a line
  -- (enforced in the service: 0 <= new_amount <= original_amount); a reversing
  -- entry restores new_amount = original_amount.
  new_amount            numeric(10,2) NOT NULL CHECK (new_amount >= 0),
  -- Negative for a discount, 0 for a reversing entry. Generated, never set.
  delta                 numeric(10,2)
                          GENERATED ALWAYS AS (new_amount - original_amount) STORED,
  -- ADMIN-ONLY. Never leaves the admin layer — no customer code path selects it.
  reason                text NOT NULL CHECK (char_length(reason) >= 10),
  -- Optional concierge label shown to the customer (e.g. "VIP comp"); null on
  -- the customer page renders the generic "Discount applied".
  customer_facing_label text,
  -- Who applied it, from the session. actor_email is denormalized (captured at
  -- write time) so the audit reads without a join to auth.users. actor_id keeps
  -- a NOT NULL FK with NO on-delete action (RESTRICT): staff are deactivated,
  -- not hard-deleted, so a referenced auth user cannot be removed out from under
  -- the audit trail in the first place.
  actor_id              uuid NOT NULL REFERENCES auth.users(id),
  actor_email           text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bid_line_overrides_booking_id_idx   ON bid_line_overrides(booking_id);
CREATE INDEX bid_line_overrides_line_item_id_idx ON bid_line_overrides(line_item_id);

COMMENT ON TABLE bid_line_overrides IS
  'Append-only per-line waive/comp records for a bid. Immutable: corrections '
  'are reversing inserts, never UPDATE/DELETE. The effective override for a '
  'line is its most recent row. reason is admin-only.';

-- No updated_at and no update trigger: the table is append-only by design.

-- ---- bid_pricing_events — source-tagged confirmed_price audit ----
CREATE TYPE pricing_event_source AS ENUM ('manual', 'line_override');

CREATE TABLE bid_pricing_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Which mechanism made the change: the manual PricingEditor, or a per-line
  -- override. The admin timeline tags every entry with this.
  source           pricing_event_source NOT NULL,
  -- Set for source = 'line_override'; links to the override row for per-line
  -- detail. SET NULL (not CASCADE) — the override is itself immutable, but if
  -- a booking/override is ever removed the audit line should survive.
  line_override_id uuid REFERENCES bid_line_overrides(id) ON DELETE SET NULL,
  old_total        numeric(10,2),
  new_total        numeric(10,2),
  actor_id         uuid NOT NULL REFERENCES auth.users(id),
  actor_email      text NOT NULL,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bid_pricing_events_booking_id_idx ON bid_pricing_events(booking_id);

COMMENT ON TABLE bid_pricing_events IS
  'Append-only, source-tagged audit of every bookings.confirmed_price change '
  '(manual PricingEditor edits AND per-line overrides). Staff-read only.';

-- ---- Staff-only visibility selector ----
-- Modeled on bid_line_visible_booking_ids() (Phase 0) but DELIBERATELY drops
-- the member/partner branches: these tables carry admin-only audit data
-- (reason text, actor identity) and must not be readable by the customer.
-- SECURITY DEFINER + STABLE so it is opaque to the planner (no policy
-- dependency cycle) and evaluated once per query (CLAUDE.md RLS rules 2-4).
CREATE OR REPLACE FUNCTION bid_pricing_staff_booking_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM bookings b
  WHERE is_admin()
     OR (auth_role() = 'property_manager' AND b.property_id = auth_property_id());
$$;

REVOKE ALL ON FUNCTION bid_pricing_staff_booking_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bid_pricing_staff_booking_ids() TO authenticated;

COMMENT ON FUNCTION bid_pricing_staff_booking_ids() IS
  'Booking ids whose pricing audit (bid_line_overrides, bid_pricing_events) '
  'the caller may read: admin/super_admin (all), property_manager (own '
  'property). No member/partner branch — reason/actor are admin-only.';

-- ---- RLS: staff read only; writes are service-role only ----
ALTER TABLE bid_line_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_pricing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_line_overrides: staff read"
  ON bid_line_overrides FOR SELECT
  USING (booking_id IN (SELECT bid_pricing_staff_booking_ids()));

CREATE POLICY "bid_pricing_events: staff read"
  ON bid_pricing_events FOR SELECT
  USING (booking_id IN (SELECT bid_pricing_staff_booking_ids()));

-- No INSERT/UPDATE/DELETE policies on either table: all writes go through the
-- service role (applyLineOverride / updateBidPricing), which bypasses RLS.
-- The absence of an UPDATE/DELETE path is what makes them append-only even to
-- staff sessions.

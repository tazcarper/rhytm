-- =============================================================
-- Phase 0 follow-up — bid_line_items: correct RLS + legacy backfill
--
-- Three fixes to the bid_line_items foundation (20260616200000):
--
-- 1. RLS drift. The foundation hand-copied four read policies that claimed
--    to "mirror booking_add_ons verbatim" but actually mirrored the
--    *superseded* member policy: owner-only (member_user_id = auth.uid())
--    instead of household-visible. A spouse/primary who can see a bid's
--    add-ons could NOT see the same bid's line items. We replace the four
--    policies with ONE policy backed by a SECURITY DEFINER selector
--    (bid_line_visible_booking_ids) so the visibility set lives in a single
--    place and can never drift from booking_add_ons again. This also follows
--    the project RLS rule (selector function, not inline cross-table EXISTS).
--
-- 2. Legacy backfill, off the read path. The foundation self-healed old bids
--    by writing on every admin *read* (getAdminBidDetail). That is removed in
--    the service layer; this migration provides backfill_bid_line_items(), an
--    idempotent function that materializes any bid still missing lines.
--
-- The base line here is the DRIFT-FREE coarse form: estimated_price minus the
-- add-on subtotal (both stored snapshots), never recomputed from live
-- pricing. New/edited bids get the richer base + guest-fee split from the
-- TypeScript materializer; legacy bids get a single accurate base line.
-- =============================================================

-- ---- Selector: which bookings' quote lines may the caller read? ----
-- Mirrors booking_add_ons's CURRENT visibility exactly: admin/super_admin,
-- property_manager (own property), member (household via
-- current_household_user_ids), partner (own concierge_user_id). Instructors
-- and bare concierge are intentionally excluded — they do not read
-- booking_add_ons either, and quote pricing is sensitive.
--
-- SECURITY DEFINER + STABLE so it is opaque to the planner (no policy
-- dependency cycle) and evaluated once per query. Matches the convention of
-- current_household_user_ids() / staff_visible_person_ids().
CREATE OR REPLACE FUNCTION bid_line_visible_booking_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM bookings b
  WHERE is_admin()
     OR (auth_role() = 'property_manager' AND b.property_id = auth_property_id())
     OR (auth_role() = 'member' AND b.member_user_id IN (SELECT current_household_user_ids()))
     OR (auth_role() = 'partner' AND b.concierge_user_id = (SELECT auth.uid()));
$$;

REVOKE ALL ON FUNCTION bid_line_visible_booking_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bid_line_visible_booking_ids() TO authenticated;

COMMENT ON FUNCTION bid_line_visible_booking_ids() IS
  'Booking ids whose bid_line_items the caller may read. Single source for '
  'quote-line child tables (bid_line_items today; per-line overrides next), '
  'mirroring booking_add_ons visibility so the two cannot drift apart.';

-- ---- Replace the four drifted policies with one selector-backed policy ----
DROP POLICY IF EXISTS "bid_line_items: admin read"            ON bid_line_items;
DROP POLICY IF EXISTS "bid_line_items: property_manager read" ON bid_line_items;
DROP POLICY IF EXISTS "bid_line_items: member read own"       ON bid_line_items;
DROP POLICY IF EXISTS "bid_line_items: partner read own"      ON bid_line_items;

CREATE POLICY "bid_line_items: read visible"
  ON bid_line_items FOR SELECT
  USING (booking_id IN (SELECT bid_line_visible_booking_ids()));

-- Writes remain service-role only (no write policy) — the materializer runs
-- with the service key. Unchanged from the foundation.

-- ---- Idempotent backfill for bids created before the foundation ----
-- Materializes lines for any bid whose booking has none yet. Coarse but
-- accurate: add-on lines from the booking_add_ons snapshots, plus a single
-- base line = estimated_price - add-on subtotal. Uses only stored values, so
-- it can never drift from what the customer was quoted. Re-runnable; skips
-- bookings that already have lines.
CREATE OR REPLACE FUNCTION backfill_bid_line_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed      integer := 0;
  v_booking        record;
  v_addon_subtotal numeric(10,2);
  v_base           numeric(10,2);
BEGIN
  FOR v_booking IN
    SELECT bk.id AS booking_id, bk.estimated_price
    FROM bids bd
    JOIN bookings bk ON bk.id = bd.booking_id
    WHERE NOT EXISTS (
      SELECT 1 FROM bid_line_items li WHERE li.booking_id = bk.id
    )
  LOOP
    -- Add-on lines from the authoritative price snapshots.
    INSERT INTO bid_line_items (
      booking_id, kind, label, quantity, unit_amount, line_amount,
      tax_status, source_service_id, source_add_on_id, sort_order
    )
    SELECT
      ba.booking_id,
      'add_on',
      COALESCE(ao.name, 'Add-on'),
      ba.quantity,
      ba.unit_price_at_booking,
      ROUND(ba.unit_price_at_booking * ba.quantity, 2),
      'taxable',
      ba.service_id,
      ba.add_on_id,
      -- base line is sort 0; add-ons follow (matches the TS materializer,
      -- which places add-ons at sort_order >= 2).
      (1 + ROW_NUMBER() OVER (ORDER BY ba.id))::integer
    FROM booking_add_ons ba
    LEFT JOIN add_ons ao ON ao.id = ba.add_on_id
    WHERE ba.booking_id = v_booking.booking_id;

    -- Base line = quoted total minus add-ons. Skipped for team-quoted bids
    -- (no estimate) or when the remainder is non-positive.
    SELECT COALESCE(SUM(ROUND(unit_price_at_booking * quantity, 2)), 0)
      INTO v_addon_subtotal
      FROM booking_add_ons
      WHERE booking_id = v_booking.booking_id;

    IF v_booking.estimated_price IS NOT NULL THEN
      v_base := ROUND(v_booking.estimated_price - v_addon_subtotal, 2);
      IF v_base > 0 THEN
        INSERT INTO bid_line_items (
          booking_id, kind, label, quantity, unit_amount, line_amount,
          tax_status, sort_order
        )
        VALUES (
          v_booking.booking_id, 'base_experience', 'Experience',
          1, v_base, v_base, 'taxable', 0
        );
      END IF;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION backfill_bid_line_items() FROM PUBLIC;

COMMENT ON FUNCTION backfill_bid_line_items() IS
  'Idempotently materializes bid_line_items for any bid missing them, using '
  'stored snapshots (estimated_price - add-on subtotal for the base line). '
  'Off the read path; call once after deploy/seed. Owned by postgres.';

-- Backfill anything already present (no-op on a fresh reset — bids are seeded
-- after migrations run, so re-invoke this RPC at the end of seeding).
SELECT backfill_bid_line_items();

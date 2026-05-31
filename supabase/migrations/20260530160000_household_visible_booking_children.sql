-- App 4 — extend household visibility from `bookings` to its read-side
-- children (`bids`, `booking_disciplines`, `booking_add_ons`).
--
-- The bookings table itself was widened in
-- 20260530120000_household_visible_bookings.sql. This migration brings
-- the children along so the /member/bookings/[id] detail page can show
-- the full record (gear list, schedule notes, FAQ, disciplines, add-ons)
-- to anyone on the same membership — not just the original booker.
--
-- Sign + pay is a separate concern: the access_code_hash gates the
-- public bid signing surface and is not visible from any RLS SELECT
-- path (the hash is the column, not the plaintext). Expanding SELECT
-- to household lets spouse READ the details; it does not let them
-- sign or pay on the booker's behalf.
--
-- Pattern matches 20260530120000:
--   - DROP the existing "member read own" policy
--   - CREATE a "member household read" policy keyed on
--     current_household_user_ids() via an EXISTS into bookings
--
-- RLS cycle audit:
--   - bids/disciplines/add_ons new policies do
--     EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
--             AND b.member_user_id IN (SELECT current_household_user_ids()))
--   - bookings policy does NOT reference bids/disciplines/add_ons.
--   - current_household_user_ids() is SECURITY DEFINER — opaque to planner.
--   → No cycle.

-- ============================================================
-- bids
-- ============================================================

DROP POLICY IF EXISTS "bids: member read own" ON bids;

CREATE POLICY "bids: member household read"
  ON bids FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.member_user_id IN (SELECT current_household_user_ids())
    )
  );

-- ============================================================
-- booking_disciplines
-- ============================================================

DROP POLICY IF EXISTS "booking_disciplines: member read own" ON booking_disciplines;

CREATE POLICY "booking_disciplines: member household read"
  ON booking_disciplines FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.member_user_id IN (SELECT current_household_user_ids())
    )
  );

-- ============================================================
-- booking_add_ons
-- ============================================================

DROP POLICY IF EXISTS "booking_add_ons: member read own" ON booking_add_ons;

CREATE POLICY "booking_add_ons: member household read"
  ON booking_add_ons FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.member_user_id IN (SELECT current_household_user_ids())
    )
  );

-- ============================================================
-- Phase D of the request-estimate → bid integration
-- (plan/request-estimate-bid-integration.md §7/§8a).
--
-- Three changes, all small and additive (one column add, two column
-- drops that revert a Phase C mis-target, one new function):
--
--  1. bids.requires_waiver — the per-bid waiver seam (§8a/§11). Estimate
--     bids are quote-only: no waiver, no deposit. The public bid page
--     suppresses the signature slot and treats a confirmed no-waiver bid
--     as fully "set" when this is false. Defaults TRUE so every existing
--     and /book bid is unchanged; the estimate path sets it false. When
--     waivers return for the estimate route, this is the flag to flip.
--
--  2. DROP bookings.staff_notes / bookings.schedule_notes — added in
--     Phase C against the wrong table. `bids` ALREADY has staff_notes +
--     schedule_notes, and the admin bid detail renders them; the estimate
--     intake's staff context belongs on bids.staff_notes (staff-only —
--     never mapped into the public get-bid projection). NB: bids.schedule_notes
--     IS guest-visible (rendered on the bid page), so staff content must
--     NOT go there — it all goes to bids.staff_notes. These two booking
--     columns were never read by anything, so dropping is safe.
--
--  3. lock_booking_slot() — the slot-lock action (§7). Sets a real
--     start_time (tz-correct, mirroring create_public_booking) +
--     duration_hours AND advances bookings.status pending_review →
--     awaiting_guest in ONE update, so the §6 availability triggers fire
--     and enforce no-double-book (a confirmed bid must never sit on an
--     unenforced provisional slot). Trigger rejections (P0001 / 23P01)
--     propagate to the caller, which maps them like create_public_booking.
--
-- RLS: no new policy (column add/drop only; the function is service-role
-- callable, granted below). No policy references another table → no
-- dependency cycle (CLAUDE.md rule 5 satisfied trivially).
-- ============================================================

-- 1. Waiver seam ------------------------------------------------
ALTER TABLE bids
  ADD COLUMN requires_waiver boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN bids.requires_waiver IS
  'Whether this bid requires a signed waiver. Default true (every /book + historical bid). The quote-only /request-estimate path sets it false → the bid page suppresses the signature slot and a confirmed no-waiver bid reads as fully set (plan §8a). The seam to flip when waivers return for estimates.';

-- 2. Revert the Phase C mis-target -----------------------------
-- bids already carries staff_notes/schedule_notes; the estimate intake
-- writes its staff context to bids.staff_notes instead. These booking
-- columns had no readers.
ALTER TABLE bookings DROP COLUMN IF EXISTS staff_notes;
ALTER TABLE bookings DROP COLUMN IF EXISTS schedule_notes;

-- 3. Slot-lock action ------------------------------------------
-- Sets the real committed slot and advances status so enforcement re-arms.
-- start_time is in the SET list → validate_booking_start_time (bound
-- UPDATE OF start_time) runs; status leaving pending_review → check_property_capacity
-- enforces (both gated to skip while pending_review, plan §6). Returns the
-- locked slot for the caller to surface.
CREATE OR REPLACE FUNCTION lock_booking_slot(
  p_booking_id     uuid,
  p_date           date,
  p_slot_start     time,
  p_duration_hours integer
)
RETURNS TABLE (
  booking_id     uuid,
  start_time     timestamptz,
  end_time       timestamptz,
  status         booking_status_enum
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_timezone    text;
  v_start       timestamptz;
BEGIN
  SELECT b.property_id INTO v_property_id FROM bookings b WHERE b.id = p_booking_id;
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Unknown booking' USING ERRCODE = 'P0002';
  END IF;

  SELECT timezone INTO v_timezone FROM properties WHERE id = v_property_id;
  -- Same DST-correct construction as create_public_booking.
  v_start := (p_date + p_slot_start) AT TIME ZONE v_timezone;

  RETURN QUERY
  UPDATE bookings
  SET start_time     = v_start,
      duration_hours = p_duration_hours,
      status         = 'awaiting_guest'
  WHERE id = p_booking_id
  RETURNING id, start_time, end_time, status;
END;
$$;

REVOKE ALL ON FUNCTION lock_booking_slot(uuid, date, time, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_booking_slot(uuid, date, time, integer) TO service_role;

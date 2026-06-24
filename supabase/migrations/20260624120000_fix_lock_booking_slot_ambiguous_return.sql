-- Fix: lock_booking_slot() failed at runtime with
--   42702 "column reference \"start_time\" is ambiguous"
-- so the slot-lock + confirm action (estimate Phase D/F, plan §7) always
-- returned the generic "We couldn't lock that slot." error.
--
-- Cause: the function's RETURNS TABLE(...) OUT params (start_time, end_time,
-- status) share names with the bookings columns of the same name. In the
-- UPDATE ... RETURNING list those bare names are ambiguous between the OUT
-- param and the column, and Postgres aborts the statement.
--
-- Fix: alias the target table and qualify every RETURNING column so it
-- unambiguously references the table, not the OUT params. Body is otherwise
-- identical to 20260624004057_estimate_phase_d_lock_and_waiver.sql.

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
  UPDATE bookings AS b
  SET start_time     = v_start,
      duration_hours = p_duration_hours,
      status         = 'awaiting_guest'
  WHERE b.id = p_booking_id
  RETURNING b.id, b.start_time, b.end_time, b.status;
END;
$$;

REVOKE ALL ON FUNCTION lock_booking_slot(uuid, date, time, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_booking_slot(uuid, date, time, integer) TO service_role;

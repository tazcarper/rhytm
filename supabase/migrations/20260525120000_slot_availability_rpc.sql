-- =============================================================
-- get_slot_availability(property_id, date, booking_type, duration_hours)
--
-- Returns every active time_slot for the given date's day-of-week along
-- with whether a NEW booking of the given type/duration could be placed
-- there RIGHT NOW. Powers the public "When" step: the funnel greys out
-- slots that are already reserved so guests can only pick a slot that
-- will actually pass the Phase 2 insert triggers.
--
-- WHY A SECURITY DEFINER RPC:
--   `bookings` has no anon/public SELECT policy (see Phase 2). The funnel
--   is anonymous, so it cannot read bookings to compute availability. This
--   function runs as its owner, reads bookings internally, and returns ONLY
--   (slot_start, is_available) — no guest data, no booking rows leak out.
--   GRANT EXECUTE is therefore safe for anon/authenticated.
--
-- SOURCE OF TRUTH:
--   The availability test mirrors the Phase 2 BEFORE-INSERT triggers exactly
--   so the preview never disagrees with the real insert:
--     * property capacity  — check_property_capacity()  (capacity_reserved sum
--                             over overlapping active bookings vs max_concurrent_groups)
--     * prospective capacity — set_capacity_reserved()  (host = full property, else 1)
--     * instructor exclusion — no_instructor_overlap EXCLUDE constraint
--                             (private_lesson only; needs >=1 free active instructor)
--   It is advisory, not authoritative: the triggers remain the final guard at
--   insert time. A slot shown available can still lose the race; the create
--   action already surfaces that as a friendly "slot just filled" error.
--
-- Timezone + day-of-week match validate_booking_start_time() /
-- create_public_booking(): slot wall-clock times are interpreted in the
-- property's timezone. EXTRACT(DOW FROM date) is timezone-independent and
-- matches the client's dayOfWeekFromISO().
-- =============================================================

CREATE OR REPLACE FUNCTION get_slot_availability(
  p_property_id    uuid,
  p_date           date,
  p_booking_type   booking_type_enum,
  p_duration_hours integer
)
RETURNS TABLE (slot_start time, is_available boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone             text;
  v_max                  integer;
  v_day_of_week          smallint;
  v_prospective_capacity integer;
BEGIN
  SELECT timezone, max_concurrent_groups
    INTO v_timezone, v_max
  FROM properties
  WHERE id = p_property_id;

  -- Unknown property → no slots (the page already 404s before this runs).
  IF v_timezone IS NULL THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::smallint;

  -- host_an_occasion reserves the whole property; everything else reserves 1.
  v_prospective_capacity := CASE
    WHEN p_booking_type = 'host_an_occasion' THEN v_max
    ELSE 1
  END;

  RETURN QUERY
  WITH candidate AS (
    SELECT
      ts.slot_start AS s_start,
      (p_date + ts.slot_start) AT TIME ZONE v_timezone AS s_from,
      ((p_date + ts.slot_start) AT TIME ZONE v_timezone)
        + (p_duration_hours * interval '1 hour') AS s_to
    FROM time_slots ts
    WHERE ts.property_id = p_property_id
      AND ts.day_of_week = v_day_of_week
      AND ts.is_active   = true
  )
  SELECT
    c.s_start,
    (
      -- (1) property capacity allows one more booking of this size
      v_prospective_capacity + COALESCE((
        SELECT SUM(b.capacity_reserved)
        FROM bookings b
        WHERE b.property_id = p_property_id
          AND b.status NOT IN ('cancelled', 'expired', 'denied')
          AND tstzrange(b.start_time, b.end_time, '[)')
              && tstzrange(c.s_from, c.s_to, '[)')
      ), 0) <= v_max
      -- (2) private lessons additionally need a free active instructor
      AND (
        p_booking_type <> 'private_lesson'
        OR EXISTS (
          SELECT 1
          FROM instructors i
          WHERE i.property_id = p_property_id
            AND i.is_active = true
            AND NOT EXISTS (
              SELECT 1
              FROM bookings b2
              WHERE b2.instructor_id = i.id
                AND b2.status NOT IN ('cancelled', 'expired', 'denied')
                AND tstzrange(b2.start_time, b2.end_time, '[)')
                    && tstzrange(c.s_from, c.s_to, '[)')
            )
        )
      )
    ) AS is_available
  FROM candidate c
  ORDER BY c.s_start;
END;
$$;

REVOKE ALL ON FUNCTION get_slot_availability(uuid, date, booking_type_enum, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_slot_availability(uuid, date, booking_type_enum, integer)
  TO anon, authenticated, service_role;

-- Instructor-aware availability — Phase C of the instructor-scheduling plan.
--
-- Three SECURITY DEFINER functions for the instructor-first WHEN step. They read
-- the staff-only schedule tables on the guest's behalf (bypassing RLS) and never
-- expose the raw schedule — only computed availability.
--
--   1. get_instructor_slot_availability — the workhorse. For one instructor +
--      property + date, returns each property time slot with is_available.
--   2. get_instructor_available_dates — composes #1 over a date range.
--   3. list_qualified_instructors — qualified+active instructors for a property,
--      each with their next available date (composes #2).
--
-- A slot is available iff (all in the property's local time):
--   (a) the candidate window fits inside ONE effective availability window
--       (recurring weekly ∪ one-off 'available' exceptions), AND
--   (a') it doesn't overlap any 'unavailable' exception (windowed or whole-day,
--        property-specific or all-property), AND
--   (b) the instructor has no other active booking that conflicts under the
--       travel-padded test (travel_minutes = 0 same-property → plain overlap),
--   (c) property capacity allows one more (private lesson reserves 1 unit).

CREATE OR REPLACE FUNCTION get_instructor_slot_availability(
  p_instructor_id  uuid,
  p_property_id    uuid,
  p_date           date,
  p_duration_hours integer
)
RETURNS TABLE (slot_start time, is_available boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone    text;
  v_max         integer;
  v_day_of_week smallint;
  v_serves      boolean;
BEGIN
  SELECT timezone, max_concurrent_groups
    INTO v_timezone, v_max
  FROM properties
  WHERE id = p_property_id;

  IF v_timezone IS NULL THEN
    RETURN; -- unknown property
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::smallint;

  -- Instructor must be active AND assigned to this property; otherwise every
  -- slot is unavailable.
  v_serves := EXISTS (
    SELECT 1
    FROM instructors i
    JOIN instructor_properties ip ON ip.instructor_id = i.id
    WHERE i.id = p_instructor_id
      AND ip.property_id = p_property_id
      AND i.is_active
  );

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
      AND ts.is_active
  ),
  -- Positive availability windows for the date: recurring weekly + one-off extra.
  avail AS (
    SELECT tstzrange(
             (p_date + a.start_time) AT TIME ZONE v_timezone,
             (p_date + a.end_time)   AT TIME ZONE v_timezone, '[)') AS r
    FROM instructor_availability a
    WHERE a.instructor_id = p_instructor_id
      AND a.property_id   = p_property_id
      AND a.day_of_week   = v_day_of_week
    UNION ALL
    SELECT tstzrange(
             (p_date + e.start_time) AT TIME ZONE v_timezone,
             (p_date + e.end_time)   AT TIME ZONE v_timezone, '[)')
    FROM instructor_availability_exceptions e
    WHERE e.instructor_id  = p_instructor_id
      AND e.property_id    = p_property_id
      AND e.exception_date = p_date
      AND e.kind           = 'available'
  ),
  -- Unavailable blocks: windowed or whole-day; property-specific or all-property.
  blocks AS (
    SELECT CASE
             WHEN e.start_time IS NULL THEN
               tstzrange(
                 (p_date)::timestamp     AT TIME ZONE v_timezone,
                 (p_date + 1)::timestamp AT TIME ZONE v_timezone, '[)')
             ELSE
               tstzrange(
                 (p_date + e.start_time) AT TIME ZONE v_timezone,
                 (p_date + e.end_time)   AT TIME ZONE v_timezone, '[)')
           END AS r
    FROM instructor_availability_exceptions e
    WHERE e.instructor_id  = p_instructor_id
      AND e.exception_date = p_date
      AND e.kind           = 'unavailable'
      AND (e.property_id = p_property_id OR e.property_id IS NULL)
  )
  SELECT
    c.s_start,
    (
      v_serves
      -- (a) fits inside a single positive window
      AND EXISTS (
        SELECT 1 FROM avail w
        WHERE tstzrange(c.s_from, c.s_to, '[)') <@ w.r
      )
      -- (a') not inside any unavailable block
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE tstzrange(c.s_from, c.s_to, '[)') && b.r
      )
      -- (b) no travel-padded conflict with the instructor's other bookings
      AND NOT EXISTS (
        SELECT 1 FROM bookings b2
        WHERE b2.instructor_id = p_instructor_id
          AND b2.status NOT IN ('cancelled', 'expired', 'denied')
          AND tstzrange(c.s_from, c.s_to, '[)') && tstzrange(
                b2.start_time - (travel_minutes(p_property_id, b2.property_id) * interval '1 minute'),
                b2.end_time   + (travel_minutes(p_property_id, b2.property_id) * interval '1 minute'),
                '[)')
      )
      -- (c) property capacity allows one more (private lesson reserves 1)
      AND (1 + COALESCE((
            SELECT SUM(b.capacity_reserved)
            FROM bookings b
            WHERE b.property_id = p_property_id
              AND b.status NOT IN ('cancelled', 'expired', 'denied')
              AND tstzrange(b.start_time, b.end_time, '[)')
                  && tstzrange(c.s_from, c.s_to, '[)')
          ), 0)) <= v_max
    ) AS is_available
  FROM candidate c
  ORDER BY c.s_start;
END;
$$;

REVOKE ALL ON FUNCTION get_instructor_slot_availability(uuid, uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_instructor_slot_availability(uuid, uuid, date, integer)
  TO anon, authenticated, service_role;

-- Dates in [p_from, p_to] with at least one bookable slot for this instructor.
CREATE OR REPLACE FUNCTION get_instructor_available_dates(
  p_instructor_id  uuid,
  p_property_id    uuid,
  p_duration_hours integer,
  p_from           date,
  p_to             date
)
RETURNS TABLE (available_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gs.d::date AS available_date
  FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') AS gs(d)
  WHERE EXISTS (
    SELECT 1
    FROM get_instructor_slot_availability(
      p_instructor_id, p_property_id, gs.d::date, p_duration_hours
    ) s
    WHERE s.is_available
  );
$$;

REVOKE ALL ON FUNCTION get_instructor_available_dates(uuid, uuid, integer, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_instructor_available_dates(uuid, uuid, integer, date, date)
  TO anon, authenticated, service_role;

-- Active instructors assigned to the property and qualified for EVERY requested
-- discipline, each with their next available date in [p_from, p_to] (null if
-- none). Empty/null p_service_ids ⇒ no qualification filter. Ordered for the
-- picker; the UI defaults to the first with a non-null next_available_date.
CREATE OR REPLACE FUNCTION list_qualified_instructors(
  p_property_id    uuid,
  p_service_ids    uuid[],
  p_duration_hours integer,
  p_from           date,
  p_to             date
)
RETURNS TABLE (
  instructor_id       uuid,
  name                text,
  bio                 text,
  photo_url           text,
  display_order       integer,
  next_available_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.name,
    i.bio,
    i.photo_url,
    i.display_order,
    (
      SELECT MIN(d.available_date)
      FROM get_instructor_available_dates(
        i.id, p_property_id, p_duration_hours, p_from, p_to
      ) d
    ) AS next_available_date
  FROM instructors i
  JOIN instructor_properties ip
    ON ip.instructor_id = i.id AND ip.property_id = p_property_id
  WHERE i.is_active
    AND (
      p_service_ids IS NULL
      OR array_length(p_service_ids, 1) IS NULL
      OR NOT EXISTS (
        SELECT unnest(p_service_ids)
        EXCEPT
        SELECT service_id FROM instructor_disciplines WHERE instructor_id = i.id
      )
    )
  ORDER BY i.display_order, i.name;
$$;

REVOKE ALL ON FUNCTION list_qualified_instructors(uuid, uuid[], integer, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_qualified_instructors(uuid, uuid[], integer, date, date)
  TO anon, authenticated, service_role;

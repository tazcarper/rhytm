-- Early-stop next-available-date — Phase C perf fold-in.
--
-- list_qualified_instructors computed each instructor's next_available_date as
-- MIN() over get_instructor_available_dates(from..to), which evaluates EVERY day
-- in the horizon (up to 365) for EVERY qualified instructor, with no short-
-- circuit — even when the instructor is free tomorrow. This replaces that with a
-- day-by-day function that RETURNs on the first bookable date, cutting the
-- per-instructor cost from "always D days" to "days until first hit" (usually
-- 1–3). The full-range get_instructor_available_dates stays — the WHEN-step
-- calendar still needs every available date for the *selected* instructor.

CREATE OR REPLACE FUNCTION instructor_next_available_date(
  p_instructor_id  uuid,
  p_property_id    uuid,
  p_duration_hours integer,
  p_from           date,
  p_to             date
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := p_from;
BEGIN
  WHILE v_day <= p_to LOOP
    IF EXISTS (
      SELECT 1
      FROM get_instructor_slot_availability(p_instructor_id, p_property_id, v_day, p_duration_hours) s
      WHERE s.is_available
    ) THEN
      RETURN v_day; -- first bookable date; stop scanning
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN NULL; -- no availability in range
END;
$$;

REVOKE ALL ON FUNCTION instructor_next_available_date(uuid, uuid, integer, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION instructor_next_available_date(uuid, uuid, integer, date, date)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION instructor_next_available_date(uuid, uuid, integer, date, date) IS
  'First bookable date for an instructor at a property in [p_from, p_to], or NULL. Short-circuits on the first hit (unlike MIN over the full range).';

-- Re-point list_qualified_instructors at the early-stop helper. Signature +
-- returned columns are unchanged — only how next_available_date is computed.
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
    instructor_next_available_date(
      i.id, p_property_id, p_duration_hours, p_from, p_to
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

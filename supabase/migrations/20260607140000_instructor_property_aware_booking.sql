-- Make instructor booking logic multi-property aware.
--
-- The "Add instructor" admin form now records availability in
-- instructor_properties (an instructor may serve several properties). But the
-- two booking RPCs still keyed off the single instructors.property_id, so a
-- multi-property instructor was invisible at every property except their
-- primary. This migration re-points both at the junction:
--   * get_slot_availability  — a private-lesson slot is "available" if any
--     active instructor AVAILABLE AT THE PROPERTY (via instructor_properties)
--     is free in the window.
--   * create_public_booking  — auto-assigns the first active instructor
--     available at the property (via instructor_properties).
-- The junction was backfilled from property_id, so single-property instructors
-- behave exactly as before. Both functions are reproduced verbatim from their
-- latest definitions (20260525120000 / 20260602120000) with ONLY the
-- instructor source changed.

-- 1. Slot availability --------------------------------------------------------

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
      -- (2) private lessons additionally need a free active instructor who is
      --     available at this property (instructor_properties junction).
      AND (
        p_booking_type <> 'private_lesson'
        OR EXISTS (
          SELECT 1
          FROM instructors i
          JOIN instructor_properties ip ON ip.instructor_id = i.id
          WHERE ip.property_id = p_property_id
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

-- 2. Booking creation ---------------------------------------------------------

CREATE OR REPLACE FUNCTION create_public_booking(
  p_property_id      uuid,
  p_booking_type     booking_type_enum,
  p_audience_type    audience_type_enum,
  p_date             date,
  p_slot_start       time,
  p_duration_hours   integer,
  p_instructor_id    uuid,
  p_guest_name       text,
  p_guest_email      text,
  p_guest_phone      text,
  p_guest_count      integer,
  p_guest_notes      text,
  p_estimated_price  numeric,
  p_discipline_ids   uuid[],
  p_add_ons          jsonb,
  p_access_code      text,
  p_member_user_id   uuid DEFAULT NULL
)
RETURNS TABLE (booking_id uuid, bid_id uuid, bid_slug text)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_instructor_id uuid := p_instructor_id;
  v_start_time    timestamptz;
  v_booking_id    uuid;
  v_bid_id        uuid;
  v_bid_slug      text;
  v_faq           jsonb;
  v_gear          jsonb;
BEGIN
  v_start_time := (p_date + p_slot_start) AT TIME ZONE 'America/Chicago';

  -- Auto-assign instructor for private_lesson if the caller didn't pick one.
  -- Source of truth is instructor_properties (availability set), so a
  -- multi-property instructor is assignable at every property they serve.
  IF p_booking_type = 'private_lesson' AND v_instructor_id IS NULL THEN
    SELECT i.id INTO v_instructor_id
    FROM instructors i
    JOIN instructor_properties ip ON ip.instructor_id = i.id
    WHERE ip.property_id = p_property_id
      AND i.is_active = true
    ORDER BY i.display_order
    LIMIT 1;

    IF v_instructor_id IS NULL THEN
      RAISE EXCEPTION 'No active instructors available for this property'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO bookings (
    property_id,
    booking_type,
    start_time,
    duration_hours,
    instructor_id,
    guest_name,
    guest_email,
    guest_phone,
    guest_count,
    guest_notes,
    audience_type,
    estimated_price,
    member_user_id
  ) VALUES (
    p_property_id,
    p_booking_type,
    v_start_time,
    p_duration_hours,
    v_instructor_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_guest_count,
    NULLIF(p_guest_notes, ''),
    p_audience_type,
    p_estimated_price,
    p_member_user_id
  )
  RETURNING id INTO v_booking_id;

  IF p_discipline_ids IS NOT NULL AND array_length(p_discipline_ids, 1) > 0 THEN
    INSERT INTO booking_disciplines (booking_id, service_id)
    SELECT v_booking_id, unnest(p_discipline_ids);
  END IF;

  IF p_add_ons IS NOT NULL AND jsonb_array_length(p_add_ons) > 0 THEN
    INSERT INTO booking_add_ons (
      booking_id, service_id, add_on_id, quantity, unit_price_at_booking
    )
    SELECT
      v_booking_id,
      (a->>'service_id')::uuid,
      (a->>'add_on_id')::uuid,
      (a->>'quantity')::integer,
      ao.price
    FROM jsonb_array_elements(p_add_ons) AS a
    JOIN add_ons ao ON ao.id = (a->>'add_on_id')::uuid;
  END IF;

  -- Auto-fill FAQ + gear from the content library (snapshot at creation).
  SELECT faq, gear INTO v_faq, v_gear
  FROM resolve_bid_content(p_property_id, p_discipline_ids, p_booking_type);

  INSERT INTO bids (booking_id, access_code_hash, access_code_plaintext, faq, gear_list)
  VALUES (
    v_booking_id,
    extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    p_access_code,
    coalesce(v_faq, '[]'::jsonb),
    coalesce(v_gear, '[]'::jsonb)
  )
  RETURNING id, slug INTO v_bid_id, v_bid_slug;

  RETURN QUERY SELECT v_booking_id, v_bid_id, v_bid_slug;
END;
$$;

REVOKE ALL ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) TO service_role;

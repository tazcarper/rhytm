-- Make create_public_booking carry junior_guest_count through to the
-- bookings row. Reproduces 20260608190000's function verbatim except:
--   1. adds a trailing `p_junior_guest_count integer DEFAULT 0` param.
--   2. writes it into bookings.junior_guest_count on insert.
--
-- The arg count changes, so CREATE OR REPLACE would add an overload
-- rather than replace — DROP the prior signature first (same pattern as
-- 20260530140000 / 20260530170100). No other DB function calls this RPC.

DROP FUNCTION IF EXISTS create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
);

CREATE OR REPLACE FUNCTION create_public_booking(
  p_property_id        uuid,
  p_booking_type       booking_type_enum,
  p_audience_type      audience_type_enum,
  p_date               date,
  p_slot_start         time,
  p_duration_hours     integer,
  p_instructor_id      uuid,
  p_guest_name         text,
  p_guest_email        text,
  p_guest_phone        text,
  p_guest_count        integer,
  p_guest_notes        text,
  p_estimated_price    numeric,
  p_discipline_ids     uuid[],
  p_add_ons            jsonb,
  p_access_code        text,
  p_member_user_id     uuid DEFAULT NULL,
  p_junior_guest_count integer DEFAULT 0
)
RETURNS TABLE (booking_id uuid, bid_id uuid, bid_slug text)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_instructor_id uuid := p_instructor_id;
  v_timezone      text;
  v_start_time    timestamptz;
  v_booking_id    uuid;
  v_bid_id        uuid;
  v_bid_slug      text;
  v_faq           jsonb;
  v_gear          jsonb;
BEGIN
  -- Property timezone (fixes the prior America/Chicago hard-code).
  SELECT timezone INTO v_timezone FROM properties WHERE id = p_property_id;
  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Unknown property' USING ERRCODE = 'P0002';
  END IF;
  v_start_time := (p_date + p_slot_start) AT TIME ZONE v_timezone;

  -- Instructor resolution + validation (private lessons only).
  IF p_booking_type = 'private_lesson' THEN
    IF v_instructor_id IS NULL THEN
      -- First active instructor (by display order) qualified for the chosen
      -- disciplines AND free for this exact slot.
      SELECT i.id INTO v_instructor_id
      FROM instructors i
      JOIN instructor_properties ip ON ip.instructor_id = i.id
      WHERE ip.property_id = p_property_id
        AND i.is_active
        AND (
          p_discipline_ids IS NULL
          OR array_length(p_discipline_ids, 1) IS NULL
          OR NOT EXISTS (
            SELECT unnest(p_discipline_ids)
            EXCEPT
            SELECT service_id FROM instructor_disciplines WHERE instructor_id = i.id
          )
        )
        AND EXISTS (
          SELECT 1
          FROM get_instructor_slot_availability(i.id, p_property_id, p_date, p_duration_hours) s
          WHERE s.slot_start = p_slot_start AND s.is_available
        )
      ORDER BY i.display_order
      LIMIT 1;

      IF v_instructor_id IS NULL THEN
        RAISE EXCEPTION 'No qualified instructor is available for this slot'
          USING ERRCODE = 'P0002';
      END IF;
    ELSE
      -- Validate the chosen instructor: qualified for every discipline...
      IF p_discipline_ids IS NOT NULL
         AND array_length(p_discipline_ids, 1) > 0
         AND EXISTS (
           SELECT unnest(p_discipline_ids)
           EXCEPT
           SELECT service_id FROM instructor_disciplines WHERE instructor_id = v_instructor_id
         ) THEN
        RAISE EXCEPTION 'Instructor is not qualified for the selected discipline'
          USING ERRCODE = 'P0004';
      END IF;

      -- ...and free for this exact slot (schedule + travel buffer + capacity).
      IF NOT EXISTS (
        SELECT 1
        FROM get_instructor_slot_availability(v_instructor_id, p_property_id, p_date, p_duration_hours) s
        WHERE s.slot_start = p_slot_start AND s.is_available
      ) THEN
        RAISE EXCEPTION 'Instructor is not available for that time'
          USING ERRCODE = 'P0005';
      END IF;
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
    junior_guest_count,
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
    p_junior_guest_count,
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
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid, integer
) TO service_role;

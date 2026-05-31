-- Phase 1 follow-on: populate access_code_plaintext from the two write
-- paths (create_public_booking, regenerate_bid_access_code).
--
-- Both functions already receive the plaintext as a parameter (`p_access_code`
-- / `p_code`) and bcrypt it inline. The change is one INSERT/UPDATE column
-- each. The bcrypt hash continues to be the validation source of truth —
-- nothing about the read path (validate_bid_access_code) changes.

-- ============================================================
-- Step 1 — create_public_booking
-- ============================================================
--
-- Same signature/body as 20260530140000, with one additional column in
-- the bids INSERT.

DROP FUNCTION IF EXISTS create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
);

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
BEGIN
  v_start_time := (p_date + p_slot_start) AT TIME ZONE 'America/Chicago';

  IF p_booking_type = 'private_lesson' AND v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id
    FROM instructors
    WHERE property_id = p_property_id
      AND is_active = true
    ORDER BY display_order
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

  INSERT INTO bids (booking_id, access_code_hash, access_code_plaintext)
  VALUES (
    v_booking_id,
    extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    p_access_code
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

-- ============================================================
-- Step 2 — regenerate_bid_access_code
-- ============================================================
--
-- Same staff-authz checks as 20260521130000; the UPDATE now writes
-- both the rotated hash and the plaintext.

CREATE OR REPLACE FUNCTION regenerate_bid_access_code(
  p_bid_id uuid,
  p_code   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role        text;
  v_property_id uuid;
  v_authorized  boolean;
  v_updated_id  uuid;
BEGIN
  v_role := (SELECT auth.jwt() -> 'app_metadata' ->> 'role');

  IF v_role NOT IN ('super_admin', 'admin', 'property_manager') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'property_manager' THEN
    v_property_id := (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid);
    SELECT EXISTS (
      SELECT 1
      FROM bids bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = p_bid_id
        AND b.property_id = v_property_id
    ) INTO v_authorized;
    IF NOT v_authorized THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE bids
  SET access_code_hash      = extensions.crypt(p_code, extensions.gen_salt('bf', 10)),
      access_code_plaintext = p_code,
      updated_at            = now()
  WHERE id = p_bid_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'bid_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated_id;
END;
$$;

REVOKE ALL ON FUNCTION regenerate_bid_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION regenerate_bid_access_code(uuid, text) TO authenticated;

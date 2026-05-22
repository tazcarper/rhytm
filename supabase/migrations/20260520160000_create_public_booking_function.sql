-- =============================================================
-- create_public_booking(...)
--
-- Single PL/pgSQL function that atomically creates a booking + its
-- joins + its bid from one App 2 funnel submission. PL/pgSQL runs the
-- whole body inside an implicit transaction — if any step raises, the
-- whole insert chain rolls back. Returns the bid slug so the caller
-- can build the customer-facing URL.
--
-- Called from the service-role Supabase client only (anon has no INSERT
-- RLS on bookings/bids; service-role bypasses RLS). GRANT EXECUTE is
-- limited to service_role to keep anon out even if RLS misconfiguration
-- ever opens the table.
--
-- Insert order (matters):
--   1. bookings           — Phase 2 BEFORE triggers run (end_time,
--                           capacity_reserved, slot validity, capacity
--                           check). Phase 2 instructor exclusion
--                           constraint fires here too (Private Lesson).
--   2. booking_disciplines (one row per service)
--   3. booking_add_ons    (composite FK to service_add_ons enforced;
--                           the deferred discipline trigger runs at
--                           transaction commit)
--   4. bids               — Phase 3 trigger auto-fills slug from
--                           booking.guest_name + start_time; we set the
--                           access_code_hash here from the plaintext
--                           the caller passes.
--
-- Private-lesson instructor: Phase 2's CHECK requires non-null
-- instructor_id for private_lesson. If the caller didn't pre-pick one,
-- the function picks the first active instructor for the property. If
-- none exist, RAISES (caller surfaces as a friendly error).
-- =============================================================

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
  p_access_code      text
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
  -- All public booking times are wall-clock CST/CDT (America/Chicago). Build
  -- the timestamptz here so PG handles DST instead of dragging that into TS.
  v_start_time := (p_date + p_slot_start) AT TIME ZONE 'America/Chicago';


  -- Auto-assign instructor for private_lesson if the caller didn't pick.
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

  -- 1. bookings (BEFORE triggers fire here)
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
    estimated_price
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
    p_estimated_price
  )
  RETURNING id INTO v_booking_id;

  -- 2. booking_disciplines
  IF p_discipline_ids IS NOT NULL AND array_length(p_discipline_ids, 1) > 0 THEN
    INSERT INTO booking_disciplines (booking_id, service_id)
    SELECT v_booking_id, unnest(p_discipline_ids);
  END IF;

  -- 3. booking_add_ons — composite FK (service_id, add_on_id) checked
  --    against service_add_ons. The deferred discipline-membership
  --    trigger runs at COMMIT.
  --
  --    `unit_price_at_booking` is derived from add_ons.price here, NOT
  --    from the payload. The client knows the price (it's displayed in
  --    the form) but isn't trusted with it — a tampered submission with
  --    `unit_price: 0.01` would otherwise become the historical record.
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

  -- 4. bids — slug auto-generated by Phase 3 trigger from
  --    booking.guest_name + start_time. We bcrypt-hash the access code
  --    so the plaintext never touches the table.
  INSERT INTO bids (booking_id, access_code_hash)
  VALUES (
    v_booking_id,
    extensions.crypt(p_access_code, extensions.gen_salt('bf'))
  )
  RETURNING id, slug INTO v_bid_id, v_bid_slug;

  RETURN QUERY SELECT v_booking_id, v_bid_id, v_bid_slug;
END;
$$;

REVOKE ALL ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text
) TO service_role;

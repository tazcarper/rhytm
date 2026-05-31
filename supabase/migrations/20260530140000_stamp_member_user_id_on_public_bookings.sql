-- App 4, sub-phase 4.1 follow-up — link public-funnel bookings to members.
--
-- Problem: the public booking funnel never stamps `member_user_id`.
-- The RPC fills only `guest_email` + `audience_type = 'public'`, even
-- when the booker is a signed-in member with a matching email. Result:
-- a member who books through `/book` cannot see their booking on
-- `/member/bookings` because the household RLS policy filters on
-- `member_user_id`.
--
-- Fix has two parts:
--   1. Extend `create_public_booking` to accept an optional
--      `p_member_user_id`. The submit action passes it when the caller
--      is signed in as `member`. NULL is unchanged behavior.
--   2. One-shot backfill — every existing booking with `member_user_id IS NULL`
--      whose `guest_email` matches a `people.email` (and that person has
--      a `user_id`) gets stamped. `people.email` is UNIQUE so the join
--      is deterministic.
--
-- Safety:
--   - Backfill respects the `one_origin` CHECK by excluding rows that
--     already have `concierge_user_id` set (those are partner-flow
--     bookings; member_user_id and concierge_user_id are mutually
--     exclusive).
--   - Backfill leaves `audience_type` alone — historical labels stay
--     'public' even after stamping. The audience_type carries
--     funnel-of-origin intent; member_user_id carries ownership. Going
--     forward, the submit action sets both consistently.

-- ============================================================
-- Step 1 — Drop the old function signature
-- ============================================================
--
-- `CREATE OR REPLACE FUNCTION` only replaces when the parameter list
-- is identical. Adding a defaulted param would create a separate
-- overload — and Supabase RPC dispatch would pick whichever match
-- depending on which keys are sent, which is exactly the kind of
-- silent ambiguity we don't want. So drop the old one first.

DROP FUNCTION IF EXISTS create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text
);

-- ============================================================
-- Step 2 — Recreate with p_member_user_id added (defaulted)
-- ============================================================
--
-- Identical body to the prior version except:
--   - new trailing `p_member_user_id uuid DEFAULT NULL` parameter
--   - INSERT into bookings includes member_user_id

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
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) TO service_role;

-- ============================================================
-- Step 3 — One-shot backfill
-- ============================================================
--
-- Every booking with NULL member_user_id whose guest_email matches a
-- linked person gets the person's user_id stamped. Excludes any row
-- already attributed via concierge_user_id (mutually exclusive with
-- member_user_id per the `one_origin` CHECK on bookings).
--
-- `people.email` is UNIQUE and `people.user_id` is UNIQUE, so the
-- join produces at most one row per booking. No risk of duplicating
-- updates or hitting the FK because people.user_id REFERENCES
-- auth.users(id) which is the same target as bookings.member_user_id.

UPDATE bookings b
SET member_user_id = p.user_id
FROM people p
WHERE b.member_user_id IS NULL
  AND b.concierge_user_id IS NULL
  AND b.guest_email = p.email
  AND p.user_id IS NOT NULL;

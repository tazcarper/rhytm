-- Soft-delete for bids + bookings (admin dashboard "Delete" action).
--
-- A deleted bid/booking stays in the database (records intact, status
-- preserved) but disappears from every admin surface and the public bid
-- page, and — critically — STOPS HOLDING ITS TIME SLOT so the window can be
-- rebooked. Reversible: an admin can restore it (subject to capacity at
-- restore time).
--
-- Design:
--   * `deleted_at` / `deleted_by` columns on both tables. NULL = live.
--     Orthogonal to `status` — we don't overwrite the lifecycle status, so a
--     restored row comes back exactly as it was.
--   * The four slot-holding gates (the hard double-booking trigger, the
--     instructor travel-buffer trigger, and the two availability RPCs) gain a
--     `deleted_at IS NULL` clause so a deleted booking neither blocks an
--     insert nor shows a slot as taken. Reproduced verbatim from their latest
--     definitions with ONLY that clause added.
--   * `admin_soft_delete_booking` / `admin_restore_booking` are SECURITY
--     DEFINER, is_admin()-gated (super_admin + admin only), and flip BOTH the
--     booking and its bid atomically so the pair never drifts.
--
-- The bids `sync_booking_from_bid` trigger early-returns when status is
-- unchanged, so toggling only `deleted_at` on a bid does not touch booking
-- status. `handle_updated_at` keeps updated_at fresh on both tables.

-- ===========================================================================
-- 1. Columns
-- ===========================================================================

ALTER TABLE bookings
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE bids
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN bookings.deleted_at IS
  'Soft-delete: non-null hides the booking from all admin/public surfaces and releases its time slot. Status is preserved; restore via admin_restore_booking().';
COMMENT ON COLUMN bids.deleted_at IS
  'Soft-delete: non-null hides the bid everywhere and 404s its public page. Set in lockstep with the booking by admin_soft_delete_booking().';

-- Partial indexes: the common read path filters deleted_at IS NULL, and the
-- "Deleted" admin view filters deleted_at IS NOT NULL.
CREATE INDEX idx_bookings_deleted_at ON bookings (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_bids_deleted_at     ON bids     (deleted_at) WHERE deleted_at IS NOT NULL;

-- ===========================================================================
-- 2. Slot-holding gates — exclude soft-deleted rows
-- ===========================================================================

-- 2a. Hard double-booking trigger. A row being soft-deleted holds nothing;
--     deleted rows are excluded from the concurrency SUM.
CREATE OR REPLACE FUNCTION check_property_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_concurrent integer;
  v_max        integer;
BEGIN
  -- Soft-deleted rows do not hold capacity.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Released statuses do not hold capacity
  IF NEW.status IN ('cancelled', 'expired', 'denied') THEN
    RETURN NEW;
  END IF;

  -- Soft estimate requests (provisional slot) skip capacity enforcement
  -- at intake; it re-arms at slot-lock when status → 'awaiting_guest'.
  IF NEW.status = 'pending_review' THEN
    RETURN NEW;
  END IF;

  SELECT max_concurrent_groups INTO v_max
  FROM properties WHERE id = NEW.property_id
  FOR UPDATE;

  SELECT COALESCE(SUM(capacity_reserved), 0) INTO v_concurrent
  FROM bookings
  WHERE property_id = NEW.property_id
    AND status NOT IN ('cancelled', 'expired', 'denied', 'pending_review')
    AND deleted_at IS NULL
    AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
    AND id IS DISTINCT FROM NEW.id;

  IF v_concurrent + NEW.capacity_reserved > v_max THEN
    RAISE EXCEPTION
      'property is at capacity for the requested time window (% of % units in use)',
      v_concurrent, v_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2b. Instructor cross-property travel-buffer trigger.
CREATE OR REPLACE FUNCTION check_instructor_travel_buffer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL
     OR NEW.instructor_id IS NULL
     OR NEW.status IN ('cancelled', 'expired', 'denied') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bookings b2
    WHERE b2.instructor_id = NEW.instructor_id
      AND b2.id IS DISTINCT FROM NEW.id
      AND b2.property_id <> NEW.property_id
      AND b2.status NOT IN ('cancelled', 'expired', 'denied')
      AND b2.deleted_at IS NULL
      AND tstzrange(NEW.start_time, NEW.end_time, '[)') && tstzrange(
            b2.start_time - (travel_minutes(NEW.property_id, b2.property_id) * interval '1 minute'),
            b2.end_time   + (travel_minutes(NEW.property_id, b2.property_id) * interval '1 minute'),
            '[)')
  ) THEN
    RAISE EXCEPTION 'instructor needs travel time between properties for this window'
      USING ERRCODE = 'P0003';
  END IF;

  RETURN NEW;
END;
$$;

-- 2c. Property/booking-type slot availability RPC.
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
          AND b.deleted_at IS NULL
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
                AND b2.deleted_at IS NULL
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

-- 2d. Per-instructor slot availability RPC.
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
          AND b2.deleted_at IS NULL
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
              AND b.deleted_at IS NULL
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

-- ===========================================================================
-- 3. Admin soft-delete / restore RPCs (super_admin + admin only)
-- ===========================================================================

-- Flips the booking and its bid (if any) to deleted in one transaction.
-- Idempotent: re-deleting an already-deleted row is a no-op.
CREATE OR REPLACE FUNCTION admin_soft_delete_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized to delete bookings' USING ERRCODE = '42501';
  END IF;

  UPDATE bookings
     SET deleted_at = now(), deleted_by = v_actor
   WHERE id = p_booking_id AND deleted_at IS NULL;

  UPDATE bids
     SET deleted_at = now(), deleted_by = v_actor
   WHERE booking_id = p_booking_id AND deleted_at IS NULL;
END;
$$;

-- Restores the booking and its bid. The booking UPDATE re-arms the capacity
-- and travel-buffer triggers, so if the slot was taken in the meantime the
-- whole restore rolls back with that trigger's error — surfaced to the admin.
CREATE OR REPLACE FUNCTION admin_restore_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized to restore bookings' USING ERRCODE = '42501';
  END IF;

  UPDATE bookings
     SET deleted_at = NULL, deleted_by = NULL
   WHERE id = p_booking_id AND deleted_at IS NOT NULL;

  UPDATE bids
     SET deleted_at = NULL, deleted_by = NULL
   WHERE booking_id = p_booking_id AND deleted_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION admin_soft_delete_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_restore_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_soft_delete_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_restore_booking(uuid) TO authenticated;

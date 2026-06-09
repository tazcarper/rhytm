-- Cross-property travel buffer — Phase C/F of the instructor-scheduling plan.
--
-- An instructor booked at property A needs transit time before/after a booking
-- at property B. Model travel as an admin-editable property-pair matrix plus a
-- single helper travel_minutes(from,to) that returns 0 WITHIN a property and the
-- configured minutes ACROSS properties — so ONE travel-padded overlap predicate
-- serves both same-property (buffer 0) and cross-property checks everywhere
-- (the availability RPCs in Phase C + the write-time trigger below).

CREATE TABLE property_travel_times (
  from_property_id uuid    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  to_property_id   uuid    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  minutes          integer NOT NULL CHECK (minutes >= 0),
  PRIMARY KEY (from_property_id, to_property_id),
  CONSTRAINT travel_distinct_properties CHECK (from_property_id <> to_property_id)
);

COMMENT ON TABLE property_travel_times IS
  'Admin-editable travel time (minutes) between two properties, used to keep an instructor from being booked too close together at different properties. Stored directional; travel_minutes() reads it symmetrically (max of either direction).';

ALTER TABLE property_travel_times ENABLE ROW LEVEL SECURITY;

-- Staff read (the future matrix editor); admin write. The booking flow never
-- reads this table directly — travel_minutes() (SECURITY DEFINER) does.
CREATE POLICY "property_travel_times: staff read"
  ON property_travel_times FOR SELECT
  USING ((SELECT is_staff()));

CREATE POLICY "property_travel_times: admin write"
  ON property_travel_times FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- 0 within a property; otherwise the configured minutes, read SYMMETRICALLY
-- (max of whichever directions are set) so the buffer is identical regardless of
-- which booking is being checked — an asymmetric matrix can't make A→B and B→A
-- disagree and falsely reject a later status update. Falls back to a
-- conservative 60-min default so an unconfigured pair never becomes "teleport".
-- SECURITY DEFINER so it reads the (staff-only) table from inside the anon-facing
-- availability RPCs and the booking trigger alike.
CREATE OR REPLACE FUNCTION travel_minutes(p_from uuid, p_to uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_from = p_to THEN 0
    ELSE COALESCE(
      (SELECT MAX(minutes) FROM property_travel_times
        WHERE (from_property_id = p_from AND to_property_id = p_to)
           OR (from_property_id = p_to   AND to_property_id = p_from)),
      60
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION travel_minutes(uuid, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION travel_minutes(uuid, uuid) IS
  'Symmetric travel buffer in minutes between two properties: 0 same-property, else the configured value (max of either direction), else a 60-min default. SECURITY DEFINER to read property_travel_times from anon-facing callers.';

-- Write-time integrity: an instructor cannot hold two bookings at DIFFERENT
-- properties whose windows are closer than the travel time between them. The
-- no_instructor_overlap EXCLUDE constraint already blocks true overlaps but
-- cannot express a pair-varying pad, so this trigger adds the buffer. Same-
-- property pairs are skipped here (and travel_minutes is 0 anyway), so adjacent
-- back-to-back lessons at ONE property stay allowed. Padding both ends makes it
-- symmetric in time: it blocks a slot too soon after AND too soon before an
-- existing other-property booking.
--
-- SECURITY INVOKER (matches check_property_capacity): booking writes go through
-- the service-role RPC/actions (BYPASSRLS), so the SELECT sees every booking.
CREATE OR REPLACE FUNCTION check_instructor_travel_buffer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.instructor_id IS NULL OR NEW.status IN ('cancelled', 'expired', 'denied') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bookings b2
    WHERE b2.instructor_id = NEW.instructor_id
      AND b2.id IS DISTINCT FROM NEW.id
      AND b2.property_id <> NEW.property_id
      AND b2.status NOT IN ('cancelled', 'expired', 'denied')
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

-- Runs after bookings_00_compute_end_time sets NEW.end_time.
CREATE TRIGGER bookings_04_check_instructor_travel_buffer
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_instructor_travel_buffer();

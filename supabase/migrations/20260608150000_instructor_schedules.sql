-- Instructor schedules — Phase B of the instructor-scheduling plan
-- (plans/instructor-scheduling-and-availability.md).
--
-- Two layers, both per-property and stored in the property's local time:
--   1. instructor_availability — the recurring WEEKLY pattern (day-of-week +
--      time windows). Multiple rows per (instructor, property, day) = multiple
--      windows (e.g. morning + afternoon).
--   2. instructor_availability_exceptions — date-specific overrides: time off
--      ('unavailable') and one-off extra hours ('available').
--
-- Effective availability for a date = recurring windows for that weekday
--   ∪ 'available' exceptions (that date)  −  'unavailable' exceptions (that date).
-- The booking flow consumes this through SECURITY DEFINER RPCs (Phase C), so the
-- raw tables are NOT anon-readable — only staff read them (for the editor); the
-- DEFINER functions bypass RLS for the public availability computation.
--
-- day_of_week is 0=Sun..6=Sat to match time_slots + EXTRACT(DOW FROM date).

-- 1. Recurring weekly availability --------------------------------------------

CREATE TABLE instructor_availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid     NOT NULL,
  property_id   uuid     NOT NULL,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    time     NOT NULL,
  end_time      time     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_window_valid CHECK (end_time > start_time),
  -- An instructor can only declare hours for a property they're assigned to;
  -- unlinking the property (in save_instructor_profile) cascades these away.
  CONSTRAINT availability_links_property
    FOREIGN KEY (instructor_id, property_id)
    REFERENCES instructor_properties (instructor_id, property_id) ON DELETE CASCADE
);

CREATE INDEX instructor_availability_lookup_idx
  ON instructor_availability (instructor_id, property_id, day_of_week);

COMMENT ON TABLE instructor_availability IS
  'Recurring weekly availability windows per instructor + property, in property-local time. day_of_week 0=Sun..6=Sat. Read by the booking flow via SECURITY DEFINER RPCs (Phase C), never anon-directly.';

ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER instructor_availability_updated_at
  BEFORE UPDATE ON instructor_availability
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- All staff may read (the admin schedule editor); anon/member/partner cannot.
CREATE POLICY "instructor_availability: staff read"
  ON instructor_availability FOR SELECT
  USING ((SELECT is_staff()));

-- Writes: admins anywhere; a property manager only for their own property
-- (own property_id column, no cross-table subquery). Mirrors
-- instructor_properties. In practice writes run via the service-role admin
-- action (requireInstructorManager authorizes first); this is defense-in-depth.
CREATE POLICY "instructor_availability: admin and pm write"
  ON instructor_availability FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- 2. Date-specific exceptions -------------------------------------------------

CREATE TYPE instructor_exception_kind AS ENUM ('unavailable', 'available');

CREATE TABLE instructor_availability_exceptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  -- NULL property = all properties (e.g. a vacation day). Only valid for
  -- 'unavailable'; 'available' must target a specific property + window.
  property_id    uuid REFERENCES properties(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  kind           instructor_exception_kind NOT NULL,
  start_time     time,   -- NULL start+end = whole day
  end_time       time,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exception_window_valid CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  -- One-off EXTRA availability must be property- and window-scoped; time off may
  -- be whole-day and/or all-property.
  CONSTRAINT available_exception_scoped CHECK (
    kind <> 'available' OR (property_id IS NOT NULL AND start_time IS NOT NULL)
  )
);

CREATE INDEX instructor_exceptions_lookup_idx
  ON instructor_availability_exceptions (instructor_id, exception_date);

COMMENT ON TABLE instructor_availability_exceptions IS
  'Date-specific schedule overrides: ''unavailable'' (time off; whole-day and/or all-property allowed) and ''available'' (one-off extra hours; must be property + window scoped). Read by the booking flow via SECURITY DEFINER RPCs, never anon-directly.';

ALTER TABLE instructor_availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_exceptions: staff read"
  ON instructor_availability_exceptions FOR SELECT
  USING ((SELECT is_staff()));

-- Writes: admins anywhere; a property manager for their property. A property
-- manager cannot create all-property (NULL property_id) rows — the equality is
-- NULL there, so the policy denies it; those stay an admin action.
CREATE POLICY "instructor_exceptions: admin and pm write"
  ON instructor_availability_exceptions FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- 3. Atomic replace-all save for the recurring weekly schedule ----------------
-- The editor submits an instructor's ENTIRE recurring schedule (all windows,
-- all properties) at once; this clears their windows and reinserts the set in
-- one transaction. Nothing references instructor_availability, so delete +
-- reinsert is safe. The availability_links_property FK rejects any window for a
-- property the instructor isn't assigned to (surfaced to the user). Exceptions
-- are single-row add/delete and don't need an RPC.
--
-- SECURITY INVOKER; execute locked to service_role (called by the admin action
-- after requireInstructorManager authorizes), same model as
-- save_instructor_profile.
CREATE OR REPLACE FUNCTION save_instructor_schedule(
  p_instructor_id uuid,
  p_windows       jsonb
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM instructors WHERE id = p_instructor_id) THEN
    RAISE EXCEPTION 'instructor not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM instructor_availability WHERE instructor_id = p_instructor_id;

  INSERT INTO instructor_availability
    (instructor_id, property_id, day_of_week, start_time, end_time)
  SELECT
    p_instructor_id,
    (window_row ->> 'property_id')::uuid,
    (window_row ->> 'day_of_week')::smallint,
    (window_row ->> 'start_time')::time,
    (window_row ->> 'end_time')::time
  FROM jsonb_array_elements(COALESCE(p_windows, '[]'::jsonb)) AS window_row;
END;
$$;

REVOKE ALL ON FUNCTION save_instructor_schedule(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION save_instructor_schedule(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION save_instructor_schedule(uuid, jsonb) IS
  'Atomic replace-all of an instructor''s recurring weekly availability. Clears + reinserts all windows in one transaction. SECURITY INVOKER; execute locked to service_role.';

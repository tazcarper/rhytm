-- Instructor creation from the admin dashboard: multi-property availability +
-- contact details.
--
-- The "Add instructor" form (app/admin/instructors) creates an instructor with
-- a name, a required email, an optional phone, and one-or-more properties they
-- are available for. This migration adds what that needs:
--   1. instructor_properties — the set of properties an instructor is available
--      for. `instructors.property_id` stays as the (NOT NULL) PRIMARY property
--      so existing consumers + the property_manager write policy keep working;
--      this junction is the full availability set (and includes the primary).
--      Existing instructors are backfilled from their property_id.
--   2. phone on instructor_portal_access — instructor contact info lives here,
--      NOT on `instructors`, because the catalog has a public-read policy and
--      RLS can't hide columns (same reason email is here). The access row is now
--      created with the instructor (email/phone known up front, user_id null
--      until invited), so invited_at must be nullable.

-- 1. Availability junction ----------------------------------------------------

CREATE TABLE instructor_properties (
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (instructor_id, property_id)
);

CREATE INDEX instructor_properties_property_idx
  ON instructor_properties (property_id);

COMMENT ON TABLE instructor_properties IS
  'Properties an instructor is available for. instructors.property_id remains the primary; this is the full availability set (includes the primary).';

-- Backfill every existing instructor's primary property into the set.
INSERT INTO instructor_properties (instructor_id, property_id)
  SELECT id, property_id FROM instructors
  ON CONFLICT DO NOTHING;

ALTER TABLE instructor_properties ENABLE ROW LEVEL SECURITY;

-- Associations carry no PII; public read keeps a future public booking flow
-- able to list instructors by property without a new policy. Mirrors the
-- service_add_ons "public read" pattern.
CREATE POLICY "instructor_properties: public read"
  ON instructor_properties FOR SELECT
  USING (true);

-- Writes: admins anywhere; a property manager only for their own property
-- (the junction's own property_id column — no cross-table subquery).
CREATE POLICY "instructor_properties: admin and pm write"
  ON instructor_properties FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- 2. Contact details on the (private) access table ----------------------------

ALTER TABLE instructor_portal_access
  ADD COLUMN phone text;

COMMENT ON COLUMN instructor_portal_access.phone IS
  'Optional instructor contact phone. Stored here (not on instructors) so the catalog''s public-read policy never exposes it.';

-- The access row is now created with the instructor (before any invite), so
-- invited_at is null until they are actually invited.
ALTER TABLE instructor_portal_access
  ALTER COLUMN invited_at DROP NOT NULL,
  ALTER COLUMN invited_at DROP DEFAULT;

-- Instructor qualifications: which disciplines (services) each instructor is
-- certified to teach. Phase A of the instructor-scheduling plan
-- (plans/instructor-scheduling-and-availability.md).
--
-- A guest booking a private lesson should only be offered instructors who can
-- teach the discipline(s) they picked. This junction captures that pairing.
-- Like instructor_properties it carries no PII and is public-read, so the
-- booking flow can list/filter instructors by discipline without a bespoke
-- policy. Services are property-scoped, so a row should reference a service at
-- one of the instructor's instructor_properties (the admin UI + the save
-- service enforce this; the DB keeps the FK to services only).

CREATE TABLE instructor_disciplines (
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services(id)    ON DELETE CASCADE,
  PRIMARY KEY (instructor_id, service_id)
);

CREATE INDEX instructor_disciplines_service_idx
  ON instructor_disciplines (service_id);

COMMENT ON TABLE instructor_disciplines IS
  'Disciplines (services) an instructor is qualified to teach. Public-read (no PII); used by the booking flow to offer only qualified instructors. Services are property-scoped — a row should reference a service at one of the instructor''s instructor_properties.';

ALTER TABLE instructor_disciplines ENABLE ROW LEVEL SECURITY;

-- Public read: lets the booking flow list/filter instructors by discipline
-- without a new policy. Mirrors instructor_properties + service_add_ons.
CREATE POLICY "instructor_disciplines: public read"
  ON instructor_disciplines FOR SELECT
  USING (true);

-- Writes: super_admin/admin. Property managers manage their roster through the
-- service-role admin action (requireInstructorManager authorizes them first),
-- which bypasses RLS — exactly like the instructor_properties sync in
-- saveInstructorProfile. Kept admin-only here (rather than an inline
-- cross-table property_manager check on services.property_id) to avoid a
-- cross-table subquery in the policy, per the project's RLS rules. FOR ALL with
-- only USING applies the same check to INSERT (WITH CHECK defaults to USING).
CREATE POLICY "instructor_disciplines: admin write"
  ON instructor_disciplines FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

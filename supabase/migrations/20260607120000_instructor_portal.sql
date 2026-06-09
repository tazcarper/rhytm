-- Instructor Portal — give instructors a login + a read-only "gameplan" of
-- the events they're about to teach.
--
-- Until now instructors were catalog rows only (name/bio/photo), referenced
-- by bookings.instructor_id, with no auth identity. This migration:
--   1. Adds instructor_portal_access — a SEPARATE table binding an instructor
--      to an auth.users account (+ the invite email). Portal identity lives
--      apart from the `instructors` catalog ON PURPOSE: `instructors` has a
--      "public read active" policy (the public booking flow lists active
--      instructors), and RLS is row-level — it can't hide columns. Putting
--      user_id/email on `instructors` would leak instructor emails to anon.
--      A dedicated table with strict RLS keeps the catalog clean.
--   2. Adds two SECURITY DEFINER selector functions resolving the current
--      instructor and the bookings they own — used by RLS to avoid inline
--      cross-table subqueries (CLAUDE.md "RLS Rules", esp. #2). Template:
--      current_person_id() in 20260518235335_rls_helpers_for_member_access.sql.
--   3. Adds additive, permissive SELECT policies so a signed-in instructor can
--      read their own catalog row + assigned bookings + the child rows the
--      gameplan renders (disciplines, the bid's schedule notes, signed
--      waivers). These only widen access for the instructor; existing policies
--      are untouched. properties (public read USING true) and services (public
--      read active) already cover the property + discipline names.
--
-- Cycle audit (RLS rule #5): the child-table policies reach `bookings` only
-- through instructor_visible_booking_ids(), `bookings` reaches the access table
-- only through current_instructor_id(), and the `instructors` self-read reaches
-- the access table only through current_instructor_id(). All three selectors
-- are SECURITY DEFINER (opaque to the planner), so no policy-dependency cycle
-- forms.

-- 1. Portal identity table ----------------------------------------------------

CREATE TABLE instructor_portal_access (
  instructor_id uuid PRIMARY KEY REFERENCES instructors(id) ON DELETE CASCADE,
  user_id       uuid UNIQUE REFERENCES auth.users(id),
  email         text,
  invited_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE instructor_portal_access IS
  'Binds an instructor to an auth account for the /instructor gameplan portal. Linked at invite time by inviteInstructorToPortal. Kept separate from instructors so the catalog''s public-read policy never exposes emails.';

-- One portal login per email (case-insensitive), among rows that have one.
CREATE UNIQUE INDEX instructor_portal_access_email_unique
  ON instructor_portal_access (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE instructor_portal_access ENABLE ROW LEVEL SECURITY;

-- The instructor reads their own access row (e.g. inactive instructors who
-- aren't covered by instructors' public-read-active). Staff read all (work
-- contacts). No member/partner/anon policy → invisible to them. Writes go
-- through the service-role admin actions, so no write policy here.
CREATE POLICY "instructor_portal_access: self read"
  ON instructor_portal_access FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "instructor_portal_access: staff read"
  ON instructor_portal_access FOR SELECT
  USING ((SELECT is_staff()));

-- 2. Selector functions (SECURITY DEFINER, opaque to the planner) -------------

CREATE OR REPLACE FUNCTION current_instructor_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- The instructor bound to the caller's auth account. NULL for any
  -- non-instructor, which makes every policy below match zero rows for them.
  SELECT instructor_id FROM instructor_portal_access
  WHERE user_id = (SELECT auth.uid());
$$;

COMMENT ON FUNCTION current_instructor_id() IS
  'SECURITY DEFINER: returns the instructor_id bound to auth.uid() via instructor_portal_access, bypassing RLS to break policy cycles. NULL for non-instructors.';

CREATE OR REPLACE FUNCTION instructor_visible_booking_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Every booking assigned to the current instructor. The product-level
  -- "confirmed + upcoming" filter lives in the service query, not here: RLS
  -- is the security boundary (an instructor owns all their assigned
  -- bookings); the list view narrows it.
  SELECT id FROM bookings WHERE instructor_id = current_instructor_id();
$$;

COMMENT ON FUNCTION instructor_visible_booking_ids() IS
  'SECURITY DEFINER: returns the booking ids assigned to the current instructor, bypassing RLS to break policy cycles. Empty for non-instructors.';

-- 3. Instructor read policies (additive / permissive) -------------------------
-- All auth.uid()/selector calls wrapped in (SELECT …) to force a single
-- InitPlan evaluation per query (RLS rule #3).

CREATE POLICY "instructors: instructor reads self"
  ON instructors FOR SELECT
  USING (id = (SELECT current_instructor_id()));

CREATE POLICY "bookings: instructor reads assigned"
  ON bookings FOR SELECT
  USING (instructor_id = (SELECT current_instructor_id()));

CREATE POLICY "booking_disciplines: instructor reads assigned"
  ON booking_disciplines FOR SELECT
  USING (booking_id IN (SELECT instructor_visible_booking_ids()));

CREATE POLICY "bids: instructor reads assigned"
  ON bids FOR SELECT
  USING (booking_id IN (SELECT instructor_visible_booking_ids()));

CREATE POLICY "waiver_documents: instructor reads assigned"
  ON waiver_documents FOR SELECT
  USING (booking_id IN (SELECT instructor_visible_booking_ids()));

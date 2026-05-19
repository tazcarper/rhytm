-- Split `members` into `people` + `memberships` + `membership_people`.
--
-- The original Phase 4 `members` table conflated two concepts:
--   1. The membership account (member_number, tier, dues, status)
--   2. The person (email, name, phone, auth account)
--
-- Country clubs commonly let multiple humans share one membership
-- (spouses, family, authorized users). The original model couldn't
-- express that — one row was one membership AND one person.
--
-- This migration normalizes the split:
--
--   memberships          — the account / number / tier / dues / status
--   people               — the human (email, name, phone, auth link)
--   membership_people    — junction: which people are authorized on
--                          which membership, with role + status
--
-- A person can be on N memberships (cross-property + household).
-- A membership can have N people (primary + spouse + dependents).
-- Exactly one `primary` person per active membership (partial unique
-- index enforces this).
--
-- Pre-launch with only test data, so this is a destructive recreation:
-- drops `members`, drops `member_adventure_rsvps` (which referenced
-- `members`), recreates RSVPs against the new `memberships`. No data
-- migration needed.
--
-- Also updates `member_adventures` RLS to traverse the new junction
-- for the member read policy.

-- ============================================================
-- Step 1 — Drop dependent objects
-- ============================================================
-- Order matters: rsvps reference members via FK, so they go first.
-- CASCADE on the drops handles any triggers / policies attached.

DROP TABLE IF EXISTS member_adventure_rsvps CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- ============================================================
-- Step 2 — Create tables (no policies yet — policies reference
-- across tables, so they go in a single block at the end).
-- ============================================================

-- ---- people ----
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Auth link. Nullable until the person accepts their invite.
  -- UNIQUE: one auth user maps to exactly one person. (One human can
  -- still have N memberships via the junction.)
  user_id uuid UNIQUE REFERENCES auth.users(id),

  -- Identity. Email is the unique person identifier in this system.
  email      text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  phone      text,

  -- Invitation state. Tracks the magic-link lifecycle for first sign-in.
  invited_at         timestamptz,
  invite_accepted_at timestamptz,
  invite_expires_at  timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_user_id ON people (user_id) WHERE user_id IS NOT NULL;

CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- ---- memberships ----
CREATE TABLE memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),

  member_number    text NOT NULL,
  membership_tier  text,  -- pending Q9
  status           membership_status_enum NOT NULL DEFAULT 'pending',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Member numbers are unique within a property.
  UNIQUE (property_id, member_number)
);

CREATE INDEX idx_memberships_property ON memberships (property_id, status);

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- ---- membership_people (junction) ----
CREATE TABLE membership_people (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  role   text NOT NULL DEFAULT 'primary'
         CHECK (role IN ('primary', 'spouse', 'dependent', 'authorized')),
  status text NOT NULL DEFAULT 'active'
         CHECK (status IN ('active', 'inactive')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A person can only be on a given membership once.
  UNIQUE (membership_id, person_id)
);

-- Exactly one *active primary* per membership. A membership without a
-- primary is allowed transiently (e.g., during a primary-replacement
-- workflow), but two active primaries is never valid.
CREATE UNIQUE INDEX idx_memberships_one_primary
  ON membership_people (membership_id)
  WHERE role = 'primary' AND status = 'active';

CREATE INDEX idx_membership_people_membership ON membership_people (membership_id);
CREATE INDEX idx_membership_people_person     ON membership_people (person_id);

CREATE TRIGGER membership_people_updated_at
  BEFORE UPDATE ON membership_people
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE membership_people ENABLE ROW LEVEL SECURITY;

-- ---- member_adventure_rsvps (recreated with new FKs) ----
--
-- Two FKs now:
--   membership_id        — the account the RSVP is under (cancellation
--                          ownership, capacity attribution)
--   created_by_person_id — the human who made it (audit trail). Either
--                          spouse can cancel an RSVP made by the other.
--
-- UNIQUE (adventure_id, membership_id): Sarah and John on the same
-- membership can't both RSVP to the same adventure separately. One
-- RSVP per membership per adventure; guest_count covers all attendees.

CREATE TABLE member_adventure_rsvps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id  uuid NOT NULL REFERENCES member_adventures(id),
  membership_id uuid NOT NULL REFERENCES memberships(id),
  created_by_person_id uuid REFERENCES people(id),

  guest_count integer NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  status      rsvp_status_enum NOT NULL DEFAULT 'confirmed',

  deposit_payment_intent_id  text,
  balance_payment_intent_id  text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (adventure_id, membership_id)
);

CREATE INDEX idx_rsvps_adventure  ON member_adventure_rsvps (adventure_id, status);
CREATE INDEX idx_rsvps_membership ON member_adventure_rsvps (membership_id);

CREATE TRIGGER member_adventure_rsvps_updated_at
  BEFORE UPDATE ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Re-attach the capacity / sold_out triggers (Phase 5 functions still
-- exist — DROP TABLE CASCADE dropped the trigger bindings, not the
-- functions). The function bodies don't reference `members` at all,
-- so they don't need to change.
CREATE TRIGGER rsvps_check_capacity
  BEFORE INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION check_adventure_capacity();

CREATE TRIGGER rsvps_sync_adventure_sold_out
  AFTER INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION sync_adventure_sold_out();

ALTER TABLE member_adventure_rsvps ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3 — RLS policies
-- ============================================================
-- All four tables exist now; policies can reference each other freely.

-- ---- people ----
CREATE POLICY "people: self read"
  ON people FOR SELECT
  USING (
    auth_role() = 'member'
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY "people: admin read"
  ON people FOR SELECT
  USING (is_admin());

CREATE POLICY "people: property_manager read"
  ON people FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1
      FROM membership_people mp
      JOIN memberships m ON m.id = mp.membership_id
      WHERE mp.person_id = people.id
        AND mp.status = 'active'
        AND m.property_id = auth_property_id()
    )
  );

CREATE POLICY "people: membership_coordinator read"
  ON people FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND EXISTS (
      SELECT 1
      FROM membership_people mp
      JOIN memberships m ON m.id = mp.membership_id
      WHERE mp.person_id = people.id
        AND mp.status = 'active'
        AND m.property_id = auth_property_id()
    )
  );

CREATE POLICY "people: admin write"
  ON people FOR ALL
  USING (is_admin());

-- Person-level edits (name, phone) for non-admins route through Server
-- Actions — same column-allowlist reasoning as Phase 4. No FOR UPDATE
-- policy for member role.

-- ---- memberships ----
CREATE POLICY "memberships: member read"
  ON memberships FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (
      SELECT 1
      FROM membership_people mp
      JOIN people p ON p.id = mp.person_id
      WHERE mp.membership_id = memberships.id
        AND p.user_id = (SELECT auth.uid())
        AND mp.status = 'active'
    )
  );

CREATE POLICY "memberships: admin read"
  ON memberships FOR SELECT
  USING (is_admin());

CREATE POLICY "memberships: property_manager read"
  ON memberships FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

CREATE POLICY "memberships: membership_coordinator read"
  ON memberships FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND property_id = auth_property_id()
  );

CREATE POLICY "memberships: admin write"
  ON memberships FOR ALL
  USING (is_admin());

CREATE POLICY "memberships: membership_coordinator update"
  ON memberships FOR UPDATE
  USING (
    auth_role() = 'membership_coordinator'
    AND property_id = auth_property_id()
  );

-- ---- membership_people ----
-- Members read junction rows for memberships they're on. Lets Sarah
-- see John's row on her shared membership (both are legitimate users).
CREATE POLICY "membership_people: member read same membership"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'member'
    AND membership_id IN (
      SELECT mp.membership_id
      FROM membership_people mp
      JOIN people p ON p.id = mp.person_id
      WHERE p.user_id = (SELECT auth.uid())
        AND mp.status = 'active'
    )
  );

CREATE POLICY "membership_people: admin read"
  ON membership_people FOR SELECT
  USING (is_admin());

CREATE POLICY "membership_people: property_manager read"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id
        AND m.property_id = auth_property_id()
    )
  );

CREATE POLICY "membership_people: membership_coordinator read"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id
        AND m.property_id = auth_property_id()
    )
  );

CREATE POLICY "membership_people: admin write"
  ON membership_people FOR ALL
  USING (is_admin());

CREATE POLICY "membership_people: membership_coordinator write"
  ON membership_people FOR ALL
  USING (
    auth_role() = 'membership_coordinator'
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id
        AND m.property_id = auth_property_id()
    )
  );

-- ---- member_adventure_rsvps ----
CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND membership_id IN (
      SELECT mp.membership_id
      FROM membership_people mp
      JOIN people p ON p.id = mp.person_id
      WHERE p.user_id = (SELECT auth.uid())
        AND mp.status = 'active'
    )
  );

-- Insert: only against active memberships the person is on, and only
-- when the parent membership itself is active.
CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (
    auth_role() = 'member'
    AND membership_id IN (
      SELECT mp.membership_id
      FROM membership_people mp
      JOIN people p      ON p.id = mp.person_id
      JOIN memberships m ON m.id = mp.membership_id
      WHERE p.user_id = (SELECT auth.uid())
        AND mp.status = 'active'
        AND m.status = 'active'
    )
  );

-- No UPDATE policy for members — cancellations route through Server
-- Actions (same column-allowlist reasoning as Phase 4).

CREATE POLICY "rsvps: admin read all"
  ON member_adventure_rsvps FOR SELECT
  USING (is_admin());

CREATE POLICY "rsvps: property_manager read"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM member_adventures a
      WHERE a.id = adventure_id
        AND a.property_id = auth_property_id()
    )
  );

CREATE POLICY "rsvps: staff update"
  ON member_adventure_rsvps FOR UPDATE
  USING (
    is_admin()
    OR (
      auth_role() = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM member_adventures a
        WHERE a.id = adventure_id
          AND a.property_id = auth_property_id()
      )
    )
  );

-- ============================================================
-- Step 4 — update member_adventures member-read policy
-- ============================================================
-- The Phase 5 policy joined `members.user_id = auth.uid()` to scope
-- adventures to a member's active properties. Same logic now traverses
-- the people → membership_people → memberships chain.

DROP POLICY IF EXISTS "adventures: member read published" ON member_adventures;

CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (
      SELECT m.property_id
      FROM memberships m
      JOIN membership_people mp ON mp.membership_id = m.id
      JOIN people p             ON p.id = mp.person_id
      WHERE p.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND mp.status = 'active'
    )
  );

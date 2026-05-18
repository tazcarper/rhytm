-- Phase 4: Auth and Users
--
-- Builds:
--   1. Five JWT claim helper functions used by RLS in every phase.
--      No auth_member_id() — members can hold memberships at multiple
--      properties (cross-property model), so a single member_id claim
--      in app_metadata cannot represent the full picture. Member-facing
--      policies join `members` on user_id = auth.uid() instead.
--   2. partner_organizations — one row per hotel/resort partner.
--   3. membership_status_enum + members — bulk-seeded from Excel,
--      linked to auth.users when the magic-link invite is accepted.
--
-- Application-layer pieces (NOT in this migration):
--   - /auth/callback route handler that links auth.users → members rows
--     for every pending row matching the user's email, with invite
--     expiry enforcement.
--   - Inngest seed-member-invites function (groups by email, sends one
--     invite per unique email, updates invited_at/invite_expires_at).
--
-- Helper functions are SECURITY INVOKER (default). SECURITY DEFINER
-- here would be a footgun if anyone later extended a helper to read
-- tables. They wrap auth.jwt() in (SELECT auth.jwt()) for InitPlan
-- caching — one parse per query, not one per row.

-- ============================================================
-- Step 1 — JWT claim helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT (SELECT auth.jwt()) -> 'app_metadata' ->> 'role';
$$;

CREATE OR REPLACE FUNCTION auth_property_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'property_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth_partner_org_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'partner_org_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT auth_role() IN ('super_admin', 'admin');
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT auth_role() IN (
    'super_admin', 'admin', 'property_manager',
    'concierge', 'membership_coordinator'
  );
$$;

-- ============================================================
-- Step 2 — partner_organizations
-- ============================================================

CREATE TABLE partner_organizations (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid    NOT NULL REFERENCES properties(id),
  name        text    NOT NULL,
  status      text    NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_orgs_property ON partner_organizations (property_id, status);

CREATE TRIGGER partner_organizations_updated_at
  BEFORE UPDATE ON partner_organizations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE partner_organizations ENABLE ROW LEVEL SECURITY;

-- Admin sees all
CREATE POLICY "partner_orgs: admin read"
  ON partner_organizations FOR SELECT
  USING (is_admin());

-- Property manager sees orgs for their property
CREATE POLICY "partner_orgs: property_manager read"
  ON partner_organizations FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- Partner concierge sees their own org
CREATE POLICY "partner_orgs: partner read own"
  ON partner_organizations FOR SELECT
  USING (
    auth_role() = 'partner'
    AND id = auth_partner_org_id()
  );

-- Admin-only writes — split into explicit insert/update/delete so the
-- intent is obvious on Phase 7 audit. `FOR ALL` would also govern
-- SELECT, redundantly with the three explicit SELECT policies above.
CREATE POLICY "partner_orgs: admin insert"
  ON partner_organizations FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "partner_orgs: admin update"
  ON partner_organizations FOR UPDATE USING (is_admin());

CREATE POLICY "partner_orgs: admin delete"
  ON partner_organizations FOR DELETE USING (is_admin());

-- ============================================================
-- Step 3 — members
-- ============================================================

CREATE TYPE membership_status_enum AS ENUM (
  'pending',    -- application submitted, not yet approved
  'active',     -- approved and in good standing
  'inactive',   -- deactivated (no dues lapse, manual deactivation)
  'lapsed',     -- dues not paid (pending Q16 — annual dues)
  'suspended'   -- suspended by staff action
);

CREATE TABLE members (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid    NOT NULL REFERENCES properties(id),

  -- Supabase Auth link (null until the member accepts their invite).
  -- UNIQUE allows multiple null rows (Postgres treats NULLs as distinct
  -- by default), so pre-invite cross-property members can coexist.
  user_id     uuid    UNIQUE REFERENCES auth.users(id),

  -- Identity (seeded from Excel roster)
  member_number text  NOT NULL,
  first_name    text  NOT NULL,
  last_name     text  NOT NULL,
  email         text  NOT NULL,
  phone         text,

  -- Membership
  membership_tier   text,                                     -- pending Q9
  status            membership_status_enum NOT NULL DEFAULT 'pending',

  -- Invitation state
  invited_at         timestamptz,
  invite_accepted_at timestamptz,
  invite_expires_at  timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Cross-property: the same email at two properties is two rows.
  -- Uniqueness is therefore scoped to property_id.
  UNIQUE (property_id, email),
  UNIQUE (property_id, member_number)
);

CREATE INDEX idx_members_property ON members (property_id, status);
-- idx_members_email indexes only email (no property_id) so the invite
-- callback can do `WHERE email = $1` across all properties.
CREATE INDEX idx_members_email    ON members (email);
CREATE INDEX idx_members_user_id  ON members (user_id) WHERE user_id IS NOT NULL;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Admin reads all members
CREATE POLICY "members: admin read"
  ON members FOR SELECT
  USING (is_admin());

-- Property manager reads members of their property
CREATE POLICY "members: property_manager read"
  ON members FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- Membership coordinator reads members of their property
CREATE POLICY "members: membership_coordinator read"
  ON members FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND property_id = auth_property_id()
  );

-- Member reads their own record(s). With cross-property memberships,
-- a single user_id can own multiple rows — the policy returns all of them.
CREATE POLICY "members: member read own"
  ON members FOR SELECT
  USING (
    auth_role() = 'member'
    AND user_id = auth.uid()
  );

-- Members do NOT have a direct UPDATE policy. RLS is row-level, not
-- column-level, so an UPDATE policy for the member role would allow
-- them to change any column on their own row (status, membership_tier,
-- member_number, property_id, etc.) using just the publishable-key
-- Supabase client from the browser. Member profile edits (phone, etc.)
-- go through a Server Action that uses the secret key and enforces
-- the column allowlist.

-- Membership coordinator can update member status and tier within their property
CREATE POLICY "members: membership_coordinator update"
  ON members FOR UPDATE
  USING (
    auth_role() = 'membership_coordinator'
    AND property_id = auth_property_id()
  );

-- Admin full write
CREATE POLICY "members: admin write"
  ON members FOR ALL
  USING (is_admin());

-- INSERTs (Excel seeding, new applications) come through the secret-key
-- (service-role) Server Actions, which bypass RLS. No INSERT policy needed.

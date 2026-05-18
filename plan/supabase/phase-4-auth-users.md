# Phase 4 — Auth and Users

## Prerequisites

- Phase 1 complete (`properties` seeded)
- Supabase project created with Auth enabled
- No application tables from this phase depend on Phase 2 or 3, but Phase 2 FKs reference `auth.users(id)` which is managed by Supabase Auth

## What This Phase Builds

`partner_organizations`, `members`

Plus: the `app_metadata` role contract for every user type, the member invite flow, and the JWT claim helper functions used by RLS in every phase.

---

## User Types and Their Auth Model

Three distinct user populations, each with a different auth flow and a different `app_metadata` shape.

### Staff (internal Rhythm employees)

Created manually in the Supabase Auth dashboard or via the Admin API. Roles are set in `app_metadata` — not in a database table. RLS policies read the JWT claim directly, so there is no role table to keep in sync.

**Role hierarchy:**

| Role | Scope |
|---|---|
| `super_admin` | All properties, all data, all operations |
| `admin` | All properties, all data, all operations |
| `property_manager` | Full access scoped to their `property_id` |
| `concierge` | Bookings and bids they own; no pricing or member data |
| `membership_coordinator` | Members and applications; no booking access |

**`app_metadata` shape — cross-property staff (super_admin, admin):**
```json
{
  "role": "super_admin"
}
```

**`app_metadata` shape — property-scoped staff:**
```json
{
  "role": "property_manager",
  "property_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Set via Supabase Admin API (server-side only — `app_metadata` cannot be written by the client):
```typescript
// In a Server Action using the service role client
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: {
    role: 'property_manager',
    property_id: propertyId,
  }
})
```

### Partner concierges (external hotel/resort staff)

Each partner concierge is a Supabase Auth account linked to a `partner_organizations` row. They log in with email + magic link (same as members). Their `app_metadata` identifies them as `partner` role and carries their `partner_org_id`.

**`app_metadata` shape:**
```json
{
  "role": "partner",
  "partner_org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "property_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Members

Members log in with email + magic link (passwordless). Their Supabase Auth account is linked to a `members` row via `members.user_id`. The link is established when the member accepts their invite.

**`app_metadata` shape (set when invite is accepted):**
```json
{
  "role": "member",
  "member_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "property_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

---

## Migration

### Step 1 — JWT claim helper functions

Define once. Used by every RLS policy in every phase. Marking as `SECURITY DEFINER` ensures they run with the function owner's privileges, not the caller's.

```sql
-- Current user's role from app_metadata
CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- Current user's property_id from app_metadata (staff and partner roles)
CREATE OR REPLACE FUNCTION auth_property_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid;
$$;

-- Current user's partner_org_id from app_metadata (partner role)
CREATE OR REPLACE FUNCTION auth_partner_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'partner_org_id')::uuid;
$$;

-- Current user's member_id from app_metadata (member role)
CREATE OR REPLACE FUNCTION auth_member_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'member_id')::uuid;
$$;

-- Convenience: is the current user a cross-property admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth_role() IN ('super_admin', 'admin');
$$;

-- Convenience: is the current user any internal staff?
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth_role() IN (
    'super_admin', 'admin', 'property_manager',
    'concierge', 'membership_coordinator'
  );
$$;
```

These helper functions make RLS policies readable. Compare:

```sql
-- Without helpers (hard to audit)
(auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')

-- With helpers (clear)
is_admin()
```

### Step 2 — `partner_organizations`

```sql
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

-- Only admins can create or modify partner orgs
CREATE POLICY "partner_orgs: admin write"
  ON partner_organizations FOR ALL
  USING (is_admin());
```

### Step 3 — `members`

```sql
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

  -- Supabase Auth link (null until the member accepts their invite)
  user_id     uuid    UNIQUE REFERENCES auth.users(id),

  -- Identity (seeded from Excel roster)
  member_number text  NOT NULL,
  first_name    text  NOT NULL,
  last_name     text  NOT NULL,
  email         text  NOT NULL,
  phone         text,

  -- Membership
  membership_tier   text,                -- pending Q9
  status            membership_status_enum NOT NULL DEFAULT 'pending',

  -- Invitation state
  invited_at        timestamptz,   -- when the invite email was sent
  invite_accepted_at timestamptz,  -- when the member clicked the magic link
  invite_expires_at  timestamptz,  -- when the invite expires (typically 7 days)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, email),
  UNIQUE (property_id, member_number)
);

CREATE INDEX idx_members_property ON members (property_id, status);
-- idx_members_email indexes only email (no property_id) for the invite callback lookup pattern
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

-- Member reads their own record only
CREATE POLICY "members: member read own"
  ON members FOR SELECT
  USING (
    auth_role() = 'member'
    AND user_id = auth.uid()
  );

-- Member can update limited fields on their own record (phone, etc.)
-- Full profile updates go through a Server Action that validates allowed fields
CREATE POLICY "members: member update own"
  ON members FOR UPDATE
  USING (
    auth_role() = 'member'
    AND user_id = auth.uid()
  );

-- Membership coordinator can update member status and tier
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

-- Insert (Excel seeding, new applications) — service role only
-- No INSERT policy needed here: service role bypasses RLS
```

### Step 4 — Trigger: stamp `app_metadata` when invite is accepted

When a member clicks their magic link and the Supabase Auth `SIGNED_IN` event fires for the first time on a new account, the application must:

1. Look up the `members` row by email
2. Set `members.user_id = auth.uid()` and `members.invite_accepted_at = now()`
3. Update `app_metadata` with `role`, `member_id`, and `property_id`

This is application logic, not a DB trigger — it runs in the Next.js Auth callback route (`/auth/callback`). The DB trigger below handles the `app_metadata` sync if you prefer to keep it in the database:

```sql
-- Optional: if you want to sync app_metadata from the database side
-- This requires the pg_net extension or a Supabase Edge Function hook
-- Recommended approach: handle in the /auth/callback Server Action instead
```

**Recommended `/auth/callback` flow:**

```typescript
// app/auth/callback/route.ts
const { data: { user } } = await supabase.auth.getUser()

if (user && !user.app_metadata?.role) {
  // New session — look up the member row by email
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, property_id')
    .eq('email', user.email)
    .single()

  if (member) {
    // Link the auth user to the member row
    await supabaseAdmin
      .from('members')
      .update({
        user_id: user.id,
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('id', member.id)

    // Stamp app_metadata so RLS policies work immediately
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        role: 'member',
        member_id: member.id,
        property_id: member.property_id,
      }
    })
  }
}
```

---

## Member Seeding Flow (Excel Roster)

The Excel roster is loaded once at launch. For each row:

1. Create a `members` row with status `pending`, `user_id = null`, `invited_at = null`
2. An Inngest function (`seed-member-invites`) picks up each un-invited member and:
   a. Calls `supabaseAdmin.auth.admin.inviteUserByEmail(email)` — Supabase sends the magic link
   b. Sets `members.invited_at = now()` and `members.invite_expires_at = now() + 7 days`
3. When the member clicks the link, the `/auth/callback` flow above runs and completes the link

Inngest should rate-limit invite sends (e.g., 10/second) to avoid hitting Supabase Auth rate limits. Batch the seed over several minutes.

**Resend invite flow** — If `invite_expires_at < now()` and `user_id IS NULL`:
1. Inngest or admin UI action calls `inviteUserByEmail` again
2. Updates `invited_at` and `invite_expires_at`

---

## Middleware Route Guards

Supabase Auth sessions are validated in `middleware.ts`. The JWT `app_metadata.role` claim determines which portal the user can access:

```typescript
// middleware.ts sketch
const role = user?.app_metadata?.role

const portalMap = {
  '/admin':   ['super_admin', 'admin', 'property_manager', 'concierge', 'membership_coordinator'],
  '/member':  ['member'],
  '/partner': ['partner'],
}

// If the user's role is not in the allowed list for the requested path, redirect to /unauthorized
```

This is the application-level gate. RLS is the database-level gate. Both must hold — defense in depth.

---

## Notes

**`app_metadata` is not writable by the client.** Only the service role Admin API can set `app_metadata`. The Supabase client SDK (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) cannot modify it. This is the correct security boundary — role escalation from the client is impossible.

**`members.user_id` is nullable until invite is accepted.** A member row exists in the database (seeded from Excel) before the member has ever logged in. `user_id` is null. Once they accept the invite, `user_id` is set and `app_metadata` is stamped. RLS policies that check `user_id = auth.uid()` will not match until this link is established.

**Partner concierge accounts are created manually.** Unlike members (bulk-seeded from Excel), partner concierge accounts are created one at a time by an admin when a partnership is established. The flow:
1. Admin creates the `partner_organizations` row
2. Admin calls `supabaseAdmin.auth.admin.inviteUserByEmail(email)` with the concierge's email
3. Admin sets `app_metadata` with `role: 'partner'`, `partner_org_id`, and `property_id`
4. Concierge accepts the invite and can immediately log into the partner portal

**Deprovisioning.** To deprovision a partner concierge: `supabaseAdmin.auth.admin.deleteUser(userId)` or disable the account. To deprovision a staff member: same. To deactivate a member: set `members.status = 'inactive'` — their auth account still exists but portal access is controlled by the status check in the member portal middleware.

**`membership_status_enum` will grow.** Q9 (membership tiers) and Q16 (annual dues) may introduce new statuses like `lapsed` or a grace period state. The enum is designed to accommodate this — add new values with `ALTER TYPE membership_status_enum ADD VALUE 'new_value'` without rebuilding the table.

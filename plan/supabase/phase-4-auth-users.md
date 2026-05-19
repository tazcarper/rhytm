# Phase 4 — Auth and Users

> ⚠️ **Schema refactored 2026-05-18.** The original `members` table described in this plan was split into `people` + `memberships` + `membership_people` (junction). See migration `20260518232029_split_members_into_people_memberships.sql` for the canonical schema. The rewrite supports household sharing (multiple people on one membership) in addition to the cross-property model. Sections below referring to "the `members` table" are historical; the role/auth/invite-flow conceptual model is unchanged.
>
> Concretely: the old `members` row carried both person identity (email, name, phone, auth link) and membership state (member_number, tier, dues, status). Those are split:
> - **`people`** — the human (email UNIQUE, name, phone, `user_id` to `auth.users` UNIQUE — one auth user = one person).
> - **`memberships`** — the account at a property (member_number UNIQUE within property, tier, dues, status).
> - **`membership_people`** — the junction (role: `primary` / `spouse` / `dependent` / `authorized`, status). Partial unique index enforces one active primary per membership.
>
> The `/auth/callback` flow now finds ONE pending `people` row by email and links it; cross-property visibility comes from N junction rows on that single person.

## Prerequisites

- Phase 1 complete (`properties` seeded)
- Supabase project created with Auth enabled
- No application tables from this phase depend on Phase 2 or 3, but Phase 2 FKs reference `auth.users(id)` which is managed by Supabase Auth

## What This Phase Builds

`partner_organizations`, `people`, `memberships`, `membership_people` (after the 2026-05-18 split — originally `members`).

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

Members log in with email + magic link (passwordless). Their Supabase Auth account is linked to **every `members` row that matches their email**, via `members.user_id`. The link is established when the member accepts their invite.

**`app_metadata` shape (set when invite is accepted):**
```json
{
  "role": "member"
}
```

Memberships are property-specific: a person can be a member at Horseshoe Bay and not at Hog Heaven, or at all three. Each property's membership lives in its own `members` row with its own `member_number`, `membership_tier`, dues status, etc. One Supabase Auth account (one email) can therefore be linked to multiple `members` rows — they all share the same `user_id`.

This is why `app_metadata` carries only `role` for members, and not `member_id` or `property_id`: there is no single answer to "what is this member's property?" RLS policies on member-owned data use `user_id = auth.uid()` (joining `members` where needed) instead of reading a single claim. If the member portal UI needs a "currently-viewing property" concept, that lives in a Server-Action-managed cookie, not in `app_metadata`.

---

## Migration

### Step 1 — JWT claim helper functions

Define once. Used by every RLS policy in every phase. These are `SECURITY INVOKER` (default) — reading `auth.jwt()` does not require elevated privileges, and `SECURITY DEFINER` here would be a quiet footgun if anyone later extended a helper to touch tables. The inner `(SELECT auth.jwt())` forces an InitPlan, so each helper is evaluated once per query rather than once per row (same pattern as the RLS policies in Phases 1–3).

```sql
-- Current user's role from app_metadata
CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT (SELECT auth.jwt()) -> 'app_metadata' ->> 'role';
$$;

-- Current user's property_id from app_metadata (staff and partner roles)
-- Members do NOT carry property_id in app_metadata — see cross-property note below.
CREATE OR REPLACE FUNCTION auth_property_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'property_id')::uuid;
$$;

-- Current user's partner_org_id from app_metadata (partner role)
CREATE OR REPLACE FUNCTION auth_partner_org_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'partner_org_id')::uuid;
$$;

-- Convenience: is the current user a cross-property admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT auth_role() IN ('super_admin', 'admin');
$$;

-- Convenience: is the current user any internal staff?
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT auth_role() IN (
    'super_admin', 'admin', 'property_manager',
    'concierge', 'membership_coordinator'
  );
$$;
```

There is intentionally **no `auth_member_id()` helper.** Members can hold memberships at multiple properties (one `members` row per property — see "Cross-property membership" below), so a single `member_id` claim in `app_metadata` cannot represent the full picture. Queries that need "the current user's memberships" join `members` on `members.user_id = auth.uid()` and let Postgres return all matching rows.

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

-- Only admins can create, update, or delete partner orgs.
-- (`FOR ALL` would govern SELECT too, which is already covered by the three
--  explicit SELECT policies above — keeping writes on a separate policy
--  makes the intent obvious during the Phase 7 audit.)
CREATE POLICY "partner_orgs: admin insert"
  ON partner_organizations FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "partner_orgs: admin update"
  ON partner_organizations FOR UPDATE USING (is_admin());

CREATE POLICY "partner_orgs: admin delete"
  ON partner_organizations FOR DELETE USING (is_admin());
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

  -- Supabase Auth link (null until the member accepts their invite).
  -- NOT UNIQUE — one auth user maps to N members rows under the
  -- cross-property model (see "Cross-property membership" below).
  -- Performance comes from the partial index further down, not from a
  -- unique constraint.
  user_id     uuid    REFERENCES auth.users(id),

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

-- Members do NOT have a direct UPDATE policy. RLS is row-level, not
-- column-level, so an UPDATE policy on `members` for the member role
-- would allow them to change any column on their own row (status,
-- membership_tier, member_number, property_id, etc.) using just the
-- anon-key Supabase client from the browser. Instead, member profile
-- edits (phone, etc.) go through a Server Action that uses the service
-- role and validates the column allowlist before writing.

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

### Step 4 — `/auth/callback` link flow

When a member clicks their magic link and the Supabase Auth `SIGNED_IN` event fires for the first time on a new account, the Next.js Auth callback route must:

1. Look up **every** `members` row whose `email` matches the new user, whose `user_id` is still null, and whose `invite_expires_at` is still in the future.
2. Link them all by setting `user_id = auth.uid()` and `invite_accepted_at = now()`.
3. Stamp `app_metadata` with just `{ role: 'member' }`.

There is **no `member_id` or `property_id` claim** for members — see the cross-property note in the User Types section. Per-property context (if the UI wants one) lives in a session cookie, not the JWT.

This is application logic, not a DB trigger.

```typescript
// app/auth/callback/route.ts
const { data: { user } } = await supabase.auth.getUser()

if (user && !user.app_metadata?.role) {
  // Find every unaccepted, unexpired members row for this email.
  // One user/email may map to N members rows (cross-property membership).
  const { data: pending } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('email', user.email)
    .is('user_id', null)
    .gt('invite_expires_at', new Date().toISOString())

  if (!pending || pending.length === 0) {
    // Either no invite was ever issued for this email, or every invite
    // has expired. Sign the user out and surface a clear "this invite
    // is no longer valid — request a new one" page.
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/invite-not-found', request.url))
  }

  // Link the auth user to every pending members row for this email.
  await supabaseAdmin
    .from('members')
    .update({
      user_id: user.id,
      invite_accepted_at: new Date().toISOString(),
    })
    .in('id', pending.map(m => m.id))

  // Stamp the JWT role. No per-property fields — see cross-property note.
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: 'member' }
  })
}
```

**Expired invite path.** The query above filters on `invite_expires_at > now()`. A user clicking an expired link hits the "no pending invite" branch, gets signed out, and lands on `/invite-not-found`. From that page, a Server Action can call `inviteUserByEmail(email)` again to re-issue. This keeps expired magic links from quietly succeeding.

**Partial-acceptance case.** If a member is invited to HSB on Monday and Packsaddle on Friday, and accepts the HSB invite on Tuesday, the HSB row gets linked (`user_id = X`, `invite_accepted_at = Tue`). On Friday, the Packsaddle invite is sent — the Auth account already exists, so it's a normal magic-link sign-in; the callback finds the Packsaddle row (`user_id IS NULL`, not yet expired) and links it. Both rows end up with the same `user_id`, and the member's two memberships are visible to the portal via `members WHERE user_id = auth.uid()`.

---

## Member Seeding Flow (Excel Roster)

The Excel roster is loaded once at launch. Memberships are property-specific, so the roster may include the same email at more than one property — each appears as its own `members` row. For each row:

1. Create a `members` row with status `pending`, `user_id = null`, `invited_at = null`.

Then an Inngest function (`seed-member-invites`) processes the seed:

2. **Group pending rows by email.** Email is the unique identity for Supabase Auth, so the same email at multiple properties is **one auth account but multiple member rows**.
3. For each unique email with at least one un-invited row:
   a. Call `supabaseAdmin.auth.admin.inviteUserByEmail(email)` exactly once — Supabase creates the auth user (if new) and sends one magic link covering all their pending memberships.
   b. `UPDATE members SET invited_at = now(), invite_expires_at = now() + interval '7 days' WHERE email = $email AND user_id IS NULL`.
4. When the member clicks the link, the `/auth/callback` flow links **every** matching pending row for that email (see Step 4 above).

Inngest should rate-limit invite sends (e.g., 10/second per unique email) to avoid hitting Supabase Auth rate limits. Batch the seed over several minutes.

**Resend invite flow** — If a member has any rows where `invite_expires_at < now() AND user_id IS NULL`:
1. Inngest or admin UI calls `inviteUserByEmail(email)` again.
2. `UPDATE members SET invited_at = now(), invite_expires_at = now() + interval '7 days' WHERE email = $email AND user_id IS NULL`.

A subsequent successful sign-in links all those rows at once.

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

**`app_metadata` is not writable by the client.** Only the service role Admin API can set `app_metadata`. The Supabase client SDK (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) cannot modify it. This is the correct security boundary — role escalation from the client is impossible.

**`members.user_id` is nullable until invite is accepted.** A member row exists in the database (seeded from Excel) before the member has ever logged in. `user_id` is null. Once they accept the invite, `user_id` is set and `app_metadata` is stamped. RLS policies that check `user_id = auth.uid()` will not match until this link is established.

**Cross-property membership.** A person can hold memberships at multiple properties — each property is an independent membership with its own `members` row, `member_number`, `membership_tier`, and dues status. One email maps to one Supabase Auth account; that account links to **N** `members` rows (one per property where the person is a member). `app_metadata` for members therefore carries only `role`, never a single `member_id` or `property_id`. To find "this member's properties," query `SELECT property_id FROM members WHERE user_id = auth.uid() AND status = 'active'`. The member portal UI is responsible for showing all of a member's memberships and (if the product needs it) letting them switch active context via a Server-Action-managed cookie.

**Deactivation is per-membership.** Because memberships are property-specific, setting `members.status = 'inactive'` on one row does not affect that person's status at other properties. There is intentionally no "deactivate this user across everything" path — that would be conflating identity (the Auth account) with membership (per-property rows). To fully remove someone's portal access, deactivate every row *and* delete the Auth account.

**Partner concierge accounts are created manually.** Unlike members (bulk-seeded from Excel), partner concierge accounts are created one at a time by an admin when a partnership is established. The flow:
1. Admin creates the `partner_organizations` row
2. Admin calls `supabaseAdmin.auth.admin.inviteUserByEmail(email)` with the concierge's email
3. Admin sets `app_metadata` with `role: 'partner'`, `partner_org_id`, and `property_id`
4. Concierge accepts the invite and can immediately log into the partner portal

**Deprovisioning.** To deprovision a partner concierge: `supabaseAdmin.auth.admin.deleteUser(userId)` or disable the account. To deprovision a staff member: same. To deactivate a member: set `members.status = 'inactive'` — their auth account still exists but portal access is controlled by the status check in the member portal middleware.

**`membership_status_enum` will grow.** Q9 (membership tiers) and Q16 (annual dues) may introduce new statuses like `lapsed` or a grace period state. The enum is designed to accommodate this — add new values with `ALTER TYPE membership_status_enum ADD VALUE 'new_value'` without rebuilding the table.

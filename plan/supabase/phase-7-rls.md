# Phase 7 — RLS Policy Architecture

## Overview

RLS policies and helper functions are *created* in their native phase (Phases 1–6) alongside their tables. **This phase has no migration of its own.** It is a regenerated reference document — the authoritative cross-cutting view of every RLS policy in the system, the helper functions they use, the role capability matrix, and the testing protocol.

> **Maintenance rule:** when an RLS policy or helper function changes in any of Phases 1–6, this document must be updated in the same change. Drift between this doc and the per-phase plans is the expected failure mode; the role-matrix and testing recipes here are only useful if they match the live schema.

---

## Helper Functions (defined in Phase 4)

All RLS policies use these functions instead of raw `auth.jwt()` calls. This keeps policies auditable, ensures the JWT parsing logic lives in one place, and — because each helper internally wraps `auth.jwt()` in a `(SELECT auth.jwt())` subquery — gives Postgres a per-query InitPlan so the JWT is parsed once per query instead of once per row.

All helpers are `LANGUAGE sql STABLE` with default `SECURITY INVOKER`. Reading the caller's own JWT does not require elevated privileges; `SECURITY DEFINER` here would be a footgun if a helper ever got extended to read tables.

```sql
-- Current user's role
auth_role()             → text    -- 'super_admin' | 'admin' | 'property_manager' | ...

-- Current user's property_id (staff and partner roles only; NULL for members)
auth_property_id()      → uuid

-- Current user's partner_org_id (partner role only)
auth_partner_org_id()   → uuid

-- Convenience checks
is_admin()              → boolean  -- true for super_admin and admin
is_staff()              → boolean  -- true for any internal role
```

There is intentionally **no `auth_member_id()` helper.** Members can hold memberships at multiple properties (one `members` row per property), so a single `member_id` claim cannot represent the full picture. Member-facing policies join `members` on `user_id = auth.uid()` instead — see the policies on `members`, `member_adventures`, and `member_adventure_rsvps` below.

---

## Role Capability Matrix

"R" / "W" reflect **what RLS allows**. Writes via service-role Server Actions are not represented here — every role can have additional write paths through Server Actions, which bypass RLS entirely.

| Role | properties | time_slots | services | add_ons | instructors | pricing_rules | bookings | bids | members | adventures | rsvps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `super_admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W |
| `admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W |
| `property_manager` | R | R | R | R | R/W† | R | R/W† | R/W† | R† | R/W† | R/W† |
| `concierge` | R | R | R | R | R | — | R‡§ | R‡§ | — | — | — |
| `membership_coordinator` | R | — | — | — | — | — | — | — | R/W† | — | — |
| `partner` | R | R | R | R | R | — | R‡§ | R‡§ | — | — | — |
| `member` | R | R | R | R | R | — | R‡ | R‡ | R§ | R★ | R§ |
| Anon | R | R (active) | R (active) | R (active) | R (active) | — | — | — | — | — | — |

† Scoped to their `property_id` claim.
‡ Scoped to records they own or created (via `concierge_user_id = auth.uid()` etc.).
§ Writes for this role go through service-role Server Actions, not RLS. RLS deliberately exposes no `FOR INSERT/UPDATE` policy because RLS is row-level (not column-level) and would otherwise let the client change any column.
★ Members see adventures (and their own RSVPs) at **any** property where they hold an active `members` row — cross-property membership is supported (Phase 4 decision). RLS does the join through `members.user_id = auth.uid()`.

---

## Complete Policy Reference

### `properties`

```sql
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties: public read"
  ON properties FOR SELECT USING (true);

CREATE POLICY "properties: admin write"
  ON properties FOR ALL USING (is_admin());
```

### `time_slots`

```sql
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_slots: public read active"
  ON time_slots FOR SELECT USING (is_active = true);

CREATE POLICY "time_slots: admin read all"
  ON time_slots FOR SELECT USING (is_admin());

CREATE POLICY "time_slots: admin write"
  ON time_slots FOR ALL USING (is_admin());
```

### `services`

```sql
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services: public read active"
  ON services FOR SELECT USING (is_active = true);

CREATE POLICY "services: admin read all"
  ON services FOR SELECT USING (is_admin());

CREATE POLICY "services: admin write"
  ON services FOR ALL USING (is_admin());
```

### `add_ons`

```sql
ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "add_ons: public read active"
  ON add_ons FOR SELECT USING (is_active = true);

CREATE POLICY "add_ons: admin read all"
  ON add_ons FOR SELECT USING (is_admin());

CREATE POLICY "add_ons: admin write"
  ON add_ons FOR ALL USING (is_admin());
```

### `service_add_ons`

```sql
ALTER TABLE service_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_add_ons: public read"
  ON service_add_ons FOR SELECT USING (true);

CREATE POLICY "service_add_ons: admin write"
  ON service_add_ons FOR ALL USING (is_admin());
```

### `instructors`

```sql
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructors: public read active"
  ON instructors FOR SELECT USING (is_active = true);

CREATE POLICY "instructors: admin read all"
  ON instructors FOR SELECT USING (is_admin());

CREATE POLICY "instructors: admin and pm write"
  ON instructors FOR ALL
  USING (
    is_admin()
    OR (auth_role() = 'property_manager' AND property_id = auth_property_id())
  );
```

### `pricing_rules`

```sql
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_rules: staff read"
  ON pricing_rules FOR SELECT USING (is_staff());

CREATE POLICY "pricing_rules: admin write"
  ON pricing_rules FOR ALL USING (is_admin());
```

### `bookings`

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings: admin read"
  ON bookings FOR SELECT USING (is_admin());

CREATE POLICY "bookings: property_manager read"
  ON bookings FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "bookings: concierge read own"
  ON bookings FOR SELECT
  USING (auth_role() = 'concierge' AND concierge_user_id = auth.uid());

CREATE POLICY "bookings: partner read own"
  ON bookings FOR SELECT
  USING (auth_role() = 'partner' AND concierge_user_id = auth.uid());

CREATE POLICY "bookings: member read own"
  ON bookings FOR SELECT
  USING (auth_role() = 'member' AND member_user_id = auth.uid());

CREATE POLICY "bookings: staff update"
  ON bookings FOR UPDATE
  USING (
    is_admin()
    OR (auth_role() = 'property_manager' AND property_id = auth_property_id())
  );
```

### `booking_disciplines`

```sql
ALTER TABLE booking_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_disciplines: admin read"
  ON booking_disciplines FOR SELECT
  USING (is_admin());

CREATE POLICY "booking_disciplines: property_manager read"
  ON booking_disciplines FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.property_id = auth_property_id()
    )
  );

CREATE POLICY "booking_disciplines: member read own"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.member_user_id = auth.uid())
  );

CREATE POLICY "booking_disciplines: partner read own"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.concierge_user_id = auth.uid())
  );
```

### `booking_add_ons`

```sql
ALTER TABLE booking_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_add_ons: admin read"
  ON booking_add_ons FOR SELECT USING (is_admin());

CREATE POLICY "booking_add_ons: property_manager read"
  ON booking_add_ons FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.property_id = auth_property_id()
    )
  );

CREATE POLICY "booking_add_ons: member read own"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.member_user_id = auth.uid())
  );

CREATE POLICY "booking_add_ons: partner read own"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.concierge_user_id = auth.uid())
  );
```

### `bids`

```sql
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bids: admin read"
  ON bids FOR SELECT USING (is_admin());

CREATE POLICY "bids: property_manager read"
  ON bids FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.property_id = auth_property_id()
    )
  );

CREATE POLICY "bids: concierge read own"
  ON bids FOR SELECT
  USING (
    auth_role() = 'concierge'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.concierge_user_id = auth.uid())
  );

CREATE POLICY "bids: partner read own"
  ON bids FOR SELECT
  USING (
    auth_role() = 'partner'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.concierge_user_id = auth.uid())
  );

CREATE POLICY "bids: member read own"
  ON bids FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.member_user_id = auth.uid())
  );

CREATE POLICY "bids: staff update"
  ON bids FOR UPDATE
  USING (
    is_admin()
    OR (
      auth_role() = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = booking_id AND b.property_id = auth_property_id()
      )
    )
  );
```

### `partner_organizations`

```sql
ALTER TABLE partner_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_orgs: admin read"
  ON partner_organizations FOR SELECT USING (is_admin());

CREATE POLICY "partner_orgs: property_manager read"
  ON partner_organizations FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "partner_orgs: partner read own"
  ON partner_organizations FOR SELECT
  USING (auth_role() = 'partner' AND id = auth_partner_org_id());

-- Split into explicit insert/update/delete so the policy intent is obvious
-- on audit. (FOR ALL would govern SELECT too, redundantly with the three
-- explicit SELECT policies above.)
CREATE POLICY "partner_orgs: admin insert"
  ON partner_organizations FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "partner_orgs: admin update"
  ON partner_organizations FOR UPDATE USING (is_admin());

CREATE POLICY "partner_orgs: admin delete"
  ON partner_organizations FOR DELETE USING (is_admin());
```

### `members`

```sql
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members: admin read"
  ON members FOR SELECT USING (is_admin());

CREATE POLICY "members: property_manager read"
  ON members FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "members: membership_coordinator read"
  ON members FOR SELECT
  USING (auth_role() = 'membership_coordinator' AND property_id = auth_property_id());

CREATE POLICY "members: member read own"
  ON members FOR SELECT
  USING (auth_role() = 'member' AND user_id = auth.uid());

-- No FOR UPDATE policy for members. RLS is row-level, not column-level —
-- a member-role update policy would let the client change `status`,
-- `membership_tier`, `member_number`, `property_id`, etc. Member self-edits
-- route through a Server Action that uses the service role and enforces
-- the column allowlist (typically: phone, communication preferences).

CREATE POLICY "members: membership_coordinator update"
  ON members FOR UPDATE
  USING (auth_role() = 'membership_coordinator' AND property_id = auth_property_id());

CREATE POLICY "members: admin write"
  ON members FOR ALL USING (is_admin());
```

### `member_adventures`

```sql
ALTER TABLE member_adventures ENABLE ROW LEVEL SECURITY;

-- Members see published/sold_out adventures at any property where they
-- hold an active membership. Joins through `members` because members can
-- hold memberships at multiple properties (Phase 4 cross-property model),
-- so the JWT carries no single property_id claim for them.
CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (
      SELECT property_id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

CREATE POLICY "adventures: admin read all"
  ON member_adventures FOR SELECT USING (is_admin());

CREATE POLICY "adventures: property_manager read"
  ON member_adventures FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "adventures: admin write"
  ON member_adventures FOR ALL USING (is_admin());

CREATE POLICY "adventures: property_manager write"
  ON member_adventures FOR ALL
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());
```

### `member_adventure_rsvps`

```sql
ALTER TABLE member_adventure_rsvps ENABLE ROW LEVEL SECURITY;

-- Member reads RSVPs tied to any of their memberships.
CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Member can insert an RSVP only against one of their *active* memberships.
-- The capacity trigger enforces the slot limit server-side.
CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- No FOR UPDATE policy for members. Same reasoning as `members`: RLS is
-- row-level, not column-level. Member cancellations route through a
-- Server Action that uses the service role, enforces "status can only
-- change to 'cancelled'", applies refund policy, and triggers waitlist
-- promotion.

CREATE POLICY "rsvps: admin read all"
  ON member_adventure_rsvps FOR SELECT USING (is_admin());

CREATE POLICY "rsvps: property_manager read"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM member_adventures a
      WHERE a.id = adventure_id AND a.property_id = auth_property_id()
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
        WHERE a.id = adventure_id AND a.property_id = auth_property_id()
      )
    )
  );
```

### `processed_webhooks`

```sql
-- RLS enabled with NO policies. Supabase's default GRANTs to anon and
-- authenticated would otherwise let the anon key list every webhook ID
-- we've processed. Enabled-with-no-policies denies all access except
-- the service role.
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
-- (No CREATE POLICY statements.)
```

This table is accessed exclusively by service-role Route Handlers (Stripe webhook, Dropbox Sign webhook). RLS-enabled-with-no-policies is the Supabase-idiomatic way to say "service role only" while still defending against future regressions from someone enabling/disabling RLS without policies elsewhere.

---

## Testing Protocol

Run these queries in the Supabase SQL editor against a test user's JWT to verify each policy in isolation.

### Setup: test as a specific role

```sql
-- Test as a member. The member's app_metadata carries only `role` — there
-- is no member_id / property_id claim (cross-property model). The RLS
-- subqueries join `members` on user_id = auth.uid(), so the test setup
-- must include matching rows in `members` for the chosen 'sub'.
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{
  "sub": "member-user-uuid",
  "role": "authenticated",
  "app_metadata": {
    "role": "member"
  }
}';

-- Now run queries — RLS applies based on the claims above
SELECT * FROM bookings;  -- should only return rows where member_user_id = 'member-user-uuid'
SELECT * FROM pricing_rules;  -- should return 0 rows
SELECT * FROM members;        -- should return only the member's own row(s) (one per property)
```

```sql
-- Test cross-property member access. Seed two members rows for the same
-- user_id, one per property, both active. The member should see adventures
-- and RSVPs at *both* properties.
INSERT INTO members (id, user_id, property_id, email, member_number, first_name, last_name, status)
VALUES
  ('m1-uuid', 'member-user-uuid', 'hsb-property-uuid',        'a@b.com', 'HSB-001', 'Jane', 'Doe', 'active'),
  ('m2-uuid', 'member-user-uuid', 'packsaddle-property-uuid', 'a@b.com', 'PS-001',  'Jane', 'Doe', 'active');

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"member-user-uuid","role":"authenticated","app_metadata":{"role":"member"}}';

SELECT property_id FROM member_adventures WHERE status = 'published';
-- expect rows for both hsb-property-uuid and packsaddle-property-uuid

SELECT member_id FROM member_adventure_rsvps;
-- expect rows where member_id IN ('m1-uuid', 'm2-uuid') only
```

```sql
-- Test as property_manager
SET LOCAL request.jwt.claims TO '{
  "sub": "pm-user-uuid",
  "role": "authenticated",
  "app_metadata": {
    "role": "property_manager",
    "property_id": "horseshoe-bay-uuid"
  }
}';

SELECT * FROM bookings;  -- should only return bookings for horseshoe-bay
SELECT * FROM members;   -- should only return members of horseshoe-bay
```

```sql
-- Test as anon (no auth)
SET LOCAL role TO anon;

SELECT * FROM pricing_rules;  -- should return 0 rows
SELECT * FROM services WHERE is_active = true;  -- should return rows
SELECT * FROM bookings;  -- should return 0 rows
```

### Verify service role bypasses all policies

```sql
SET LOCAL role TO service_role;
SELECT * FROM pricing_rules;  -- should return all rows
SELECT * FROM bookings;       -- should return all rows
```

---

## Common Pitfalls

**Multiple SELECT policies are OR'd together.** If a table has two SELECT policies and a user matches either, they see the union. This is intentional — admins match their broad policy, members match their narrow one. Do not write policies that expect to restrict each other.

**`WITH CHECK` vs `USING` for INSERT.** `USING` filters rows the user can see. `WITH CHECK` filters rows the user can insert. For INSERT policies, only `WITH CHECK` applies. If you write `FOR INSERT USING (...)` instead of `FOR INSERT WITH CHECK (...)`, Postgres accepts it but the behavior may not be what you expect.

**RLS does not apply to service role.** The Supabase service role (`SUPABASE_SECRET_KEY`) bypasses all RLS policies. Server Actions and Route Handlers that use the service role client have access to all rows. This is intentional — the service role is used for operations that cross user boundaries (checkout, webhook handling, member seeding). Guard it at the application layer, not the RLS layer.

**`auth.uid()` returns null for unauthenticated requests.** A policy like `member_user_id = auth.uid()` evaluated for an anon user returns `false` (not an error), because `null = null` is `null`, which is falsy in a USING clause. This is the correct behavior — anon users see nothing in tables with only authenticated-user policies.

**EXISTS subqueries in policies are evaluated per row.** Policies on `booking_disciplines`, `booking_add_ons`, and `bids` use `EXISTS (SELECT 1 FROM bookings WHERE id = booking_id ...)`. This is a correlated subquery — it runs for every row returned. In practice the inner lookup is by PK (`bookings.id`), which is index-backed and returns at most one row; the additional predicate (`b.property_id = auth_property_id()` or `b.member_user_id = auth.uid()`) is then applied to that single row. So the per-row cost is one PK lookup, not a scan. On very large result sets from the admin portal you may still prefer the service role client on the server side, but for the volume here the EXISTS-by-PK pattern is fine.

**RLS is row-level, not column-level.** An `UPDATE` policy that matches grants permission to update *any* column on the matched rows. This is the most consequential RLS gotcha in this project — it bit us twice during plan review (the original `members: member update own` and `rsvps: member cancel own` policies would have let the browser-side client change `status`, `membership_tier`, `member_number`, `guest_count`, etc.). If you need column-level restrictions, route the write through a Server Action that uses the service role and enforces an explicit allowlist server-side. Do not rely on RLS to police column writes.

**Use the helper functions, not raw `auth.jwt()` / `auth.uid()`.** Every helper (`auth_role()`, `auth_property_id()`, `is_admin()`, `is_staff()`) internally wraps `auth.jwt()` in a `(SELECT auth.jwt())` subquery, which Postgres treats as an InitPlan and evaluates once per query. A raw `auth.jwt() -> 'app_metadata' ->> 'role'` inline in a policy gets re-evaluated for every row. The helpers are also more audit-friendly — `is_admin()` is unambiguous in a way that `(auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')` isn't. If you find yourself writing the long form, you're skipping a helper that already exists.

# Phase 7 — RLS Policy Architecture

## Overview

RLS policies are written alongside each table in Phases 1–6. This document is the authoritative reference for the complete policy set, the helper functions that make them readable, and the testing protocol.

---

## Helper Functions (defined in Phase 4)

All RLS policies use these functions instead of raw `auth.jwt()` calls. This keeps policies auditable and ensures the JWT parsing logic is in one place.

```sql
-- Current user's role
auth_role()             → text    -- 'super_admin' | 'admin' | 'property_manager' | ...

-- Current user's property_id (staff and partner roles)
auth_property_id()      → uuid

-- Current user's partner_org_id (partner role)
auth_partner_org_id()   → uuid

-- Current user's member_id (member role)
auth_member_id()        → uuid

-- Convenience checks
is_admin()              → boolean  -- true for super_admin and admin
is_staff()              → boolean  -- true for any internal role
```

---

## Role Capability Matrix

| Role | properties | time_slots | services | add_ons | instructors | pricing_rules | bookings | bids | members | adventures | rsvps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `super_admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W |
| `admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W |
| `property_manager` | R | R | R | R | R/W† | R | R/W† | R/W† | R/W† | R/W† | R/W† |
| `concierge` | R | R | R | R | R | — | R/W‡ | R/W‡ | — | — | — |
| `membership_coordinator` | R | — | — | — | — | — | — | — | R/W† | — | — |
| `partner` | R | R | R | R | R | — | R/W‡ | R/W‡ | — | — | — |
| `member` | R | R | R | R | R | — | R‡ | R‡ | R/W‡ | R | R/W‡ |
| Anon | R | R (active) | R (active) | R (active) | R (active) | — | — | — | — | — | — |

† Scoped to their `property_id`
‡ Scoped to records they own or created

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
    OR auth_role() = 'property_manager'
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

CREATE POLICY "partner_orgs: admin write"
  ON partner_organizations FOR ALL USING (is_admin());
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

CREATE POLICY "members: member update own"
  ON members FOR UPDATE
  USING (auth_role() = 'member' AND user_id = auth.uid());

CREATE POLICY "members: membership_coordinator update"
  ON members FOR UPDATE
  USING (auth_role() = 'membership_coordinator' AND property_id = auth_property_id());

CREATE POLICY "members: admin write"
  ON members FOR ALL USING (is_admin());
```

### `member_adventures`

```sql
ALTER TABLE member_adventures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id = auth_property_id()
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

CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (auth_role() = 'member' AND member_id = auth_member_id());

CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (auth_role() = 'member' AND member_id = auth_member_id());

CREATE POLICY "rsvps: member cancel own"
  ON member_adventure_rsvps FOR UPDATE
  USING (auth_role() = 'member' AND member_id = auth_member_id() AND status != 'cancelled');

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

RLS is intentionally **not enabled** on this table. It is accessed exclusively by service role Route Handlers.

---

## Testing Protocol

Run these queries in the Supabase SQL editor against a test user's JWT to verify each policy in isolation.

### Setup: test as a specific role

```sql
-- Test as a member (replace with a real member's user ID and their property_id)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{
  "sub": "member-user-uuid",
  "role": "authenticated",
  "app_metadata": {
    "role": "member",
    "member_id": "member-row-uuid",
    "property_id": "property-uuid"
  }
}';

-- Now run queries — RLS applies based on the claims above
SELECT * FROM bookings;  -- should only return rows where member_user_id = 'member-user-uuid'
SELECT * FROM pricing_rules;  -- should return 0 rows
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

**RLS does not apply to service role.** The Supabase service role (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS policies. Server Actions and Route Handlers that use the service role client have access to all rows. This is intentional — the service role is used for operations that cross user boundaries (checkout, webhook handling, member seeding). Guard it at the application layer, not the RLS layer.

**`auth.uid()` returns null for unauthenticated requests.** A policy like `member_user_id = auth.uid()` evaluated for an anon user returns `false` (not an error), because `null = null` is `null`, which is falsy in a USING clause. This is the correct behavior — anon users see nothing in tables with only authenticated-user policies.

**EXISTS subqueries in policies are evaluated per row.** Policies on `booking_disciplines` and `booking_add_ons` use `EXISTS (SELECT 1 FROM bookings ...)`. This is a correlated subquery — it runs for every row returned. On large result sets from the admin portal, use the service role client on the server side rather than relying on these policies for admin reads. RLS is the safety net; use the right client for the right job.

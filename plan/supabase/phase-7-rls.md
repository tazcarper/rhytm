# Phase 7 — RLS Architecture Reference

> **Status:** Documentation-only — no migration. This is the canonical, cross-cutting view of every RLS policy, helper function, and access pattern in the system. Last regenerated 2026-05-18 after the Phase 4 `members → people + memberships + membership_people` split and the six SECURITY DEFINER helper functions that broke the cross-table policy cycles.
>
> **Maintenance rule:** when any RLS policy, helper function, or schema-side access mechanism changes in Phases 1–6, this document must be updated in the same commit. Drift between this reference and the live schema is the expected failure mode. The role matrix and testing protocol here are only useful if they match what's actually in the database.

---

## 1. Architecture Summary

Three portals share one Supabase backend. The RLS surface has to enforce all of:

- **Public** (anon) sees only catalog data that staff have explicitly marked active.
- **Members** see their own bookings, their own RSVPs, and adventures at any property where they hold an active membership. A member's auth user maps to one `people` row; one `people` row can be on multiple memberships across multiple properties (cross-property) AND multiple people can share one membership (household sharing).
- **Partner concierges** see their own bookings, their own organization, and the catalog. Scoped by `partner_org_id` and `property_id` claims.
- **Staff** (five internal roles) see varying slices: admins see everything, property-scoped roles see their property only.

The schema reflects this in three places that matter for RLS:

1. **`people` + `memberships` + `membership_people` junction** (Phase 4 refactor). Cross-property and household both fall out of the same junction model — see `project_membership_model` memory entry and `docs/manual-testing.md` for the design intent.
2. **`auth.users.app_metadata.role`** carries the authorization role. Members carry no `property_id` claim — their property scope is derived at query time by joining through the junction.
3. **`bookings` and `bids`** scope to the auth user directly (`member_user_id = auth.uid()`, `concierge_user_id = auth.uid()`). They do NOT go through the people/memberships chain.

---

## 2. JWT Claim Design

All authorization decisions read from `app_metadata` — never from `user_metadata` / `raw_user_meta_data`, which is user-editable and unsafe for RLS.

**Claim shape, per role:**

```json
// Member — no property scope. The cross-property model means one
// member can be at N properties, so a single property_id claim can't
// represent the full picture. Member-facing policies derive properties
// from the people → membership_people → memberships chain.
{ "app_metadata": { "role": "member" } }

// Cross-property staff
{ "app_metadata": { "role": "super_admin" } }
{ "app_metadata": { "role": "admin" } }

// Property-scoped staff
{
  "app_metadata": {
    "role": "property_manager" | "concierge" | "membership_coordinator",
    "property_id": "<uuid>"
  }
}

// Partner concierge
{
  "app_metadata": {
    "role": "partner",
    "partner_org_id": "<uuid>",
    "property_id": "<uuid>"
  }
}
```

**Setting claims:** server-only, via the secret-key admin API, never from the browser. The canonical sequence (see `app/auth/callback/route.ts`):

```typescript
// 1. Link people row to the freshly-created auth.users row
await admin.from("people").update({ user_id, invite_accepted_at }).eq("id", pending.id).is("user_id", null);

// 2. Stamp the role on auth.users.app_metadata
await admin.auth.admin.updateUserById(userId, { app_metadata: { role: "member" } });

// 3. CRITICAL — refresh the user's JWT before redirecting.
// updateUserById writes to the DB but does NOT mutate the JWT in the
// user's cookies. RLS reads the JWT, not auth.users — so without the
// refresh, the next page hit evaluates every policy with role=null
// and the member portal renders "no memberships" even though the rows
// link correctly. This bug was a real incident; the refresh is now
// load-bearing.
await supabase.auth.refreshSession();
```

**Reading claims in RLS:** always through the helpers in §4 — never raw `auth.jwt() -> 'app_metadata' ->> 'role'` in a new policy. (Phases 1–3 migrations predate the helpers and still use the raw form; new policies must use helpers.)

---

## 3. Role Capability Matrix

R = SELECT allowed by RLS. W = INSERT/UPDATE/DELETE allowed by RLS. Cells marked with footnotes are scoped — see notes.

Service-role write paths (Server Actions using the secret key) are **not** in this matrix. Every role can have additional write paths through service-role Server Actions that bypass RLS entirely. See §8 for which writes go through that path.

| Role | properties | time_slots | services | add_ons | service_add_ons | instructors | pricing_rules | bookings | booking_disc / add_ons | bids | partner_orgs | people | memberships | membership_people | adventures | rsvps | processed_webhooks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `super_admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R | R/W | R/W | R/W | R/W | R/W | R/W | R/W | — |
| `admin` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R | R/W | R/W | R/W | R/W | R/W | R/W | R/W | — |
| `property_manager` | R | R | R | R | R | R/W† | R | R/W† | R† | R/W† | R† | R† | R† | R† | R/W† | R/W† | — |
| `concierge` | R | R | R | R | R | R | — | R‡⌘ | R‡ | R‡⌘ | — | — | — | — | — | — | — |
| `membership_coordinator` | R | — | — | — | — | — | — | — | — | — | — | R†△ | R/W†△ | R/W†△ | — | — | — |
| `partner` | R | R | R | R | R | R | — | R‡⌘ | R‡ | R‡⌘ | R★ | — | — | — | — | — | — |
| `member` | R | R | R | R | R | R | — | R§⌘ | R§ | R§⌘ | — | R◇ | R◇ | R◇ | R◇ | R/INS◇⌘ | — |
| Anon | R | R⁂ | R⁂ | R⁂ | R | R⁂ | — | — | — | — | — | — | — | — | — | — | — |

**Legend:**
- † Scoped to the role's `auth_property_id()` claim.
- ‡ Scoped to records the user created (`concierge_user_id = auth.uid()`). Both `partner` and `concierge` roles match the same `concierge_user_id` column — both are external-facing booking origins.
- § Scoped to records the member owns (`member_user_id = auth.uid()`) on bookings/bids, or membership-derived on people/memberships/junction/rsvps.
- ⌘ Writes go through service-role Server Actions, not RLS. RLS is row-level, not column-level — exposing direct UPDATE access would let the client mutate any column on the matched row.
- ★ Partner reads only their own `partner_organizations` row (`id = auth_partner_org_id()`).
- ◇ Derived via SECURITY DEFINER helper functions — see §4 and §5.
- △ Membership coordinator can update memberships and the junction within their property; read of `people` covers people on memberships at their property.
- ⁂ Anon read is gated on `is_active = true` for tables that have that column (time_slots, services, add_ons, instructors).
- `R/INS` = member can SELECT and INSERT but not UPDATE — adventure RSVPs are the only place a member directly writes through RLS, and cancellations route through a Server Action.

**Notable absences:**
- Members have **no UPDATE policy anywhere.** Profile edits (phone, name) route through Server Actions that enforce a column allowlist. The reasoning: RLS is row-level — an UPDATE policy for the member role on `people` would allow the browser to change `email`, `invited_at`, `user_id`, etc. The same logic applies to `bookings`, `memberships`, and `rsvps`.
- Staff do not appear in the `processed_webhooks` row at all — that table has RLS enabled with no policies, so only the service role can touch it. See §7.13.
- Property managers and membership coordinators do not appear in `bookings/bids` writes on the member-portal side; admin work on those tables goes through the admin portal (App 3) which uses service-role Server Actions for writes that need column-level enforcement.

---

## 4. Helper Functions

All helpers live in the `public` schema. Defined in Phase 4 (`auth_*`, `is_*`) and the later RLS hotfix migrations (`current_*`, `staff_visible_*`, `current_household_*`).

### 4.1 JWT helpers — `SECURITY INVOKER`

Read the caller's own JWT. No table access; no elevation. Each wraps `auth.jwt()` in `(SELECT auth.jwt())` internally — Postgres treats this as an InitPlan and evaluates the JWT once per query instead of once per row.

| Helper | Returns | Notes |
|---|---|---|
| `auth_role()` | `text` | `'super_admin' \| 'admin' \| 'property_manager' \| 'concierge' \| 'membership_coordinator' \| 'partner' \| 'member' \| NULL` |
| `auth_property_id()` | `uuid` | `NULL` for `super_admin`, `admin`, `member`, anon |
| `auth_partner_org_id()` | `uuid` | `NULL` for everyone except `partner` |
| `is_admin()` | `boolean` | True iff `auth_role() IN ('super_admin', 'admin')` |
| `is_staff()` | `boolean` | True iff role is any internal staff role (the five above, excluding `partner` and `member`) |

**Why `SECURITY INVOKER`:** these helpers only read the JWT, never tables. SECURITY DEFINER here would be a footgun if a helper ever gets extended to read a table — the function would silently bypass RLS for anyone who can call it.

### 4.2 Member-access selectors — `SECURITY DEFINER`

Functions that traverse the `people → membership_people → memberships` chain to compute "what's mine?" for the current user. SECURITY DEFINER is what breaks the RLS-policy cycle — see §5 for the full reasoning. All are `STABLE`, all `SET search_path = public`.

| Helper | Returns | Use in |
|---|---|---|
| `current_person_id()` | `uuid` | The `people.id` for the signed-in auth user, or NULL. `people.user_id` is UNIQUE so this returns at most one row. |
| `current_member_membership_ids()` | `SETOF uuid` | Every `membership_id` the current person has an active junction row on (regardless of the membership's own status). Use in **SELECT** policies so lapsed-membership history stays visible. |
| `current_member_active_membership_ids()` | `SETOF uuid` | Strictly active: junction AND membership both `'active'`. Use in **INSERT WITH CHECK** so new RSVPs can't be created under a lapsed or suspended membership. |
| `current_member_active_property_ids()` | `SETOF uuid` | Distinct `property_id`s the current person has an active membership at. For property-scoped reads like `member_adventures`. |
| `current_household_person_ids()` | `SETOF uuid` | All `person_id`s on any membership the current person shares an active junction with — i.e., spouse + dependents + the primary, depending on who's signed in. Powers the "who else is on this membership" visibility on `/member`. |
| `current_household_user_ids()` | `SETOF uuid` | The distinct `auth.users.id` for everyone in `current_household_person_ids()` whose `people.user_id` is non-NULL. Powers the household-visible bookings policy — so a spouse sees the other spouse's bookings on `/member/bookings`. Added in App 4 sub-phase 4.1. |
| `staff_visible_person_ids()` | `SETOF uuid` | Distinct `person_id`s on active junctions whose membership is at the caller's `auth_property_id()`. For property-scoped staff reads of `people`. |

**Security model — important:** each function reads `auth.uid()` (or `auth_property_id()`) from the JWT internally. A caller cannot pass an arbitrary user_id. The outer policy that calls the helper still enforces `auth_role() = '<expected>'`, so non-members can't reach the `current_member_*` path and non-staff can't reach `staff_visible_person_ids()`.

**Why SECURITY DEFINER (and the bypass it relies on):** SECURITY DEFINER functions run as the function owner. Our owner is `postgres`, which is also the owner of every table in `public`. Table owners bypass RLS by default — we have **not** applied `FORCE ROW LEVEL SECURITY` to any project table. If `FORCE` ever gets added, every SECURITY DEFINER helper above needs review because the bypass would stop and the helper itself would become subject to the policies on the tables it joins.

### 4.3 Other security-definer functions

| Function | Phase | Purpose |
|---|---|---|
| `validate_bid_access_code(slug, code)` | 3 | Lets anon callers verify a bid access code without RLS read access to `bids`. Always runs the bcrypt verify against a dummy hash when no bid matches the slug so timing doesn't leak slug existence. Explicit `REVOKE ALL` + `GRANT EXECUTE` to `anon, authenticated, service_role`. |
| `generate_bid_slug(...)` | 3 | Pure-SQL slug generator. `SECURITY DEFINER` is not strictly required (no RLS bypass needed), but the function reads from `bids` to find collisions and is owned by `postgres` — same bypass mechanics. Surrounded by a UNIQUE constraint on `bids.slug` as the final race safety net. |

---

## 5. The RLS Cycle Pattern (and how we fix it)

This is the single most important pattern in the codebase. Three real cycles were hit during Phase 4 — each one failed at query time with `infinite recursion detected in policy for relation <X>`, and each fix is in a separate migration so the evolution is auditable.

### 5.1 Why the cycle happens

PostgreSQL evaluates ALL applicable policies for a command as an OR. The planner builds the policy dependency graph at **plan time** — it does NOT know which user role will actually run, so it cannot short-circuit branches. If table A's policy SELECTs from table B, and table B's policy SELECTs from table A (directly or transitively), the planner sees a cycle in the graph and refuses every query that touches either table, regardless of role.

Crucially, the error fires even when the cyclic branch would never execute at runtime. A member-role user does not match the `property_manager` branch of `people.staff_read`, but the planner doesn't care — the cycle is structural, detected before any rows are read.

### 5.2 The three cycles we hit

**Cycle 1 — `membership_people` self-recursion.**
The original member-read policy on `membership_people` filtered by `membership_id IN (SELECT mp.membership_id FROM membership_people mp WHERE ...)`. Selecting from `membership_people` inside the policy fires the same policy recursively. Detected by Postgres on the first member-portal page load. Fix in migration `20260518233336_fix_membership_people_recursive_policy.sql` — temporarily narrowed the policy to filter by `person_id` instead, terminating the chain in `people` (which has a self-read that subqueries nothing).

**Cycle 2 — `people ↔ memberships` via the junction.**
The post-split `people` staff-read policies traversed `membership_people → memberships → property_id`. Independently, the `memberships` member-read policy traversed `people` via the junction. Each was fine in isolation; both together closed the loop. Fix in migration `20260518234818_break_people_memberships_rls_cycle.sql` — introduced `staff_visible_person_ids()` SECURITY DEFINER helper, replaced the staff subqueries with `id IN (SELECT staff_visible_person_ids())`. The function is opaque to the planner, so the cycle arrow disappears.

**Cycle 3 — comprehensive refactor of member-facing policies.**
Once the patch in cycle 2 worked, the broader pattern was generalized in `20260518235335_rls_helpers_for_member_access.sql`. Every member-facing policy that crossed tables was rewritten to use one of the four `current_member_*` helpers. This includes restoring the household visibility on `membership_people` (Sarah sees John's spouse row on their shared membership), which the cycle-1 hotfix had narrowed to "own person_id only."

### 5.3 The canonical fix — SECURITY DEFINER selector

The pattern, applied identically everywhere a cross-table member or staff check is needed:

```sql
-- 1. The helper. Reads identity (auth.uid() or auth_property_id())
--    from the JWT internally, returns a set of IDs the caller is
--    allowed to see. Function-internal reads bypass RLS because
--    the function owner (postgres) is the table owner.
CREATE OR REPLACE FUNCTION current_member_membership_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT mp.membership_id
  FROM membership_people mp
  WHERE mp.person_id = (SELECT current_person_id())
    AND mp.status = 'active';
$$;

-- 2. The policy. Outer guard enforces the role; the IN clause does
--    the visibility check. The planner sees an opaque function call,
--    not a table reference — no cycle dependency arrow is added.
CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND membership_id IN (SELECT current_member_membership_ids())
  );
```

### 5.4 Pre-migration checklist for any policy that crosses tables

Before applying a migration that touches RLS:

1. **List every other table the policy's USING / WITH CHECK references** (directly, or via a function the policy calls). Include subqueries.
2. **For each referenced table, list its current policies.** If any policy on a referenced table references back to the original table — directly OR transitively through a third table — there's a cycle.
3. **If a cycle exists, refactor with a SECURITY DEFINER selector function.** Existing helpers cover the common cases; only add new ones if none fit, and document them in the same migration as the policy that uses them.
4. **Run the policy against the live DB as the actual role.** Migration apply success is NOT proof — the cycle error fires at query time, not DDL time. Use `/dev` to switch identity or the `docs/manual-testing.md` scenarios.

### 5.5 What stays as inline EXISTS / IN

Not every cross-table reference is a cycle risk. Inline subqueries are fine when:

- The referenced table has no policy that references back. Example: `booking_disciplines.member_read` does `EXISTS (SELECT 1 FROM bookings ...)` — `bookings` has no policy that traverses `booking_disciplines`, so the dependency graph is a tree, not a cycle.
- The reference is one-directional staff scoping. The `property_manager` reads on `membership_people`, `rsvps`, `booking_disciplines`, etc. all do `EXISTS (SELECT 1 FROM <parent> WHERE property_id = auth_property_id())`. The parent table's policies don't traverse the child, so no cycle.

The current codebase has inline EXISTS in many staff-scoped policies (see §7). They're load-bearing audit value — the policy reads as "PM sees X where parent.property_id matches" — and they don't cycle. **Do not preemptively rewrite them into helper functions.** Only refactor to SECURITY DEFINER when the cycle check in §5.4 actually flags a problem.

---

## 6. Application-Layer Contract

RLS is one of two gates. The middleware allowlist in `middleware.ts` is the other.

### 6.1 Strict portal allowlist

```
/admin   → super_admin, admin, property_manager, concierge, membership_coordinator
/member  → member ONLY
/partner → partner ONLY
```

**Admins are NOT in the `/member` or `/partner` allowlists.** This is intentional and documented in `CLAUDE.md` (Architecture Decisions) and the `project-admin-member-visibility` memory entry. The reasoning:

- Each portal queries data scoped to `auth.uid()` (member portal: `current_person_id()` → memberships; partner portal: bookings where `concierge_user_id = auth.uid()`). An admin landing on `/member` would render "no memberships" because they have no `people` row.
- Making a single component branch into "real member" vs "admin preview" mixes two UIs in one place — separation-of-concerns smell.
- Admin visibility into member data will live INSIDE `/admin` in App 3 as a "preview as <member>" view that reuses `/member` React components but fetches by `member_id` via the admin's broader RLS scope. Admin stays signed in as themselves; no token-swap, no impersonation.

Full impersonation (admin signs in literally as the member) is deferred indefinitely.

### 6.2 Service-role write paths

The secret-key client (`lib/supabase/service.ts` → `createServiceRoleClient`) bypasses all RLS. Use it from Server Actions and Route Handlers for:

- Public booking-flow writes (the guest-facing checkout that creates `bookings` + `bids`).
- Webhook handlers (Stripe payment_intent.*, Dropbox Sign signature_request.*).
- Public bid-page reads on `/bid/[slug]` — anon has no RLS read on `bids`; service role fetches and column-projects to a customer-safe allowlist.
- Member seeding from the Excel roster (Inngest `seed-member-invites`).
- Auth callback's `people.user_id` link and `app_metadata.role` stamp.
- Any "write where RLS allows the user to UPDATE but we want column-level enforcement" — see §6.3.

### 6.3 Column-level enforcement lives in Server Actions, not RLS

RLS is row-level. An UPDATE policy that matches grants permission to update **any** column on the matched row. This is the single most consequential RLS gotcha in this project.

The pattern, applied wherever a user-facing UPDATE is needed:

```typescript
// Server Action — never a direct client-side update.
export async function updateMemberPhone(input) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const admin = createServiceRoleClient();

  // Column allowlist enforced here, not by RLS.
  await admin
    .from("people")
    .update({ phone: input.phone, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
}
```

This is why no member-facing table has a member-role UPDATE policy. The migration files spell it out in comments (`people`, `members` legacy, `member_adventure_rsvps`).

### 6.4 The JWT refresh dance

`updateUserById` writes `app_metadata` to `auth.users`, but the user's cookie JWT was issued before that write and still carries the old (or absent) role. RLS reads the JWT, not the DB. Without an immediate `supabase.auth.refreshSession()` before redirecting, every member-scoped read in the next page hit will silently return zero rows.

This is load-bearing in `app/auth/callback/route.ts` — the comment there says "this exact bug was a real incident."

---

## 7. Policy Reference (per table)

Source of truth is the migrations under `supabase/migrations/`. This section captures the **current** state of each table after all hotfixes. Policy bodies are quoted; reason notes explain non-obvious choices.

### 7.1 `properties` (Phase 1)

```sql
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties: public read"  ON properties FOR SELECT USING (true);
CREATE POLICY "properties: admin write"  ON properties FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

- Public catalog. Properties never go inactive — there are exactly three.
- Admin write uses the pre-helper raw form (Phase 1 predates `is_admin()`).

### 7.2 `time_slots`, `services`, `add_ons`, `instructors` (Phase 1)

All four follow the same triple-policy shape:

```sql
-- Anon and authenticated see active rows.
CREATE POLICY "<table>: public read active"  ON <table> FOR SELECT USING (is_active = true);
-- Admins see all rows including inactive (for the admin portal toggle UI).
CREATE POLICY "<table>: admin read all"      ON <table> FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
-- Admin write.
CREATE POLICY "<table>: admin write"         ON <table> FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

`instructors` also has a property-manager write policy (PMs schedule their own staff):

```sql
CREATE POLICY "instructors: admin and pm write"
  ON instructors FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );
```

### 7.3 `service_add_ons` (Phase 1)

```sql
CREATE POLICY "service_add_ons: public read"  ON service_add_ons FOR SELECT USING (true);
CREATE POLICY "service_add_ons: admin write"  ON service_add_ons FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

- Public read with no `is_active` gate — the parent `services` row's gate is sufficient. A junction row pointing at an inactive service is harmless because the service itself won't render.

### 7.4 `pricing_rules` (Phase 1)

```sql
CREATE POLICY "pricing_rules: staff read"   ON pricing_rules FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')
         IN ('super_admin', 'admin', 'property_manager', 'concierge', 'membership_coordinator'));
CREATE POLICY "pricing_rules: admin write"  ON pricing_rules FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

- Staff-only read — pricing logic is competitive info and is never exposed to anon, members, or partners directly. The public booking flow computes price server-side and returns only the result.
- `concierge` is in the staff-read allowlist even though concierge currently has no admin UI for pricing. Future-proofing.

### 7.5 `bookings` (Phase 2)

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings: admin read all"        ON bookings FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "bookings: property_manager read" ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
  );

CREATE POLICY "bookings: concierge read own"    ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND concierge_user_id = (SELECT auth.uid())
  );

CREATE POLICY "bookings: partner read own"      ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND concierge_user_id = (SELECT auth.uid())
  );

CREATE POLICY "bookings: member household read"  ON bookings FOR SELECT
  USING (
    auth_role() = 'member'
    AND member_user_id IN (SELECT current_household_user_ids())
  );

CREATE POLICY "bookings: staff update"          ON bookings FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'property_manager')
    AND (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
      OR property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );
```

- No INSERT policy — bookings are created exclusively by the public booking flow Server Action via service role.
- `concierge` and `partner` share `concierge_user_id` — both roles are external-facing booking origins keyed on the auth user who created the booking.
- Member read is **household-scoped** as of App 4 sub-phase 4.1 — `current_household_user_ids()` returns every auth user_id on a membership the caller shares. Spouse A sees spouse B's bookings on `/member/bookings`. The bookings table is still stamped with the literal booker's `member_user_id`; the policy just widens visibility. Child tables (`booking_disciplines`, `booking_add_ons`, `bids`) keep the narrower `member_user_id = auth.uid()` policy — the `/member/bookings` card view doesn't need those for non-mine rows, and bid signing/access codes stay scoped to the original booker.
- Staff UPDATE is row-level — `property_manager` is bound to their property, but they can still change any column. Column-level (e.g. PM may change `status` / `confirmed_price` but NOT `guest_email` / `property_id`) is enforced inside service-role Server Actions in App 3.

### 7.6 `booking_disciplines`, `booking_add_ons` (Phase 2)

Same shape both tables — read scoped to the parent booking:

```sql
CREATE POLICY "<table>: admin read"             ON <table> FOR SELECT
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                 AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')));

CREATE POLICY "<table>: property_manager read"  ON <table> FOR SELECT
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                 AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
                 AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)));

CREATE POLICY "<table>: member household read"  ON <table> FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                AND b.member_user_id IN (SELECT current_household_user_ids())));

CREATE POLICY "<table>: partner read own"       ON <table> FOR SELECT
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                 AND b.concierge_user_id = (SELECT auth.uid())));
```

- Inline EXISTS to `bookings` — **not** a cycle risk (see §5.5). `bookings` policies don't reference these children. The per-row cost is one PK lookup by `bookings.id`.
- Writes are service role only.

### 7.7 `bids` (Phase 3)

```sql
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bids: admin read"              ON bids FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "bids: property_manager read"   ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid))
  );

CREATE POLICY "bids: concierge read own"      ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                AND b.concierge_user_id = (SELECT auth.uid()))
  );

CREATE POLICY "bids: partner read own"        ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                AND b.concierge_user_id = (SELECT auth.uid()))
  );

CREATE POLICY "bids: member household read"   ON bids FOR SELECT
  USING (
    auth_role() = 'member'
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                AND b.member_user_id IN (SELECT current_household_user_ids()))
  );

CREATE POLICY "bids: staff update"            ON bids FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id
                  AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid))
    )
  );
```

- **Anon does not read `bids` through RLS.** The public bid page (`/bid/[slug]`) fetches via service role and column-projects to a customer-safe allowlist. The `validate_bid_access_code` SECURITY DEFINER function is the gate — see §4.3.
- Same inline-EXISTS-to-bookings pattern as booking_disciplines/booking_add_ons. Same one-PK-lookup performance profile.
- No INSERT policy — bids are created in the same transaction as the booking, via service role.

### 7.8 `partner_organizations` (Phase 4)

```sql
ALTER TABLE partner_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_orgs: admin read"             ON partner_organizations FOR SELECT USING (is_admin());

CREATE POLICY "partner_orgs: property_manager read"  ON partner_organizations FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "partner_orgs: partner read own"       ON partner_organizations FOR SELECT
  USING (auth_role() = 'partner' AND id = auth_partner_org_id());

CREATE POLICY "partner_orgs: admin insert"           ON partner_organizations FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "partner_orgs: admin update"           ON partner_organizations FOR UPDATE USING (is_admin());
CREATE POLICY "partner_orgs: admin delete"           ON partner_organizations FOR DELETE USING (is_admin());
```

- First table to use the new helpers (Phase 4).
- Writes split into explicit insert/update/delete so the policy intent shows up unambiguously on Phase 7 audits. `FOR ALL` would have covered SELECT too — redundantly with the three explicit SELECT policies, but harder to read.

### 7.9 `people` (Phase 4 refactor + Phase 4 cycle hotfix + household visibility)

```sql
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people: self read"                       ON people FOR SELECT
  USING (auth_role() = 'member' AND user_id = (SELECT auth.uid()));

CREATE POLICY "people: member read household"           ON people FOR SELECT
  USING (auth_role() = 'member' AND id IN (SELECT current_household_person_ids()));

CREATE POLICY "people: admin read"                      ON people FOR SELECT USING (is_admin());

CREATE POLICY "people: property_manager read"           ON people FOR SELECT
  USING (auth_role() = 'property_manager' AND id IN (SELECT staff_visible_person_ids()));

CREATE POLICY "people: membership_coordinator read"     ON people FOR SELECT
  USING (auth_role() = 'membership_coordinator' AND id IN (SELECT staff_visible_person_ids()));

CREATE POLICY "people: admin write"                     ON people FOR ALL USING (is_admin());
```

- **Self read** is the cycle-breaker — `WHERE user_id = auth.uid()` references no other table.
- **Household read** uses `current_household_person_ids()` (SECURITY DEFINER) — the spouse sees the primary's `people` row, and vice versa.
- **Staff reads** use `staff_visible_person_ids()` instead of inline cross-table EXISTS to avoid the Cycle 2 case.
- No member-role UPDATE policy. Profile edits (phone) go through a Server Action with column allowlist (see §6.3).
- No member or staff INSERT policy — seeding from the Excel roster runs via service role, and the auth-callback `user_id` link runs via service role too.

### 7.10 `memberships` (Phase 4 refactor + helper migration)

```sql
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships: member read"                  ON memberships FOR SELECT
  USING (auth_role() = 'member' AND id IN (SELECT current_member_membership_ids()));

CREATE POLICY "memberships: admin read"                   ON memberships FOR SELECT USING (is_admin());

CREATE POLICY "memberships: property_manager read"        ON memberships FOR SELECT
  USING (auth_role() = 'property_manager' AND property_id = auth_property_id());

CREATE POLICY "memberships: membership_coordinator read"  ON memberships FOR SELECT
  USING (auth_role() = 'membership_coordinator' AND property_id = auth_property_id());

CREATE POLICY "memberships: admin write"                  ON memberships FOR ALL USING (is_admin());

CREATE POLICY "memberships: membership_coordinator update" ON memberships FOR UPDATE
  USING (auth_role() = 'membership_coordinator' AND property_id = auth_property_id());
```

- Member read goes through `current_member_membership_ids()` — includes memberships whose status is not `active` (e.g., lapsed) so members can still see history. Use `current_member_active_membership_ids()` only on INSERT paths where the membership must be currently active.
- `property_manager` and `membership_coordinator` read directly on `property_id` because the column is on the row itself — no cross-table traversal needed.

### 7.11 `membership_people` (junction — Phase 4 refactor + cycle fix 1 + helper migration)

```sql
ALTER TABLE membership_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_people: member read same membership"
  ON membership_people FOR SELECT
  USING (auth_role() = 'member' AND membership_id IN (SELECT current_member_membership_ids()));

CREATE POLICY "membership_people: admin read"
  ON membership_people FOR SELECT USING (is_admin());

CREATE POLICY "membership_people: property_manager read"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (SELECT 1 FROM memberships m
                WHERE m.id = membership_id AND m.property_id = auth_property_id())
  );

CREATE POLICY "membership_people: membership_coordinator read"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND EXISTS (SELECT 1 FROM memberships m
                WHERE m.id = membership_id AND m.property_id = auth_property_id())
  );

CREATE POLICY "membership_people: admin write"
  ON membership_people FOR ALL USING (is_admin());

CREATE POLICY "membership_people: membership_coordinator write"
  ON membership_people FOR ALL
  USING (
    auth_role() = 'membership_coordinator'
    AND EXISTS (SELECT 1 FROM memberships m
                WHERE m.id = membership_id AND m.property_id = auth_property_id())
  );
```

- Member read is the cycle case: now goes through `current_member_membership_ids()` (SECURITY DEFINER). This restored the household-visibility semantics that the cycle-1 hotfix had temporarily narrowed.
- Staff reads use inline EXISTS to `memberships` — one-directional, no cycle. `memberships` policies do NOT subquery `membership_people`.
- `membership_coordinator` is the only non-admin role with a write policy. Used for adding/removing authorized people on memberships at their property.

### 7.12 `member_adventures` (Phase 5 + Phase 4 refactor patch + helper migration)

```sql
ALTER TABLE member_adventures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (SELECT current_member_active_property_ids())
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

- Member read filters by `status IN ('published', 'sold_out')` — draft and completed adventures stay hidden. `cancelled` is also hidden, which is intentional (a cancelled-by-staff adventure should disappear from the member portal).
- Property scope via `current_member_active_property_ids()` — the helper requires both junction AND membership to be `active`, so lapsed members don't see adventures.
- PMs both read and write at their own property; admins everywhere.

### 7.13 `member_adventure_rsvps` (Phase 4 refactor + helper migration)

```sql
ALTER TABLE member_adventure_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (auth_role() = 'member' AND membership_id IN (SELECT current_member_membership_ids()));

CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (auth_role() = 'member' AND membership_id IN (SELECT current_member_active_membership_ids()));

CREATE POLICY "rsvps: admin read all"
  ON member_adventure_rsvps FOR SELECT USING (is_admin());

CREATE POLICY "rsvps: property_manager read"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (SELECT 1 FROM member_adventures a
                WHERE a.id = adventure_id AND a.property_id = auth_property_id())
  );

CREATE POLICY "rsvps: staff update"
  ON member_adventure_rsvps FOR UPDATE
  USING (
    is_admin()
    OR (
      auth_role() = 'property_manager'
      AND EXISTS (SELECT 1 FROM member_adventures a
                  WHERE a.id = adventure_id AND a.property_id = auth_property_id())
    )
  );
```

- **The only place a member directly writes through RLS.** INSERT uses `current_member_active_membership_ids()` — both junction and membership must be `active` to RSVP.
- No member UPDATE policy. Cancellations route through a Server Action (column allowlist: `status` can only move to `'cancelled'`; the action also handles refunds and waitlist promotion).
- Read policy uses `current_member_membership_ids()` (broader — junction-active OR membership-active), so members can still see their own historical RSVPs under a lapsed membership.
- Household sharing: an RSVP belongs to a `membership_id`, not a person. Sarah and John on a shared membership both see the same RSVP. UNIQUE constraint on `(adventure_id, membership_id)` ensures they can't double-RSVP the same membership to the same adventure.

### 7.14 `processed_webhooks` (Phase 6)

```sql
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
-- (No CREATE POLICY statements — service role only.)
```

- The defining example of "RLS enabled with no policies." Supabase's default GRANTs to `anon` and `authenticated` would otherwise expose the webhook idempotency log. With RLS on and no policies, every non-service-role read returns zero rows and every non-service-role write fails.
- Accessed exclusively by service-role Route Handlers (Stripe webhook, Dropbox Sign webhook).

---

## 8. Testing Protocol

### 8.1 Primary path — `/dev` dashboard + `docs/manual-testing.md`

For policies that gate the member portal, run the manual-testing scenarios. They are the canonical proof that the policies work end-to-end with the real auth flow:

- Scenario A — single-property member, happy path
- Scenario B — cross-property member (one person, three memberships, three properties)
- Scenario B2 — household sharing (two people, one membership)
- Scenario C — wrong-role bounce (admin tries `/member`)
- Scenario D — expired invite
- Scenario E — property-manager scope

All six passed on 2026-05-18 against live Supabase. Re-run before any change that touches `app/auth/callback/route.ts`, `middleware.ts`, the people / memberships / junction schema, or any RLS policy on those tables.

### 8.2 Policy-level — SQL editor with claim impersonation

For new policies that don't have a `/dev` scenario yet, use Supabase SQL editor's per-statement role/claim override. Postgres applies the policies as if the JWT were what you set.

```sql
-- Member impersonation. Replace UUIDs with real seeded ones.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{
  "sub": "<member-auth-user-uuid>",
  "role": "authenticated",
  "app_metadata": { "role": "member" }
}';

-- The seeded person must exist in `people` with user_id = sub, and
-- be on at least one active junction row, or these queries return 0.
SELECT id, member_number FROM memberships;        -- only those the person is on
SELECT id, role        FROM membership_people;     -- per the household-visibility policy
SELECT id, title       FROM member_adventures;    -- only at the person's active properties
SELECT id              FROM bookings;              -- only where member_user_id = sub
SELECT * FROM pricing_rules;                       -- 0 rows — staff-only
```

```sql
-- Property manager impersonation
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{
  "sub": "<pm-auth-user-uuid>",
  "role": "authenticated",
  "app_metadata": {
    "role": "property_manager",
    "property_id": "<horseshoe-bay-uuid>"
  }
}';

SELECT id FROM bookings;     -- only HSB bookings
SELECT id FROM memberships;  -- only HSB memberships
```

```sql
-- Anon
SET LOCAL ROLE anon;
SELECT * FROM properties;                          -- 3 rows
SELECT * FROM services WHERE is_active = true;     -- catalog
SELECT * FROM pricing_rules;                       -- 0 rows
SELECT * FROM bookings;                            -- 0 rows
SELECT * FROM processed_webhooks;                  -- 0 rows
```

```sql
-- Service role bypasses everything — sanity check
SET LOCAL ROLE service_role;
SELECT count(*) FROM pricing_rules;                -- all rows
SELECT count(*) FROM processed_webhooks;           -- all rows
```

### 8.3 Cycle detection — DDL-only is not enough

Migration apply success is **not** proof a policy works. Cycle errors fire at query time, not DDL time. After applying any migration that adds or modifies a cross-table policy:

1. Run the most relevant SQL editor impersonation above.
2. If the new policy is member-scoped, additionally run Scenarios A and B from `docs/manual-testing.md`.
3. If it's staff-scoped, additionally manually run the property-manager and admin queries.

A passing migration with a failing query is the exact failure mode the Phase 4 hotfixes exist to prevent.

---

## 9. Common Pitfalls

**Multiple SELECT policies are OR'd together.** Two SELECT policies that both match a row both grant access — the user sees the union. This is intentional (admin matches its broad policy, member matches its narrow one). Do not write policies expecting one to "restrict" another.

**`WITH CHECK` vs `USING` for INSERT.** `USING` filters rows visible for read/update; `WITH CHECK` filters rows that may be inserted. For INSERT policies, only `WITH CHECK` applies. Postgres accepts `FOR INSERT USING (...)` but the policy effectively does nothing.

**RLS does not apply to the service role.** The secret key bypasses every policy. Server Actions and Route Handlers using `createServiceRoleClient` have full read/write access. This is intentional — service role is for operations that cross user boundaries (checkout, webhooks, member seeding). Guard at the application layer (input validation, column allowlists, auth checks in the Server Action), not at the RLS layer.

**`auth.uid()` returns NULL for unauthenticated requests.** A policy like `member_user_id = auth.uid()` evaluated for anon returns false (`NULL = NULL` is `NULL`, which is falsy in USING). This is correct — anon users see nothing in tables with only authenticated-user policies. But it means an anon caller hitting a member-scoped table doesn't get an error; they get zero rows. The error you might expect (`auth required`) never fires.

**RLS is row-level, not column-level.** An UPDATE policy that matches grants permission to update **any** column. This bit us twice in plan review — the original `members: member update own` and `rsvps: member cancel own` policies would have let the publishable-key client change `status`, `membership_tier`, `member_number`, `guest_count`, etc. The fix is to remove the UPDATE policy and route the write through a Server Action that uses the service role and enforces an explicit column allowlist. See §6.3.

**Use the helpers, never raw `auth.jwt()` in new policies.** `auth_role()`, `auth_property_id()`, `is_admin()`, `is_staff()` each wrap `auth.jwt()` in `(SELECT auth.jwt())` internally, which Postgres treats as an InitPlan — one parse per query, not one per row. The helpers are also more audit-friendly: `is_admin()` is unambiguous in a way that `(auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')` is not. Phases 1–3 predate the helpers; new work uses helpers.

**Don't inline EXISTS for cross-table member reads.** If the referenced table has any policy that subqueries back (directly or transitively), the planner detects a cycle and every query fails with `infinite recursion detected in policy for relation X`. Use a SECURITY DEFINER selector function (see §5.3). For staff reads where the referenced table is scoped one direction only, inline EXISTS is fine and more readable.

**`SECURITY DEFINER` functions need `SET search_path = public`.** Without it, a malicious actor who can create objects in a schema you don't expect can shadow your tables and the function reads from the wrong place. Every helper in §4.2 sets it; new SECURITY DEFINER functions must too.

**JWT refresh after `updateUserById`.** `updateUserById` writes to `auth.users` but does NOT mutate the JWT in the user's cookies. RLS reads the JWT. Without an immediate `supabase.auth.refreshSession()` before redirecting, the next page hit evaluates every policy with the old (or absent) role. This was a real incident — `/member` rendered "no memberships" even though the rows were linked. See `app/auth/callback/route.ts` for the canonical pattern.

**`FORCE ROW LEVEL SECURITY` is not applied to any project table.** The six SECURITY DEFINER helpers in §4.2 rely on the table-owner bypass to do their cross-table work without re-entering RLS. If `FORCE` ever gets added, every SECURITY DEFINER helper needs review — the bypass would stop, the helpers would become subject to the policies on the tables they join, and the cycles would re-emerge.

**Views bypass RLS by default.** Any view that exposes member or partner data must be created `WITH (security_invoker = true)`, otherwise the view inherits the owner's privileges and side-steps every policy. No views currently exist in the project; this is preventative.

**Don't return more than RLS allows and then filter in the client.** RLS guarantees the wire only contains what the user is allowed to see — but only if the query asked for the right scope. A query like `.from('bookings').select('*')` on the member portal is fine because RLS filters server-side. A query that joins through admin-only data via a service-role server call is fine because the projection runs server-side. Mixing the two — pulling broad scopes with service role and trusting the client to filter — defeats the entire model.

---

## 10. Changelog of policy-level changes since Phase 4 cut

Tracked here so the migration history's intent is recoverable without re-reading every file:

| Date | Migration | Change |
|---|---|---|
| 2026-05-18 | `20260518230913_phase_4_fix_user_id_unique` | Dropped accidental UNIQUE on the old `members.user_id` (now superseded by the split). |
| 2026-05-18 | `20260518232029_split_members_into_people_memberships` | Replaced `members` with `people` + `memberships` + `membership_people`. Recreated `member_adventure_rsvps` against `memberships.id`. Updated `member_adventures` member-read to traverse the junction. |
| 2026-05-18 | `20260518233336_fix_membership_people_recursive_policy` | Cycle 1 hotfix — narrowed `membership_people` member-read to filter by `person_id` (terminates in `people` self-read). Temporarily lost household visibility. |
| 2026-05-18 | `20260518234818_break_people_memberships_rls_cycle` | Cycle 2 hotfix — introduced `staff_visible_person_ids()` SECURITY DEFINER helper. Replaced `people` staff-read inline EXISTS with helper. |
| 2026-05-18 | `20260518235335_rls_helpers_for_member_access` | Comprehensive member-policy refactor. Added `current_person_id()`, `current_member_membership_ids()`, `current_member_active_membership_ids()`, `current_member_active_property_ids()`. Rewrote member-facing policies on `memberships`, `membership_people`, `member_adventure_rsvps`, `member_adventures`. Restored household visibility on the junction. |
| 2026-05-18 | `20260519015647_household_visibility_on_people` | Added `current_household_person_ids()` and `people: member read household` policy so members can read the `people` rows of other people on shared memberships. |
| 2026-05-30 | `20260530120000_household_visible_bookings` | App 4 sub-phase 4.1. Added `current_household_user_ids()` SECURITY DEFINER helper. Replaced `bookings: member read own` with `bookings: member household read` — spouses now see each other's bookings on `/member/bookings`. Scope deliberately narrow: did not expand `booking_disciplines`, `booking_add_ons`, or `bids` member-read policies — the v1 `/member/bookings` card view doesn't need child rows for non-mine bookings, and bid signing/access stays scoped to the original booker. |
| 2026-05-30 | `20260530140000_stamp_member_user_id_on_public_bookings` | App 4 sub-phase 4.1 follow-up. Added `p_member_user_id` (defaulted) to `create_public_booking` RPC so signed-in members get attribution stamped on public-funnel bookings. One-shot backfill links every prior NULL `member_user_id` row to its matching `people.user_id` via `guest_email`. Respects the `one_origin` CHECK by excluding rows with `concierge_user_id` set. |
| 2026-05-30 | `20260530160000_household_visible_booking_children` | App 4 sub-phase 4.1 detail-page enablement. Replaced `bids: member read own`, `booking_disciplines: member read own`, and `booking_add_ons: member read own` policies with `... member household read` variants — same `current_household_user_ids()` pattern as the bookings policy. Powers `/member/bookings/[id]` so any household member can see gear lists, schedule notes, FAQ, disciplines, and add-ons on a shared booking. Access codes / sign + pay surfaces are unchanged — only SELECT widens. |

When adding a new entry here, also append a row to the verification log in `docs/manual-testing.md` if the change requires re-running the auth-flow scenarios.

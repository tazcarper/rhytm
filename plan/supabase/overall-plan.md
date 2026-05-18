# Rhythm Outdoors — Database Build Plan

## Guiding Constraints

Before touching a single table, three rules govern every decision:

1. `property_id` is a foreign key on every table that belongs to a property. Cross-property queries are native SQL joins.
2. RLS (Row-Level Security) is enabled on every table, no exceptions. No public reads or writes without an explicit policy.
3. Availability is enforced by **two independent database-level mechanisms** — not one, and not application logic:
   - **Property capacity:** A `BEFORE INSERT OR UPDATE` trigger on `bookings` checks that the sum of `capacity_reserved` across all concurrent bookings at a property (in any active status) never exceeds `properties.max_concurrent_groups`. "Active" means any status except `cancelled`, `expired`, and `denied` — those three statuses release the hold.
   - **Instructor availability:** A Postgres exclusion constraint on `tstzrange(start_time, end_time)` per instructor prevents instructor double-booking. This constraint applies only when `instructor_id IS NOT NULL` (Private Lesson bookings only). Requires the `btree_gist` extension. The constraint excludes the same three statuses: `cancelled`, `expired`, `denied`.

---

## Booking Types

Three distinct booking flows drive the entire schema. Every difference in validation, duration, pricing, and resource requirements traces back to `booking_type`.

| Type | Label | Duration | Instructor | Capacity Used |
|---|---|---|---|---|
| `plan_a_visit` | "Come out and shoot" | Exactly 2 hours | Not involved | 1 unit |
| `private_lesson` | "One-on-one with an instructor" | 1–3 hours | **Required** | 1 unit |
| `host_an_occasion` | "Host an occasion" | 2–6 hours | Optional | Full property (exclusive use) |

Key design decisions that follow from this:

- `instructor_id` on `bookings` is **nullable**. It is required only for `private_lesson`. Enforced via a `CHECK` constraint: `CHECK (booking_type != 'private_lesson' OR instructor_id IS NOT NULL)`.
- `host_an_occasion` bookings set `capacity_reserved` to the property's full `max_concurrent_groups` — a milestone event or tournament is exclusive-use. No other booking can overlap it at the same property.
- Duration is stored as an explicit `end_time` on `bookings` (derived from `start_time + duration_hours`). Both are stored to enable efficient overlap queries without recalculation.
- Duration is constrained by type: `plan_a_visit` = exactly 2h (no variation), `private_lesson` = 1–3h, `host_an_occasion` = 2–6h.

---

## Phase 1 — Foundation Tables (No Blockers)

This is the layer everything else builds on. Nothing here depends on any open questions except where noted.

**`properties`**
The top-level reference table. Three rows: Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, Packsaddle Precision.

New field: `max_concurrent_groups` (integer) — the number of independent groups that can be active on property simultaneously (i.e., the number of usable ranges, bays, or stations running in parallel). This is the hard capacity ceiling used by the availability trigger. Seeded from Q2. Defaults to 1 as a placeholder until answered.

**`time_slots`**
Defines valid booking start times per property per day of week — a whitelist of when bookings may begin. Weekday and weekend hours differ and are seeded separately. The UI restricts calendar selection to these times; the database also validates on insert.

Fields: `property_id`, `day_of_week` (integer 0–6, Sunday = 0), `slot_start` (type `time` — e.g., `09:00:00`), `is_active` (boolean), `created_at`.

Unique constraint: `UNIQUE(property_id, day_of_week, slot_start)` — a property cannot have the same start time twice on the same day of week.

There is no `slot_end` on this table — duration is determined by `booking_type`, not by the slot definition. A single slot can be the start point for a 1-hour private lesson or a 6-hour occasion.

**`services`**
The catalog of bookable disciplines per property: sporting clays, wobble deck, pistol bays, hunts, etc. Each service belongs to one property — no cross-property assumptions even if names match. Drives the discipline selection in the intake form and populates `booking_disciplines`. Seed data blocked by Q4.

**`add_ons`**
The catalog of optional add-ons per property: ammunition packages, drink cart, equipment rental, instruction upgrades, etc. Each add-on belongs to one property — same property-scoped pattern as `services`. A drink cart that exists at all three properties is three separate `add_ons` rows, one per property.

Fields: `id`, `property_id`, `name`, `description`, `price` (`numeric(10,2)`), `is_active`, `created_at`, `updated_at`.

**`service_add_ons`**
Join table defining which add-ons are available for which disciplines at a property. An add-on like "drink cart" that applies to all disciplines gets one row per service. An add-on like "ammunition package" that only applies to sporting clays gets one row. The UI reads this table to show the correct add-on options after a guest selects their disciplines.

Fields: `service_id` (FK → `services`), `add_on_id` (FK → `add_ons`). Primary key on `(service_id, add_on_id)`.

Constraint: `service_id` and `add_on_id` must belong to the same `property_id`. Enforced via a trigger — Postgres cannot enforce this with a simple FK alone.

**`instructors`**
One row per instructor, each belonging to a property. Instructors are optional participants — they are a required resource only for `private_lesson` bookings. The availability constraint lives on the `bookings` table as an exclusion constraint, not here. The instructor record is the anchor; the booking record is the constraint.

**`pricing_rules`**
Replaces Notion on the hot path. Now needs to encode three distinct pricing formulas:
- `plan_a_visit`: tiered per-person rate by group size (cart and clays bundled in).
- `private_lesson`: $200/hour flat rate, with a guest fee for non-members.
- `host_an_occasion`: custom / team-quoted — may not use this table on the hot path at all.

The exact schema shape depends on Q5. Scaffold with placeholder columns; evolve after Q5 is answered. Most likely to require a schema revision post-launch.

---

## Phase 2 — The Booking System

This is the core transaction record. Most of the complexity lives here.

**Booking + bid creation flow**
When a guest completes checkout, the booking and bid are created together in a single atomic transaction — there is no separate "inquiry" stage. The slot is reserved immediately on insert. The bid link exists before staff review. The guest's confirmation email contains the link, which shows a "pending review" state until staff acts. Staff can confirm, deny, or modify the bid through the admin UI.

**`bookings`**
The central fact table. Every booking — from the moment checkout completes through fulfillment — is one row here.

Scheduling and resource fields:
- `booking_type` — enum: `plan_a_visit | private_lesson | host_an_occasion`. Required. Drives all validation rules downstream.
- `start_time` — timestamptz. Must correspond to a valid `time_slots.slot_start` for the property on that date.
- `end_time` — timestamptz, `NOT NULL`. Populated by a `BEFORE INSERT OR UPDATE` trigger (`bookings_00_compute_end_time`) as `start_time + duration_hours * interval '1 hour'`. Not a `GENERATED` column — Postgres treats `timestamptz + interval` as `STABLE` (timezone-sensitive) and forbids it inside `GENERATED ALWAYS AS … STORED`. The trigger also overwrites any caller-supplied value, so drift is impossible.
- `duration_hours` — integer. Constrained by type via CHECK: `plan_a_visit` = 2 (fixed), `private_lesson` = 1–3, `host_an_occasion` = 2–6.
- `instructor_id` — **nullable** FK to `instructors`. Required only for `private_lesson`. Null for all other types.
- `capacity_reserved` — integer. Set by a `BEFORE INSERT` trigger: 1 for `plan_a_visit` and `private_lesson`; `properties.max_concurrent_groups` for `host_an_occasion`. Never set by application code.
- `range` — soft field, team-assigned after booking. Not a scheduling constraint.

Guest and pricing fields:
- `guest_name`, `guest_email`, `guest_phone` — guest contact information stored on the booking record.
- `member_user_id` — nullable FK to the Supabase Auth `users.id`. Populated for member bookings. Required for RLS policies that enforce "members can only read their own bookings."
- `audience_type` — one of `public | member | partner`. Drives which pricing tier applies and which portal the guest came through.
- `guest_count` — integer. Used for tier pricing (`plan_a_visit`) and guest fees (`private_lesson`).
- `estimated_price` — `numeric(10,2)`. Calculated live as the guest configures the form. Never use float for money.
- `confirmed_price` — `numeric(10,2)`. Set by staff when confirming the bid. Will frequently differ from `estimated_price`.
- `guest_notes` — free-text field for guest comments submitted at checkout.

Workflow fields:
- `status` — enum with the following state machine:
  ```
  pending_review → denied          (staff rejected — slot released)
               → awaiting_guest   (staff confirmed/modified — guest can now sign + pay)
                 → signed
                   → deposit_paid
                     → fulfilled
  Any active status → cancelled
  awaiting_guest   → expired      (bid timed out without guest action)
  ```
- `deposit_payment_intent_id` — set when the guest pays the deposit on the bid page.
- `balance_payment_intent_id` — set if a balance payment is collected after the deposit.
- `hubspot_deal_id` — set when the Inngest workflow creates or updates the HubSpot deal. Null until that step runs.
- `concierge_user_id` — nullable FK to Supabase Auth `users.id`. Set when a partner concierge creates the booking.
- `created_at`, `updated_at` — timestamptz. `updated_at` maintained by a `moddatetime` trigger.

**Availability constraints — two independent mechanisms:**

1. **Instructor exclusion constraint** (fires only when `instructor_id IS NOT NULL`):
```sql
ALTER TABLE bookings ADD CONSTRAINT no_instructor_overlap
  EXCLUDE USING gist (
    instructor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (instructor_id IS NOT NULL
    AND status NOT IN ('cancelled', 'expired', 'denied'));
```

2. **Property capacity trigger** (fires on every booking regardless of type):
```sql
-- BEFORE INSERT OR UPDATE trigger on bookings:
SELECT COALESCE(SUM(capacity_reserved), 0)
FROM bookings
WHERE property_id = NEW.property_id
  AND status NOT IN ('cancelled', 'expired', 'denied')
  AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
  AND id != NEW.id;
-- If sum + NEW.capacity_reserved > property.max_concurrent_groups → raise exception
```

Both constraints treat `denied` as a released hold — the same as `cancelled` and `expired`.

**`booking_disciplines`**
Join table between `bookings` and `services`. A guest booking sporting clays + wobble deck + pistol bays generates three rows here. `service_id` as a single FK on `bookings` is wrong — this join table is the correct model.

**`booking_add_ons`**
Records which add-ons a guest selected, and for which discipline. Because a guest may book multiple disciplines and select different add-ons per discipline (e.g., ammunition for sporting clays but not for pistol bays), `service_id` is included to preserve that context.

Fields: `booking_id`, `service_id` (FK → `services` — which discipline this add-on applies to), `add_on_id` (FK → `add_ons`), `quantity` (integer), `unit_price_at_booking` (`numeric(10,2)` — price snapshot at time of booking, never recalculated from live pricing).

Constraint: `service_id` and `add_on_id` must have a corresponding row in `service_add_ons`. Enforced via a trigger.

---

## Phase 3 — Bids

**`bids`**
One row per bid. The bid is created in the same transaction as the booking — it is never a separate step. It is the customer-facing artifact: the permanent URL the guest receives, which shows review status, and eventually hosts the waiver signature and deposit payment once staff confirms.

- `booking_id` — FK to `bookings`. The single directional reference. Do **not** put a `bid_id` on `bookings` — that creates a circular FK. To get a booking's bid, query `bids` by `booking_id`.
- `slug` — auto-generated from guest name + date (e.g., `smith-2026-09-12`). Slug generation runs as a Postgres function with a retry loop — not in application code — to prevent race conditions under concurrent creation. Must be URL-safe, unique (enforced by `UNIQUE` constraint), and overridable by staff before the link goes out.
- `status` — bid's own state machine, parallel to but independent from booking status:
  ```
  pending_review → denied     (staff rejected)
               → confirmed    (staff confirmed — guest can now sign + pay)
                 → signed
                   → paid
  confirmed / signed → expired (timed out without guest completing action)
  ```
- `staff_notes` — internal notes added by staff when reviewing or modifying the bid. Not visible to the guest.
- `faq` — JSONB array. Each property has a default FAQ set; staff can customize per bid before confirming.
- `gear_list` — JSONB array or text. Team-assembled before confirming.
- `dropbox_sign_envelope_id` — set when the Dropbox Sign envelope is created. Required for checking signature status via webhook. Null until staff confirms and the envelope is generated.
- `expires_at` — timestamptz. Set when the bid reaches `confirmed` status. The Inngest expiry workflow watches this field and fires the expiry sequence when `now() > expires_at` and status is still `confirmed` or `signed`.
- `created_at`, `updated_at` — timestamptz.

---

## Phase 4 — Auth and Users

Supabase Auth is the identity layer. Three distinct user types map to three distinct flows.

**Staff and admin users**
Supabase Auth accounts with `app_metadata` roles: `super_admin`, `admin`, `property_manager`, `concierge`, `membership_coordinator`. Role hierarchy lives in `app_metadata`, not a separate roles table. RLS policies read the JWT claim directly.

**Partner concierge accounts**
Each concierge is a Supabase Auth account. Each account links to a row in `partner_organizations` via `partner_org_id` stored in `app_metadata`. When a concierge builds a booking, their `user_id` is stamped on the booking as `concierge_user_id`.

**`partner_organizations`**
One row per hotel or resort partner.
Fields: `id`, `property_id`, `name`, `status` (active/inactive), `created_at`.

**Member accounts**
Members log in via magic link. Their Supabase Auth account links to a row in `members`.

**`members`**
One row per member. Stores: member number, membership tier, property association, household structure (pending Q10), status, and invitation state.
Invitation state fields: `invited_at`, `invite_accepted_at`, `invite_expires_at`. Required to track which Excel-seeded members have accepted their portal invite, which haven't, and when to re-send.

---

## Phase 5 — Member Adventures

**`member_adventures`**
Team-created events that members RSVP into. Capacity-constrained (not instructor-constrained). A draft adventure is invisible to members.

**`member_adventure_rsvps`**
One row per RSVP. Tracks member, guest count, payment intent, confirmed vs. waitlisted status.

Capacity enforcement: use a `BEFORE INSERT` trigger (same pattern as the property capacity trigger on `bookings`) — a naive application-layer count has a time-of-check/time-of-use race condition. Two concurrent RSVPs near capacity can both pass the check before either commits.

---

## Phase 6 — Webhook Idempotency

**`processed_webhooks`** *(new)*
One row per processed webhook event. Required before any Inngest workflow is connected to Stripe or Dropbox Sign.

Fields: `id` (the webhook event ID from the provider), `source` (e.g., `stripe | dropbox_sign`), `processed_at`.

Stripe and Dropbox Sign both retry on timeout. Without this table, a retry can double-charge a deposit or double-create a HubSpot deal.

---

## Phase 7 — RLS Policy Architecture

RLS is not an afterthought — it is written in lockstep with each table.

**The general pattern:**
- `super_admin` and `admin` — unrestricted read/write across all properties.
- `property_manager` — full read/write on bookings and members for their property.
- `concierge` — read/write on bookings and bids they created or are assigned to; no access to `pricing_rules` or member records.
- `membership_coordinator` — read/write on members and membership applications; no booking access.
- Members — read their own record, their own bookings, their own RSVPs. Write their own RSVPs.
- Partners — read their organization's bookings. Write new bookings and bids under their org.
- Public — no direct table access. All public writes go through Server Actions using a service role key scoped to exactly the operation being performed. The service role key must never be exposed client-side.

---

## Sequencing — What to Build First

1. Enable `btree_gist` extension on the Supabase project (required for the instructor exclusion constraint).
2. **Supabase project creation** — one project, connection pooler on port 6543 for serverless, direct connection for migrations. Region must match Vercel deployment region to minimize cross-region latency. All secrets into Vercel environment variables.
3. **`properties`** — seed three rows with `max_concurrent_groups` (placeholder `1` until Q2 is answered).
4. **`time_slots`** — seed valid start times per property from operating hours.
5. **`services`** + **`add_ons`** + **`service_add_ons`** — seed discipline catalog and add-on catalog, then wire them together. All three are blocked by Q4 for Hog Heaven and Packsaddle.
6. **`instructors`** — seed once Q2 (headcount) is answered.
7. **`bookings` + `booking_disciplines` + `booking_add_ons`** — with both the instructor exclusion constraint and the property capacity trigger. The four ordered BEFORE triggers (`00_compute_end_time`, `01_set_capacity_reserved`, `02_validate_start_time`, `03_check_property_capacity`) and the deferred `booking_add_ons_check_discipline` constraint trigger all live in here.
8. **`bids`** — `booking_id` FK to bookings (single direction — no `bid_id` on bookings). Slug generation as a Postgres function.
9. **`processed_webhooks`** — before any Inngest webhook handler is written.
10. **Auth setup** — staff roles in `app_metadata`, `partner_organizations`, member table scaffold.
11. **`pricing_rules`** — placeholder schema, evolved once Q5 is answered.
12. **`member_adventures` + `member_adventure_rsvps`** — after core booking system is stable.
13. **RLS policies** — written alongside each table, not bolted on at the end.

---

## Open Questions That Will Require Schema Changes

| Question | Affected Table(s) | Impact |
|---|---|---|
| Q2 — Property capacity (max_concurrent_groups) | `properties`, capacity trigger | The trigger ceiling. Must be accurate before bookings go live. |
| Q2 — Operating hours / valid start times | `time_slots` | Determines slot_start seed data. |
| Q5 — Pricing formula | `pricing_rules` | Three distinct formulas needed: group-tiered (plan_a_visit), hourly (private_lesson), custom (host_an_occasion). Column shape may change significantly. |
| Q9 — Membership tiers and fees | `members`, `pricing_rules` | New tier enum or lookup table. |
| Q10 — Household structure | `members` | May need `member_households` join table. |
| Q14 — Adventure deposit vs full payment | `member_adventure_rsvps` | New payment fields or state. |
| Q11 — Packsaddle membership | `members`, domains | Third membership tier. |

Previously open, now resolved:
- **Q3 — Self-guided bookings:** `instructor_id` is nullable. `plan_a_visit` and `host_an_occasion` do not require an instructor. Resolved.

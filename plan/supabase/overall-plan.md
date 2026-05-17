# Rhythm Outdoors — Database Build Plan

## Guiding Constraints

Before touching a single table, three rules govern every decision:

1. `property_id` is a foreign key on every table that belongs to a property. Cross-property queries are native SQL joins.
2. RLS (Row-Level Security) is enabled on every table, no exceptions. No public reads or writes without an explicit policy.
3. The double-booking constraint is a database uniqueness constraint on `(instructor_id, start_time)` — not application logic. The database physically rejects the duplicate.

---

## Phase 1 — Foundation Tables (No Blockers)

This is the layer everything else builds on. Nothing here depends on any open questions.

**`properties`**
The top-level reference table. Three rows: Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, Packsaddle Precision. Every property-specific table points here. This table rarely changes — it is configuration, not transactional data.

**`services`**
The catalog of bookable disciplines: sporting clays, wobble deck, pistol bays, hunts, and whatever else each property offers. Each service belongs to a property. This table drives the discipline selection in the intake form and populates the `booking_disciplines` join table.

**`instructors`**
One row per instructor. Each instructor belongs to a property. This table is the source of availability — a slot is "taken" when a row exists in `bookings` for that `(instructor_id, start_time)`. The uniqueness constraint lives here in the form of the bookings table's constraint, but the instructor record is the anchor.

**`pricing_rules`**
Replaces Notion on the hot path. Stores rates per service, per property, per audience type. Editable through the internal admin UI without a deployment. The exact schema shape here depends on Q5 (pricing formula) — but the table can be scaffolded with placeholder columns and evolved once that answer comes in. This is the one table most likely to need a schema revision post-launch.

---

## Phase 2 — The Booking System

This is the core transaction record. Most of the complexity lives here.

**`bookings`**
The central fact table. Every inquiry, bid, signed booking, and fulfilled event is one row here. Key fields and their purpose:

- `audience_type` — one of `public | member | partner`. This drives which pricing tier applies and which portal the guest came through.
- `instructor_id` — the hard availability constraint. Required. Drives the uniqueness check.
- `range` — soft field, team-assigned after booking. Not a scheduling constraint.
- `status` — the state machine: `inquiry → bid_sent → signed → deposit_paid → confirmed → fulfilled → cancelled | expired`. The application and Inngest workflows advance this field. HubSpot mirrors it downstream.
- `estimated_price` vs `confirmed_price` — two separate fields, never the same column. Estimated is calculated live as the guest configures the form. Confirmed is set by the team before the bid is published. These values will frequently differ.
- `bid_id` — foreign key to the bids table. A booking can exist before a bid is generated.
- `stripe_payment_intent_id` — set when the guest initiates payment on the bid page.
- `hubspot_deal_id` — set when the Inngest workflow creates or updates the HubSpot deal. Null until that step runs.

**`booking_disciplines`**
The join table between bookings and services. A guest booking sporting clays + wobble deck + pistol bays generates three rows here, all pointing to the same `booking_id`. This is why `service_id` as a single FK on bookings is wrong — the correct model is this join table.

---

## Phase 3 — Bids

**`bids`**
One row per bid. A bid is the customer-facing artifact: the URL the guest receives, signs, and pays on. Key design decisions:

- The `slug` is auto-generated from guest/company name + date (e.g., `fleet-2026-07-12`). It must be URL-safe, unique, and overridable by the team before the bid sends. The slug generation logic runs at bid creation time.
- The `status` field is the bid's own state machine: `draft → published → signed → paid | expired`. It runs parallel to — but independent from — the booking status. A bid can expire without the booking being cancelled (the team may re-issue a new bid).
- `faq` is stored as a JSON array. Each property has a default FAQ; the team can customize it per bid.
- `dropbox_sign_envelope_id` — set when the Dropbox Sign envelope is created. Required for checking signature status via webhook.
- `expires_at` — the Inngest expiry workflow watches this field. When the bid ages past this timestamp without a signature, the workflow fires the expiry sequence.

---

## Phase 4 — Auth and Users

Supabase Auth is the identity layer. Three distinct user types map to three distinct flows.

**Staff and admin users**
These are Supabase Auth accounts with `app_metadata` roles assigned. The role hierarchy from the proposal (`super_admin`, `admin`, `property_manager`, `concierge`, `membership_coordinator`) lives in `app_metadata`, not in a separate roles table. RLS policies read the JWT claim directly. No role table to keep in sync.

**Partner concierge accounts**
Each concierge is a Supabase Auth account. Each account links to a row in `partner_organizations` via a `partner_org_id` stored in `app_metadata`. When a concierge builds a bid, their `user_id` is stamped on the booking as `concierge_user_id`.

**`partner_organizations`**
One row per hotel or resort partner. Concierge accounts link here. Deprovisioning a concierge is a single account disable.

**Member accounts**
Members log in via magic link. Their Supabase Auth account links to a row in a `members` table. The member number (e.g., 17690) is a display field on the member profile, not an auth credential. The Excel roster is seeded at launch — each member row gets a Supabase Auth invite email sent via Inngest.

**`members`**
One row per member. Stores the member number, membership tier, property association, household structure (pending Q10), and status. RLS ensures members can only read and write their own record.

---

## Phase 5 — Member Adventures

**`member_adventures`**
Team-created events that members RSVP into. Structurally different from bookings: capacity is the constraint, not instructor availability. A draft adventure is invisible to members. A published adventure appears in the member portal. A sold-out adventure shows as unavailable. The team controls the lifecycle.

**`member_adventure_rsvps`**
One row per RSVP. Tracks the member, their guest count, the payment intent, and whether they're confirmed or waitlisted. When capacity fills, subsequent RSVPs land on the waitlist automatically — this is application logic, not a database constraint.

---

## Phase 6 — RLS Policy Architecture

RLS is not an afterthought — it is designed alongside the schema. The policy logic follows the role hierarchy directly.

**The general pattern:**
- `super_admin` and `admin` — unrestricted read/write across all properties.
- `property_manager` — full read/write on bookings and members; property_id filter on data access if needed.
- `concierge` — read/write on bookings and bids they created or are assigned to; no access to pricing_rules or member records.
- `membership_coordinator` — read/write on members and membership applications; no booking access.
- Members — read their own record, their own bookings, their own RSVPs. Write their own RSVPs.
- Partners — read their organization's bookings. Write new bookings and bids under their org.
- Public — no direct table access. All public writes go through Server Actions that use a service role key scoped to exactly the operation being performed.

---

## Sequencing — What to Build First

Given the above, the recommended build sequence is:

1. **Supabase project creation** — one project, connection pooler on port 6543, all secrets into Vercel environment variables.
2. **`properties` and `services`** — seed the three properties and the discipline catalog immediately. Every other table depends on these.
3. **`instructors`** — needed before any booking record can be created.
4. **`bookings` + `booking_disciplines`** — the core transaction tables. The uniqueness constraint on `(instructor_id, start_time)` goes in here.
5. **`bids`** — linked to bookings. Slug generation logic can be scaffolded even if the final bid page isn't built yet.
6. **Auth setup** — staff roles in `app_metadata`, partner org table and concierge linking, member table scaffold.
7. **`pricing_rules`** — placeholder schema now, evolved when Q5 is answered.
8. **`member_adventures` + `member_adventure_rsvps`** — after the core booking system is stable.
9. **RLS policies** — written in lockstep with each table, not bolted on at the end.

---

## Open Questions That Will Require Schema Changes

| Question | Affected Table(s) | Impact |
|---|---|---|
| Q5 — Pricing formula | `pricing_rules` | Column shape may change significantly |
| Q9 — Membership tiers and fees | `members`, potentially `pricing_rules` | New tier enum or lookup table |
| Q10 — Household structure | `members` | May need a `member_households` join table |
| Q2 — Instructor headcount | `instructors` | Inform seeding; no schema change |
| Q3 — Self-guided bookings | `bookings` | `instructor_id` may become nullable |
| Q14 — Adventure deposit vs full payment | `member_adventure_rsvps` | New payment fields or state |
| Q11 — Packsaddle membership | `members`, domains | Third membership tier |

The schema should be built to absorb Q3 most carefully — if self-guided bookings are added, making `instructor_id` nullable changes the double-booking constraint logic entirely.

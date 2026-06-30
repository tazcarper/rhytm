# Schema-Extension Architecture Plan — Estimating Engine & the 9-Domain Build List

**Status:** Proposal for Taz to review. **No migrations written yet** — this document
defines the *shape* and the *sequence*. SQL follows, PR by PR, only after the shape is
blessed.

**Author context:** client-contributor proposal (feature branch + PR; never `main`,
never the live DB). Drafted 2026-06-21.

**Source material:** the eight user journeys and the consolidated 9-domain build list
(`Rhythm_User_Journeys.md`), reconciled against the *actual* merged schema in
`supabase/migrations/` (90 migrations as of this writing).

---

## 1. Method and intent

Per Taz's method, architecture precedes feature code. This is a **reconciliation, not a
rewrite**: every proposal below is **additive and reversible**, reuses what is already
merged (especially the `bid_line_items` foundation, the instructor-availability tables,
and the versioned waiver records), and touches no existing column's meaning without
calling it out explicitly.

Three hard constraints govern every PR in this plan:

1. **Additive & reversible.** New tables, new nullable columns, new enum values, new
   policies. No destructive `ALTER`/`DROP` on a column anything reads today. Each PR
   ships a stated rollback.
2. **RLS rules from `CLAUDE.md` are non-negotiable.** Cross-table member access goes
   through `SECURITY DEFINER STABLE` selector functions, never inline `EXISTS`
   subqueries (policy-cycle hazard). `auth.uid()`/`auth.jwt()` wrapped in `(SELECT …)`.
   Every new policy gets an explicit manual test as the actual role. The dependency
   graph is audited before apply.
3. **SOLID at the schema boundary.** Variation by channel/property/booking-type is a
   *configuration row* (a tier, a rule, a strategy key), never a branch hard-coded into
   shared logic. New experience types, price tiers, and fulfillment kinds slot in by
   adding rows, not by editing existing functions.

---

## 2. What already exists (the spine we build on)

This plan deliberately does **not** rebuild any of the following. They are merged and
working:

| Domain | Already in place | Reuse strategy |
|---|---|---|
| Bids / line items | `bids` (tokenized view via `access_code_hash`), `bid_line_items` (materialized breakdown with `kind`/`tax_status`/provenance), `bid_line_overrides` (append-only comp/waive audit), `bid_pricing_events` | **Extend, never replace.** The estimating engine grows *out of* `bid_line_items`. |
| Instructors | `instructors` + `instructor_availability` (recurring) + `_exceptions` (PTO) + `_disciplines` + `_properties`; instructor double-booking `EXCLUDE` constraint on `bookings` | Add a *rate* and a *facility-resource* dimension; the calendar stays. |
| Waivers | `waiver_templates` (versioned, one active/property), `waiver_documents` with ESIGN audit (`signed_ip`, `signed_user_agent`, `pdf_sha256`, `signed_name`, `signer_user_id`, `collected_by_admin_id`), in-person + QR-party modes | Attach signed records to a *participant*; add validity-window reuse. |
| Notifications | Inngest time-based runner, `reminder_settings`, pre-event reminders, unsigned-bid digest, `dev_email_outbox` | Generalize templates + audience + delivery log over the existing runner. |
| Payments | deposit/balance/`amount_paid`/refund on `bookings`+`bids`, idempotent `processed_webhooks` | Add a payment-method-type dimension + house-account hook. |
| People | `people` + `memberships` + `membership_people` junction (household, cross-property), `staff_profiles`, `bookings.created_by_admin_id` | Add a *participant/attendee* model and dedupe; staff-on-behalf already seeded. |
| Catalog | `services`, `add_ons`, `service_add_ons`, `booking_add_ons.quantity`, `bid_gear_templates`(+scopes), `bid_faq_templates`(+scopes) | Add an add-on *type* model + experience→gear mapping. |
| Access/ops | SECURITY DEFINER RLS helper suite, `rate_limit_hits` limiter, `processed_webhooks` | Add staff-acting-on-behalf scope for estimates; kiosk session. |

---

## 3. The gap, stated once

The merged work is strong on **direct transact** (classes/lessons/events-as-adventures)
and on waivers/instructors/notifications. It is thinnest **exactly where the estimating
engine lives** — the star of the launch plan:

- **No lead/request object** exists before a booking (no CRM seed).
- **Pricing is three audiences, not five named tiers** (`audience_type` =
  `public`/`member`/`partner`; member discount is an audience row + line overrides).
- **A bid is 1:1 with a single booking** (`bids.booking_id` is `UNIQUE`). The journey
  needs **one accepted bid → many heterogeneous line-level bookings**, with
  **immutable per-version snapshots**.
- **No participant/attendee model** (waivers attach to bid/booking/property, not to a
  person; no DOB/guardian, no validity-window reuse).
- **Single-resource booking** (instructor guard exists; no facility station/lane for
  the multi-resource guard).
- **Public ticketed events** (tiers, capacity-weight) and **payment rails**
  (Terminal/cash/house-account/AR) are unmodeled.

Everything in §5 closes a piece of this gap.

---

## 4. Migration sequence (PR-by-PR, ordered by dependency)

The star goes first (Taz's call, confirmed). Everything else is sequenced so each PR
only depends on what merged before it. **Participants (PR-2) is the early foundation**
two later PRs (events, per-participant waivers) require.

```
PR-1  Estimating-engine core        ← FIRST. estimate_requests + named price tiers
        │                              + bid versioning + bid→line-level bookings
        │                              (reuses bid_line_items)
        ▼
PR-2  People & participants         ← foundation for PR-5 and PR-6
        │
        ├──────────────┐
        ▼              ▼
PR-3  Catalog typing  PR-4  Resources & multi-resource guard
   & gear mapping        (stations/lanes, instructor rate × duration)
        │              │
        ▼              ▼
PR-5  Events & ticket tiers (needs PR-2 participants, PR-3 catalog)
        │
        ▼
PR-6  Waivers: per-participant + validity window (needs PR-2)
        │
        ▼
PR-7  Notifications generalization (templates/audience/channel/delivery log)
        │
        ▼
PR-8  Payment rails (method-type, Terminal/cash/house-account/AR hook)
        │
        ▼
PR-9  Access/ops & front-desk (staff-on-behalf RLS for estimates, kiosk session, audit)
```

Rationale for the ordering:

- **PR-1 first** — the sharpest pain and the largest structural gap; it unblocks the
  whole estimate→bid→pay pipeline and is self-contained (it extends existing bid tables).
- **PR-2 second** — participants are a prerequisite shared by events (PR-5) and
  per-participant waivers (PR-6); building it early avoids reworking both.
- **PR-3 / PR-4 parallelizable** — catalog typing and facility resources are
  independent of each other; either can land in either order after PR-2.
- **PR-5, PR-6** — depend on participants; events also wants catalog typing.
- **PR-7, PR-8, PR-9** — cross-cutting layers that ride on top of the object model; they
  come last because they touch every domain and are cheapest to design once the nouns
  are settled.

---

## 5. Per-PR design

Each block states: **purpose**, the **new/changed schema** (descriptive — not SQL yet),
**reuse**, **RLS approach**, and **reversibility**. Column types are indicative; final
types are settled in the migration PR.

### PR-1 — Estimating-engine core ★

**Purpose.** Give the estimate→bid→pay pipeline a real backbone: a lead that exists
before a booking, price books selected by channel, immutable bid versions, and one bid
that fans out into many heterogeneous line-level bookings.

**5.1 — Lead / request object.** New table `estimate_requests`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `property_id` | uuid FK→properties | nullable if cross-property at intake |
| `source_channel` | enum `estimate_channel` | `public_group` / `partner` / `non_member` / `member` |
| `status` | enum `estimate_status` | `new → building → sent → accepted / declined → converted`; `expired` |
| `contact_name` / `contact_email` / `contact_phone` | text | minimal lead contact |
| `party_size` | integer | |
| `requested_dates` | jsonb or daterange | multi-date outings (see PR-1 / multi-date) |
| `experiences_interest` | jsonb | free-shape at intake (clays + lunch + lodging…) |
| `budget` / `preferences` / `notes` | text/numeric | |
| `partner_organization_id` | uuid FK→partner_organizations | set when `source_channel = partner` |
| `created_by_person_id` | uuid FK→people | nullable (public has no account) |
| `assigned_staff_id` | uuid FK→auth.users | who's building it |
| `commission_rate` | numeric | partner rev-share hook (nullable; the *hook*, not accounting) |
| `created_at` / `updated_at` | timestamptz | |

This is the **CRM seed** even though CRM is parked. Partner intake forms map onto this
one object (one request, many doors).

**5.2 — Named price tiers.** Today `pricing_rules` keys on `audience_type`
(3 values). Proposal — **decouple the price book from the audience**:

- New lookup `price_tiers`: `key` (`retail`/`member`/`group`/`partner`/`non_member`),
  `label`, `sort_order`, `is_active`. Seeded with the five canonical tiers.
- Add nullable `price_tier_id` (FK→price_tiers) to `pricing_rules`. Existing rows keep
  working via `audience_type`; new tier-specific rows are added without touching them.
  An `estimate_requests.source_channel` maps to a `price_tier` via a small strategy map
  (config, not a branch).

> **Decision for Taz (D1):** extend the `audience_type` enum to five values, *or* add a
> separate `price_tier` dimension (recommended — audience and price book are different
> axes: a member booking a *group* outing should be able to take group pricing). The
> table above assumes the decoupled approach.

**5.3 — Bid versioning (immutable snapshots).** Keep the live `bids` row as the *head*.
Add `bid_versions`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bid_id` | uuid FK→bids | |
| `version_no` | integer | monotonic per bid; unique (bid_id, version_no) |
| `snapshot` | jsonb | frozen line items + totals + terms exactly as the customer saw |
| `issued_at` | timestamptz | when this version was sent |
| `issued_by` | uuid FK→auth.users | |
| `accepted_at` | timestamptz | set if the customer accepted *this* version |

The negotiation loop (edit → re-issue) writes a new immutable row; the head bid points
at the current version. This formalizes what the concurrency + per-line-override PRs
already gesture at.

**5.4 — Bid → many heterogeneous line-level bookings.** This is the one structural
change to an existing relationship, so it's handled carefully and additively:

- Today: `bids.booking_id` is `UNIQUE` (1 bid → 1 booking); `bid_line_items.booking_id`
  ties each line to that single booking.
- Proposal: add nullable `bid_line_items.bid_id` (direct FK→bids) and nullable
  `bid_line_items.fulfillment_booking_id` (FK→bookings) plus a `fulfillment_type`
  (`experience` / `lodging` / `dinner` / `transport` / `custom`). A line item becomes
  the **parent**; a booking becomes its **child** when (and only when) that line needs
  scheduling. Lines that don't map to a bookable resource (a dinner, a transport fee)
  carry `fulfillment_booking_id = NULL`.
- The existing 1:1 `bids.booking_id` stays valid for today's single-booking bids — it's
  not dropped. Multi-line bids simply leave it null and use the line-level links. (A
  later cleanup PR can retire the column once all read paths use `bid_id`; out of scope
  here.)

> **Decision for Taz (D2):** introduce a distinct `estimates` table as the lead's
> document, *or* let the existing `bids` row serve as both estimate and bid (status
> pipeline already spans `pending_review → confirmed → signed → paid`). Recommendation:
> **reuse `bids`** as the document and add `estimate_request_id` (FK) so a bid traces
> back to its lead — fewer tables, and `bid_line_items` already does the heavy lifting.

**5.5 — Document-level terms.** Confirm deposit %, tax, gratuity, service fees live on
the bid/version (variable per document), not hard-coded. Add nullable columns to `bids`
(`deposit_pct`, `tax_rate`, `gratuity_rate`, `service_fee`) if not already covered by
existing deposit columns.

**5.6 — Expiry & soft-hold.** `bids.expires_at` already exists (7-day). Add
`valid_until` semantics to the estimate. **Soft-hold on referenced inventory is an open
question (Q-hold)** — flagged, not built in PR-1.

**RLS.** Staff (via `is_staff()`) full access to `estimate_requests` / `bid_versions`.
Public creates a lead through a `SECURITY DEFINER` RPC (like the existing public-booking
function) — no direct table grant. Member sees their own leads via
`created_by_person_id` through a selector function. Tokenized bid view already exists;
extend it to read the current `bid_version` snapshot.

**Reversibility.** All new tables; all new columns nullable; no existing column dropped.
Rollback = drop the new tables/columns. `bids.booking_id` semantics unchanged.

---

### PR-2 — People & participants

**Purpose.** A booking/registration covers multiple *people* who aren't account holders;
each may need a waiver. This is the prerequisite for events (PR-5) and per-participant
waivers (PR-6).

**Schema.** New `participants` (a.k.a. attendees):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid FK→people | nullable — most participants have no account |
| `booking_id` / `event_registration_id` | uuid FK | a participant attaches to a fulfillment (one set, polymorphic via two nullable FKs + check) |
| `full_name` | text | |
| `email` / `phone` | text | nullable |
| `date_of_birth` | date | for minor detection / firearm age rules |
| `guardian_participant_id` | uuid FK→participants self | minor → guardian signing |
| `created_at` | timestamptz | |

Plus on `people`: nullable `marketing_consent` + `comms_preferences` (jsonb) for
CAN-SPAM transactional-vs-marketing separation (ties to Journey 1). Dedupe/merge is a
**function + admin tool**, not a column — a `merge_people(keep, drop)` SECURITY DEFINER
RPC that re-points junctions; designed here, built with the front-desk PR (PR-9).

**RLS.** Staff full; member sees participants on their own household bookings via the
existing `current_household_*` selectors. Public participant creation rides the booking
RPC.

**Reversibility.** New table + nullable columns. Drop to roll back.

---

### PR-3 — Catalog typing & gear mapping

**Purpose.** Add-ons are not one shape (the ammo-quantity find); gear is derived, not
hand-authored per booking.

**Schema.**
- Add `add_ons.add_on_type` enum (`boolean` / `quantity` / `per_person`) + nullable
  `min_qty` / `max_qty` / `step` / `quantity_guidance` (text, e.g. "~1 box per 25
  targets"). Existing add-ons default to `boolean` — no behavior change until typed.
- New `gear_items` catalog + `service_gear` mapping (`service_id`, `gear_item_id`,
  `disposition` enum `provide`/`bring`/`rentable`). The bid's `gear_list` jsonb stays as
  the materialized output; this makes it **derivable** at confirmation instead of hand-
  authored. Reuses the existing `bid_gear_templates` authoring surface.

**RLS.** Catalog is staff-authored (existing `catalog_property_manager_writes` pattern),
public-readable for active rows.

**Reversibility.** New columns default to today's behavior; new tables droppable.

---

### PR-4 — Resources & multi-resource guard

**Purpose.** A lesson consumes two resources at once (instructor + a station/lane);
pricing gains a rate × duration mode.

**Schema.**
- New `facility_resources` (`property_id`, `name`, `kind` enum `station`/`lane`/`bay`/
  `room`, `is_active`). Later extends to lodging/F&B by adding `kind` values (Open/Closed).
- New `booking_resources` junction (`booking_id`, `facility_resource_id`) so a booking
  can reserve N resources. The **multi-resource double-booking guard** generalizes the
  existing instructor `EXCLUDE` constraint to facility resources (a tstzrange exclusion
  per resource). This is the concurrency-critical piece for front-desk vs online.
- Pricing: add `instructors.rate_per_hour` (nullable) + a `pricing_rules` mode flag
  (`flat` / `rate_x_duration` / `per_head` / `per_ticket`) so lesson pricing is
  `rate × duration`, with instructor-level override.
- Booking status lifecycle: extend `booking_status_enum` with the journey's states
  (`rescheduled`, `completed`, `no_show`) if not present, plus a policy reference
  (`reschedule_cutoff` / `cancel_fee` on the service or property).

**RLS.** Resources staff-authored; booking_resources follows booking visibility.

**Reversibility.** New tables + nullable columns + additive enum values (enum additions
are not reversible by `DROP VALUE` — noted as the one irreversible-but-harmless change;
documented per `CLAUDE.md` migration discipline).

---

### PR-5 — Events & ticket tiers

**Purpose.** Public ticketed events are a different inventory shape from the existing
member-only `member_adventures`: capacity, roster, and *one ticket ≠ one seat*.

**Schema.**
- New `events` (dated instance: `property_id`, `name`, `event_date`, `capacity`,
  `roster` semantics, per-event refund/transfer policy). Distinct from
  `member_adventures` (member-only) — or, **Decision for Taz (D3):** generalize
  `member_adventures` to cover public events with an `audience` flag rather than a
  second table. Recommendation: evaluate reuse first; the adventures capacity trigger +
  waitlist already exist.
- New `event_ticket_types` (`event_id`, `label`, `price`, `qty_available`,
  `capacity_weight` — a team-of-4 decrements capacity by 4).
- Registrations reference an `attendees[]` collection (PR-2 participants); waiver is
  per-attendee (PR-6).
- Time-based pricing (early-bird) → `effective_from`/`effective_until` on ticket types.
- Waitlist with promote-on-cancellation reuses the adventures waitlist pattern.

**Capacity enforcement** is a DB trigger with `FOR UPDATE` row lock (the adventures
pattern), weighted by `capacity_weight` — oversell prevention at the database, like
double-booking.

**RLS.** Public-readable events; staff-authored; registration via RPC.

**Reversibility.** New tables; adventures untouched if D3 = separate table.

---

### PR-6 — Waivers: per-participant + validity window

**Purpose.** Close the ESIGN gap to a *participant*, add reuse windows and guardian
signing. The audit set already exists on `waiver_documents`; this points it at a person.

**Schema.**
- Add nullable `waiver_documents.participant_id` (FK→participants) so a signed record
  links participant ↔ template version ↔ booking/event.
- Add `valid_from` / `valid_until` to `waiver_documents` for the reuse window;
  confirmation checks for an existing valid waiver before re-requesting (big UX + DB
  find). A `current_valid_waiver(participant, property, activity)` selector function.
- Minor → guardian: signing flow reads `participants.date_of_birth` +
  `guardian_participant_id`; firearm activities may carry an age rule on the service.
- Activity/firearm distinction: a `waiver_templates.activity_kind` (`general`/`firearm`)
  so the right template is chosen.

**RLS.** Existing waiver grants are already locked down
(`lock_down_record_bid_signature_grants`); extend the same SECURITY DEFINER write path
to carry `participant_id`.

**Reversibility.** New nullable columns + one selector function. Droppable.

---

### PR-7 — Notifications generalization

**Purpose.** Templates + triggers + audience + channel + delivery log over the existing
Inngest runner — so reminders/nudges/follow-ups aren't one-off jobs.

**Schema.**
- `notification_templates` (`key`, `trigger` event-driven or scheduled T-minus,
  `audience` `guest`/`staff`/`instructor`, `channel` `email`(now)/`sms`(TBD), body).
- `notification_deliveries` log (`template_key`, `to`, `status` sent/failed,
  `provider_message_id`, `sent_at`) over Resend. The Inngest runner already exists; this
  gives it a data-driven catalog instead of hard-coded jobs.
- Transactional vs marketing separation reads `people.comms_preferences` (PR-2).

**Decision for Taz (D4):** SMS at launch or email-only? Affects the channel model and
runner — flagged, designed to accommodate SMS without forcing it.

**Reversibility.** New tables; existing reminders keep working until migrated onto the
catalog.

---

### PR-8 — Payment rails

**Purpose.** In-person payment is a different rail; house accounts imply an AR hook.

**Schema.**
- `payment_method_type` enum (`online_checkout` / `terminal` / `cash` / `house_account`)
  on a new `payments` ledger (or as columns on existing payment records) so each capture
  records its rail for reconciliation across channels.
- House-account / AR **hook only** (a `charge_to_house` line + an `account_balance`
  concept) — even though accounting is parked, the hook must exist now (straddles the
  architecture boundary; flagged).

**Decision for Taz (D5):** are booking and accounting **separate apps/DBs**? The
house-account/AR and partner-commission hooks straddle that line — this is the
architecture-roadmap call that gates how deep PR-8 goes.

**Reversibility.** New table/columns; Stripe online path unchanged.

---

### PR-9 — Access/ops & front-desk

**Purpose.** Staff act on behalf of guests; kiosk session; audit completeness.

**Schema / policy.**
- Extend staff-acting-on-behalf RLS (already seeded by `bookings.created_by_admin_id`)
  to `estimate_requests`, `bid_versions`, and event registrations — a staff role can
  transact *for* others, scoped to staff.
- Kiosk/shared-device session model (auto-logout, optional staff PIN re-auth) — an app +
  session concern, schema-light (a `kiosk_sessions` table if we track device handoff).
- `merge_people` dedupe RPC (designed in PR-2) ships here with the front-desk surface.
- Audit/`created_by` completeness pass across the new tables.

**Reversibility.** Policy additions + optional session table.

---

## 6. Decisions Taz needs to make before PR-1

These gate the *shape* of the first migration and should be answered before any SQL:

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Five-value `audience_type` enum **vs** a decoupled `price_tier` dimension | **Decouple** — audience and price book are different axes. |
| **D2** | Distinct `estimates` table **vs** reuse `bids` as the estimate document | **Reuse `bids`** + `estimate_request_id` FK; `bid_line_items` already carries the breakdown. |
| **D3** | New `events` table **vs** generalize `member_adventures` for public events | Evaluate reuse first; adventures already have capacity + waitlist. *(gates PR-5, not PR-1)* |
| **D4** | SMS at launch **vs** email-only | Design channel-agnostic; default email-only unless Taz wants SMS. *(gates PR-7)* |
| **D5** | Booking and accounting **separate apps/DBs?** | Architecture-roadmap call; house-account/commission hooks straddle it. *(gates PR-8)* |

Plus the standing cross-cutting questions from the build list: **inventory soft-hold
while a bid is outstanding (Q-hold)?**, **lesson packages/credits at launch?**,
**partner portal/login?**, **Stripe Terminal at launch?** — none block PR-1.

---

## 7. What PR-1 will contain (the concrete first cut, once blessed)

A single additive migration plus the matching admin surface, scoped to the estimating
engine core:

1. `estimate_requests` table + `estimate_channel` / `estimate_status` enums + RLS +
   a public `create_estimate_request` SECURITY DEFINER RPC.
2. `price_tiers` lookup (seeded with five tiers) + nullable `pricing_rules.price_tier_id`
   + the channel→tier strategy map (config).
3. `bid_versions` table (immutable snapshots) + RLS.
4. `bid_line_items.bid_id` + `.fulfillment_booking_id` + `.fulfillment_type` (all
   nullable, additive); `bids.estimate_request_id` FK.
5. Document-level term columns on `bids` if not already covered.
6. An admin screen to view a lead, build line items against a price tier, and issue a
   versioned bid — reusing the existing override-bidder and `bid_line_items` UI.

**Verification gate (per the kickoff) before the PR opens:** `npm run typecheck`, lint,
and tests pass; `npx supabase db reset` applies cleanly against the *local* stack
(never a shared DB); `npm run dev` at `http://localhost:3000` still loads; the migration
is additive and reversible; the PR body lists what changed, why, the rollback, and open
questions for Taz.

---

## 8. Open questions rolled up for Taz

- **D1–D5** above (shape-gating).
- **Q-hold:** does an outstanding bid place a soft-hold on referenced inventory?
- The accounting boundary (commission + AR) — separate domain or same DB? (D5).
- Whether to retire `bids.booking_id` once multi-line read paths exist (a later cleanup,
  not this plan).

Nothing here is built until the shape is blessed. This document is the proposal.

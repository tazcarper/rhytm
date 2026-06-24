# Plan: make `/request-estimate` produce real bids by reusing the `/book` backend

**Status:** Proposed (planning only — no code yet)
**Date:** 2026-06-23
**Owner:** developer
**Related:** `plan/booking-disciplines-redesign.md`, `plan/manual-pricing-optimistic-concurrency.md`

---

## 1. Goal

The client built `/request-estimate` as a **single-page** intake form because they prefer it
to the multi-step `/book` funnel. We want to keep that single-page UX but stop it from being a
parallel, hand-rolled system. On submit it should behave like `/book` does today: the guest
lands on a **unique bid URL** ("your bid is being prepared"), staff see the request in the
**existing `/admin/bids` dashboard**, and when staff confirm it, the same URL flips to a
**confirmed view with event details**.

The whole point is **reuse, not rewrite**: route the form into the booking/bid backend that
already exists, retire the duplicated **lead** path, and source **catalog** structure from the DB.
(`rules.ts` is *kept* — it stays the pricing calculator for this route, §8 — so "delete duplication"
applies to the lead queue and the hand-typed catalog, not the pricing math.)

**Out of scope for this route:** payments (no deposit/Stripe) and waiver (no e-sign). The bid
this form creates is **quote-only**.

---

## 2. What's actually different today (the core finding)

The two routes are *not* "the same fields, slightly different." They produce **different
artifacts** from **different sources of truth**:

| | `/book` funnel | `/request-estimate` form (today) |
|---|---|---|
| On submit | `createPublicBooking()` → **Booking + Bid** | `create_estimate_request()` → **lead row** |
| Lands in | `/admin/bids` (staff confirm/modify) | `/admin/estimates` (manual triage, manual bid build later) |
| Guest gets | Unique bid page `/bids/{slug}/{code}` | A "thanks, we got it" screen, no URL |
| Slot | Commits a real `time_slot`, runs availability/capacity triggers | "Preferred date" + arrival hour only — no commitment |
| Pricing | **DB pricing models** (`src/services/public/pricing.ts`) | **Hardcoded `rules.ts`** — re-types every ladder by hand |
| Disciplines/add-ons | DB catalog (`getPublicServicesForProperty`) | Hardcoded `RULES.experiences` / `RULES.addons` |

Two consequences worth stating plainly:

1. **Price drift is real.** `src/components/public/estimate-intake/rules.ts` hand-codes guest-fee
   ladders, lesson math, and the add-on catalog. The same numbers live in the DB and feed
   `/book`. They can (and will) disagree.
2. **The lead queue is a dead-end relative to the goal.** The client's `estimate_requests` table
   + `/admin/estimates` queue requires staff to *manually* re-build a bid. The user wants the
   form to feed the bid pipeline directly.

---

## 3. Decisions locked (from review with the user)

> **Context that shapes all of these:** `/book` (the multi-step public funnel) is being
> **retired** — the estimate form becomes the *sole* booking front door. `createPublicBooking()`
> and the `create_public_booking` RPC have exactly one caller today
> (`app/(public)/book/[property]/submit/action.ts:61`); once `/book` is hidden they are the
> estimate path's private primitive, with no second consumer to protect. That collapses the
> "don't edit the shared path" constraint the earlier draft worked around, and makes several
> changes below simpler and safer (notably §6 and §8).

1. **Submit creates a real Booking + quote-only Bid** via `createPublicBooking()`. Guest gets
   `/bids/{slug}/{code}` in `pending_review` ("being prepared"). Staff confirm in `/admin/bids`;
   the URL then shows the confirmed event details. **No payment, no waiver** — waivers are
   *entirely out* this phase (see decision 8); they return later behind a flag.
2. **Every entry is treated as a public visit:** `booking_type = plan_a_visit`,
   `instructor_id = null`. **No instructors this version** — lessons are still *priced*
   (tax-exempt, via `computeEstimate`) but no instructor is assigned or scheduled. This sidesteps
   instructor requirements entirely (the RPC's instructor logic only fires for `private_lesson`).
3. **Soft request — provisional slot, enforcement gated by status (not a bypass flag).** Submit
   must **never bounce the guest** on availability. We provide a *provisional* slot from the
   form's preferred-date + arrival, and the availability/capacity triggers **skip while the
   booking is `pending_review`**. They re-run automatically when staff lock the booking to
   `confirmed` (the triggers are `BEFORE UPDATE`), so a real double-book is still caught at lock
   time. This replaces the earlier `bypass_availability_checks` column (see §6 for why status
   gating is both simpler and safe now that `/book` is gone).
4. **Staff lock the real slot at confirm — this is new work, not reuse.** `confirmBid()` today
   only flips `bids.status`; no admin path edits `bookings.start_time`. We **build** a
   lock/reschedule action (§7/§10-D) that sets the real slot, flips to `confirmed`, and lets the
   (status-gated) triggers enforce no-double-book. Until that lock happens a confirmed bid must
   never sit on an unenforced slot.
5. **Host membership is taken on trust; admin verifies on the dashboard.** The form can't verify
   membership and shouldn't try, so the **HSB members-only gate (`isHsbBlocked`) is dropped** for
   this route. The member/nonmember "host" toggle no longer gates anything — a member-hosted
   request gets full member pricing in the indicative quote (decision 7), and the host intent is
   written to `staff_notes` with a "verify membership" flag for the admin to confirm.
6. **Supersede the estimates queue.** New submissions create bids and show in `/admin/bids`.
   Retire writes to `estimate_requests` and hide `/admin/estimates` so staff have one workspace.
7. **Pricing is computed on the page by `rules.ts`, then carried onto the bid.** The DB
   `pricing_rules` rows are **placeholders** (per the user) and are **ignored** for this route.
   `src/components/public/estimate-intake/rules.ts` (`computeEstimate()`) is the authority and runs
   client-side, exactly as it does now. At submit we pass the computed **total** (→ `estimated_price`)
   and **line breakdown** into bid creation, so the quote the guest saw becomes staff's starting
   draft. **Discounts are NOT carried** — staff apply discounts only through the admin dashboard's
   audited override path, which already surfaces the discount on the guest's bid URL (see §8).
   This needs **no DB pricing model** and sidesteps the cohort-ladder representation gap (see §8).
   The non-pricing rules (RSO/escalation/heat/Private-Event) move to a shared module so the
   bid/admin can show the same flags.
8. **Waivers are out this phase.** Suppress the bid page's signature slot for these bids and treat
   a no-deposit/no-waiver confirmed bid as fully "set" (see §8a). Catering is **just an add-on**
   (folds into `booking_add_ons`, no special-casing). **Staff custom lines** are *not* structured
   bid lines — there is no "add line" UI and we don't build one; staff use the total-override +
   note path instead.

---

## 4. Target architecture

```
Guest → /request-estimate[/club]   (single page, unchanged UX, DB-sourced data)
  ↓ submit
submitEstimateAction  (rewritten: validate → map → createPublicBooking with explicit lines)
  ↓
createPublicBooking()  (EDITED — now single-caller; accepts explicit lineItems)
  • booking_type = plan_a_visit, instructor_id = null
  • provisional slot from preferred date + arrival
  • inserts at status = pending_review  → triggers skip enforcement (status-gated)
  • carries computeEstimate() lines straight onto bid_line_items (skips materialize)
  ↓
Booking (pending_review) + Bid (pending_review) at /bids/{slug}/{code}
  ↓ guest sees "your bid is being prepared" (REUSED banner) + time tagged "pending" (bid-page edit, §8a)
  ↓
Staff open it in /admin/bids  (REUSED dashboard) + lock action (NEW)
  • lock the real slot (sets start_time, advances bookings.status → awaiting_guest → triggers enforce no-double-book)
  • adjust total + apply discounts via the dashboard override path (audited), confirm (bids.status → confirmed)
  ↓ confirmBid()  (REUSED — paired with the new lock action)
Bid → confirmed → /bids/{slug}/{code} shows event details, no waiver/deposit  (EDITED page)
```

The work concentrates in: (a) the form's data source, (b) the submit action's mapping,
(c) status-gated triggers + a `lineItems` param on `createPublicBooking`, (d) a new admin
slot-lock action, and (e) bid-page edits (suppress waiver, "pending" time tag).

### Parity requirement: submit must produce the same artifact `/book` does

A submit must yield **exactly the `/book` result**, because it calls the **same**
`createPublicBooking()` — one transaction producing:
- a **Booking** row (`pending_review`) + a **Bid** row (`pending_review`),
- a one-time **access code** and a **unique URL** `/bids/{slug}/{code}` the guest is redirected to,
- materialized **bid_line_items** (here: the carried `computeEstimate()` lines, §8),
- snapshotted **FAQ + gear** from the content library (the RPC's `resolve_bid_content`),
- the **`bid/created` Inngest event** → guest "we're preparing your bid" email + staff "new request"
  notification (§5).

The guest lands on the same **"your bid is being prepared"** pending-review page with the same
guest/party/schedule summary the `/book` funnel produces — the only intentional differences are:
provisional time tagged **"pending"** (§8a), no instructor, and no waiver/deposit slots (§8a).

---

## 5. Reuse map — what we keep, build, retire

### Reuse as-is (no changes)
- **Emails (all built, fire off existing Inngest events):** `bid/created` →
  `send-bid-confirmation-email` (guest: *"We're preparing your bid…"*) **and**
  `send-new-bid-staff-notification` (staff inbox: *"New booking request — needs review"* +
  `/admin/bids/{id}` link); `bid/confirmed` → `send-bid-confirmed-email` (guest: *"Your bid is
  confirmed…"*, auto-selects the **no-deposit** template for quote-only). `createPublicBooking`
  already emits `bid/created`; `confirmBid` already emits `bid/confirmed`. No email work in this plan.
- `getBidDetail()` / access-code verification — `src/services/bids/get-bid.ts`
- `/admin/bids` dashboard + `confirmBid()` — `src/services/admin/transition-bid.ts`
  (`confirmBid` flips `bids.status` only; it is *paired with* the new lock action below)
- `getPublicServicesForProperty()` / `getPublicPropertyBySlug()` — catalog + property lookup (for UUIDs)
- `computeEstimate()` in `rules.ts` — **kept as the pricing authority** (computed on the page, §8)

### Not used by this route (left intact)
- `getPublicPricingForProperty()` / `buildBookingSummary()` / `materializeBidLineItems()` — DB
  pricing is ignored; we insert `computeEstimate()` lines directly (§8). These stay in the tree but
  this route never calls them.

### Build / change
- **Status-gated triggers** (§6) — the DB change. No new column; edit two trigger bodies.
- **Edit `createPublicBooking()`** (`src/services/bookings/create-public-booking.ts`) — now
  single-caller, so add an optional `lineItems` input; when present, **skip `materializeBidLineItems()`**
  and insert those lines onto `bid_line_items` directly. The default path (no `lineItems`) is
  unchanged, so the about-to-be-hidden `/book` caller still behaves as today.
- **Rewrite `submitEstimateAction`** (`app/(public)/request-estimate/submit/action.ts`) to map the
  form payload to `PublicBookingInput` + carried lines and call `createPublicBooking()`, returning
  `{ ok, bidPath }` so the page redirects to the bid URL.
- **NEW admin slot-lock/reschedule action** (§7/§10-D) — sets `bookings.start_time`/`duration_hours`,
  flips status to `confirmed`, lets the status-gated triggers enforce no-double-book.
- **Edit the public bid page** (`app/(public)/bids/[slug]/[code]/page.tsx`) — suppress the signature
  slot, treat no-deposit/no-waiver bids as "set" on confirm, tag the `pending_review` time "pending"
  (§8a). *(Previously mis-listed as reuse-as-is.)*
- **Resolve catalog UUIDs** (`estimate-intake.tsx`): use `getPublicServicesForProperty()` to map
  experiences/add-ons to real DB rows for `booking_disciplines` / `booking_add_ons` (prices ignored).
  See §8 for the real modeling this needs (it is more than a lookup).
- **Sticky right column** on the form — see §9 for the exact scroll behavior.
- **Success behavior:** instead of an inline "thanks" screen, redirect to `/bids/{slug}/{code}`.
- **Catering** modeled as an add-on. **Staff custom lines are not carried** — total-override + note
  only (decision 8); there is no "add line" UI and we don't build one.

### Retire
- **Hide `/book`** (the multi-step public funnel): pull its nav + middleware route entries so no one
  reaches it. **Keep** the funnel code, `createPublicBooking()`, and the RPC in place — the estimate
  path reuses the primitive. Delete the funnel pages / `BookingFlowProvider` / components in a later
  cleanup (own task, §12).
- Writes to `estimate_requests` via `create_estimate_request()` and the `/admin/estimates` queue
  (hide the nav entry; keep the table/migrations in place for now so nothing breaks — remove in a
  later cleanup once confirmed unused).
- **Not** `rules.ts` — its pricing math stays (the authority); only the advisory rules relocate to a
  shared module (§8).

---

## 6. The backend change: status-gated availability triggers

**Why it's needed.** Availability/capacity enforcement is **not** in the RPC body — it lives in
triggers on `bookings`, so *any* insert/update runs them
(`supabase/migrations/20260517225304_phase_2_booking_system.sql`):
- `bookings_02_validate_start_time` (`BEFORE INSERT OR UPDATE OF start_time`) →
  `validate_booking_start_time()` — slot must exist in `time_slots` (raises `P0001`, lines 180–182)
- `bookings_03_check_property_capacity` (`BEFORE INSERT OR UPDATE`) → `check_property_capacity()` —
  sums `capacity_reserved` across concurrent bookings (raises `P0001`, lines 190–224)
- (`no_instructor_overlap` EXCLUDE + the private-lesson instructor CHECK — **not hit** here because
  every booking is `plan_a_visit` with `instructor_id = NULL`)

A submit must never bounce the guest, so these two checks must not fire at intake. But they
**must** fire when staff later lock a real slot (§7), or the double-booking guarantee is lost.

**Why status gating, not a bypass column.** The earlier draft added a persistent
`bypass_availability_checks` boolean. That has a real hole: the column stays `true` for the row's
life, and because the triggers also run on the later `UPDATE OF start_time`, a `true` flag would
make the **slot-lock skip enforcement too** — exactly when we need it. It would also need clearing
logic the plan never specified. Gating on **status** avoids all of that, and is safe *now* because
`/book` is retired: `pending_review` no longer has a second meaning (a held `/book` slot), so
"skip enforcement while `pending_review`" can't weaken any other flow.

**Also note:** `bookings.start_time`, `duration_hours`, `end_time` are **NOT NULL**, so we still
supply a **provisional slot** (preferred date + arrival hour → `start_time`; booking-type default
→ `duration_hours`). We skip the *enforcement*, not the slot.

**Implementation (one migration, two trigger-body edits, no new column, no RPC signature change):**
1. `validate_booking_start_time()` — add at the top: `IF NEW.status = 'pending_review' THEN RETURN NEW; END IF;`
   (a provisional slot need not exist in `time_slots`).
2. `check_property_capacity()` — (a) add the same `pending_review` early-return, AND (b) exclude
   `pending_review` from the concurrency SUM: `... AND status NOT IN ('cancelled','expired','denied','pending_review')`.
   Both are needed: (a) lets the soft row in; (b) stops a pile of unconfirmed requests from blocking
   a *later* staff lock at the same time.
3. On the slot-lock UPDATE (§7), staff set `start_time` **and** advance **`bookings.status`** off
   `pending_review` → **`awaiting_guest`** in the same statement → both triggers now run and enforce
   against other live (non-released) bookings. No flag to clear.

> **Booking status vs bid status — they are different fields, and this is load-bearing.** The
> capacity/slot triggers read **`bookings.status`** (enum: `pending_review / awaiting_guest /
> denied / signed / deposit_paid / fulfilled / cancelled / expired` — there is **no `confirmed`**).
> `confirmBid()` only updates **`bids.status`** → `confirmed`; it never touches the booking. So the
> lock action **must** move `bookings.status` to `awaiting_guest` itself — that is the only thing
> that makes enforcement fire. If the booking were left at `pending_review`, the gated triggers
> would never run for it and there'd be no double-book protection. (`awaiting_guest` is also what
> the capacity SUM counts, so the locked slot correctly holds capacity against later bookings.)

**RLS / migration rules:** new migration; this is trigger-body edits only — **no new policy, no
cycle** (CLAUDE.md rule 5 satisfied). Manual tests against the live DB (CLAUDE.md rule 6):
- a `pending_review` insert at an arbitrary/taken time **succeeds** (no enforcement);
- locking a `pending_review` booking (→ `awaiting_guest`) onto a slot already held by an
  `awaiting_guest` booking **is rejected**;
- two `pending_review` rows at the same time do **not** block a later lock at that time.

---

## 7. Field mapping: form → booking/bid

| Form field (`estimate-intake`) | Maps to | Notes |
|---|---|---|
| `propertySlug` | `propertyId` | via `getPublicPropertyBySlug()` |
| `host` (member/nonmember) | `staff_notes` (intent + "verify membership") | **Does not gate** anything (HSB gate dropped, decision 5). Drives member *pricing* in the indicative quote on trust; admin verifies membership on the dashboard. `audience_type` left at default `public`. |
| `experiences[]` | `disciplineIds[]` (`booking_disciplines`) | Mapped from the `rules.ts` string ids to real `services.id` UUIDs (§8 — needs catalog rows). All `plan_a_visit`; lesson included but no instructor (decision 2). |
| `addons` (ammo qty, gear qty, cart) | `addOns[]` (`booking_add_ons`) | Real add-on UUIDs + quantities for structure; the **priced** lines come from `computeEstimate()` carried directly onto `bid_line_items` (§8) |
| `catering` | an **add-on** | Modeled as an add-on, not a section; priced via the estimate; needs a `services` + `service_add_ons` row per property (§8) |
| `members` + `guestAdults` + `guestJuniors` | `guestCount` (+ `juniorGuestCount`) | `guestCount` = total heads; `juniorGuestCount` = juniors. Member pricing applies when host = member (on trust) |
| `lessonHours` | *(pricing only — NOT `durationHours`)* | **Corrected in Phase B:** `plan_a_visit`'s DB CHECK (`duration_valid_for_type`) pins `duration_hours` to **exactly 2**, so we can't write `lessonHours` there. `durationHours` is always `2`; the chosen lesson length flows only into the carried price line (consistent with decision 2 — lessons priced, not scheduled). |
| `preferredDate` + `arrival` | `date` + `slotStart` (**provisional**) | Satisfies NOT-NULL slot columns; not enforced while `pending_review` (§6). Shown to the guest tagged "pending" (§8a) |
| `backupDate` | `staff_notes` / `schedule_notes` | No native field; staff use it when locking the slot |
| `name` / `email` / `phone` | `guest.{name,email,phone}` | |
| `notes` | `guest_notes` | |
| `customLines[]` (staff) | — (not carried) | No structured-line path; staff use total-override + note instead (decision 8) |
| `computeEstimate().total` | `estimatedPrice` | The page's computed total (§8). `computeEstimate().lines` **minus discount lines** become the bid's initial `bid_line_items` |
| `staffMode` / `staffRepName` | `createdByAdminId` / attribution | Staff-attribution pattern, stamped after the RPC insert (`create-public-booking.ts:149`) |

> **Phase B finding — `bookings` has NO `staff_notes`/`schedule_notes` column (verified against the live schema).** The mapping rows above that target `staff_notes`/`schedule_notes` (host intent + "verify membership", `backupDate`) therefore have **no destination yet**, and `guest_notes` can't substitute — it is **rendered to the guest** on the bid page (`bids/[slug]/[code]/page.tsx:357`), so staff-facing text there would leak. Phase B persists **only the guest's own note** to `guest_notes` and **defers** host-intent/verify-membership, the backup date, staff internal notes, and the §8 advisory flags. **Phase C must add the `staff_notes` (and `schedule_notes`) column via migration** and carry those fields there. The form still collects them (backup date, internal notes, staff rep) — they ride on the payload but aren't stored until that column exists.

### The slot-lock action (NEW — confirm-time)

`confirmBid()` (`src/services/admin/transition-bid.ts:28`) only flips `bids.status`; **no admin
path edits `bookings.start_time` today** (verified — the bid editor at `edit/actions.ts` is
pricing + content only). So locking the real slot is new work, not reuse:

- A new admin action (service-role or admin-RLS write) sets `bookings.start_time` /
  `duration_hours` to the slot staff actually commit, **and** advances **`bookings.status`**
  `pending_review` → **`awaiting_guest`** in the same update so the §6 triggers run and enforce
  no-double-book. (Booking status, *not* bid status — see the §6 callout.)
  - **Trigger-firing gotcha (verified in Phase A):** `bookings_02_validate_start_time` is bound
    `BEFORE INSERT OR UPDATE **OF start_time**` — on UPDATE it only fires when `start_time` is in
    the SET list. So the lock action **must write `start_time`** (the real committed slot) for slot
    validation to run; a status-only update would skip it. The capacity trigger
    (`bookings_03_check_property_capacity`, bound `BEFORE INSERT OR UPDATE` with no column list)
    runs on any update, but it returns early while `status = 'pending_review'`, so it too only
    enforces once this same update advances status to `awaiting_guest`. Net: set `start_time` **and**
    `status` together in one UPDATE — which is already the design above — and both checks arm.
- It surfaces the trigger rejections the same way `createPublicBooking` already maps them
  (`create-public-booking.ts:295` — `P0001` capacity/start-time, `23P01` exclusion) so staff get
  "that slot's taken" instead of a raw error.
- Pair it with `confirmBid` (which flips **`bids.status`** → `confirmed`): lock the booking, then
  confirm the bid, so a confirmed bid never sits on an unenforced slot. Decide the ordering/coupling
  during Phase D (one combined action vs. lock-then-confirm) — the invariant is *lock before/with
  confirm*.
- The guest's bid URL then shows the locked time **without** the "pending" tag (§8a).

---

## 8. Pricing: compute on the page, carry onto the bid

**Authority = `rules.ts`, computed client-side.** The DB `pricing_rules` rows are placeholders and
are **ignored** for this route. `computeEstimate()` in
`src/components/public/estimate-intake/rules.ts` stays exactly where it is and remains the source of
truth for the indicative quote — guest-fee ladders, the lesson cohort ladder, class rates, add-on
prices, member discount, all of it. We do **not** try to make the DB pricing models reproduce this
math (they can't represent the cohort ladder anyway), and we do **not** seed `pricing_rules`.

**How the quote reaches the bid.** `computeEstimate()` already returns both a `total` and an
itemized `lines[]` (each `{ label, amount, exempt?, tbd?, negative? }`). At submit we:
1. Pass `total` as the booking's `estimatedPrice`.
2. **Carry `lines[]` onto the bid as its `bid_line_items`** — *excluding any `negative` (discount)
   line* — so the breakdown the guest saw becomes the bid's starting draft.

**Implementation — pass explicit lines into `createPublicBooking()` (now that it's single-caller).**
The earlier draft proposed letting `createPublicBooking()` materialize from DB placeholder pricing
and then *overriding* the result. That is unnecessary churn **and** actively wrong here:
`materializeBidLineItems()` would derive nonsense from placeholder pricing, and the creation hook
warns on every call when `lineSubtotal != estimated_price` (`create-public-booking.ts:172-186`) —
which this route would trip on **every** submit. Since `/book` is retired and
`createPublicBooking()` has one caller, we instead:
- Add an optional `lineItems` input to `createPublicBooking()`. When present, **skip
  `materializeBidLineItems()` entirely** and insert those lines onto `bid_line_items`.
- Map metadata the model supports: `exempt → tax_status='exempt'` (preserves the lesson line's
  exemption — `rules.ts:319`), `tbd`/"Custom" → a `line_amount = 0` line. `kind` falls to
  `other`/`fee` where there's no exact match (the model has no discount kind by design — discounts
  live in the override path, decision 7).
- The default path (`lineItems` omitted) is untouched, so the about-to-be-hidden `/book` caller
  behaves exactly as today (no Liskov break).

**Discounts are not part of this carry.** Per decision 7, staff apply discounts only through the
admin dashboard's **audited** override path (`bid_line_overrides` + `bid_pricing_events`,
migration `20260617120000`), which `get-bid` already renders on the guest's bid URL arithmetically.
The form's staff-mode discount stays a preview-only number; it never becomes a bid line.

**The catalog still comes from the DB — for structure, not price (and this is real modeling, not a
lookup).** We need real `services.id` / add-on UUIDs to populate `booking_disciplines` /
`booking_add_ons` (so staff see a structured booking), prices irrelevant. But the DB enforces shape:
- `booking_disciplines.service_id` is an FK to `services` — every `rules.ts` experience id
  (`clays/pistol/lesson/class/event/facility`) needs a matching `services` row per property.
- `booking_add_ons` requires the add-on to be **valid for that service** (the RPC joins/validates;
  an invalid combo raises FK `23503`, mapped at `create-public-booking.ts:389`). So
  `ammo/gear/cart` **and catering** each need an `add_ons` row **plus** a `service_add_ons` link
  row per property.
- Note several "experiences" aren't disciplines in the `/book` sense (`class`, `event`, `facility`).
  For v1 they still attach as `booking_disciplines` rows under `plan_a_visit` purely for structure.

Audit existing catalog rows first; seed only what's missing (catalog rows ≠ pricing rows). **If a
clean service/add-on mapping can't be produced for an item, omit it from `disciplineIds`/`addOns`
rather than risk an FK failure** — the priced line still rides on `bid_line_items` regardless.

### Non-pricing rules & advisories — port to a shared module (keep verbatim)
These aren't prices and must not be lost when logic moves out of the component. Extract them from
`rules.ts` into a small reusable module (e.g. `src/services/public/booking-advisories.ts`) so the
form **and** the bid/admin can call the same logic:
- **RSO ratio:** 1 RSO per 5 guests (guests only, members excluded)
- **Instructor escalation:** Senior Instructor at 15+ guests; two Senior Instructors at 20+
- **Private Event threshold:** 9+ total heads ⇒ "Private Event," 72-hr advance notice (a flag, not a price)
- **Summer heat advisory:** May–Sep with 12 PM / 1 PM arrival ⇒ show warning

Carry the resulting flags into `staff_notes` / `schedule_notes` at submit so staff see the same
escalation the guest saw.

### Gating rules
- **PSP "Coming Soon"** (`isComingSoon`) — keep; PSP still shows no experiences / no pricing.
- **HSB members-only (`isHsbBlocked`) — DROP for this route** (decision 5). Membership can't be
  verified on the form, so a non-member host at HSB is no longer blocked; they get a normal
  estimate, and the admin verifies membership on the dashboard. The member/nonmember toggle remains
  only as (a) a member-pricing input on trust and (b) a `staff_notes` flag.

### Light parity check (not a big matrix)
Because the bid lines **are** the `computeEstimate()` lines by construction, display parity is
automatic — no need to prove a DB recomputation matches. The only checks worth writing: (a) the
total carried to `estimatedPrice` equals the displayed total (discount excluded, so the carried
line-subtotal is the *pre-discount* total), and (b) the advisory module returns the same flags the
component did before extraction. Keep `computeEstimate()` as the single calculator.

---

## 8a. Bid-page edits — no waiver, "pending" time

The public bid page (`app/(public)/bids/[slug]/[code]/page.tsx`) is **edited**, not reused as-is:

- **Suppress the signature slot.** `isActiveBid` currently renders `SignatureSlot` for every active
  bid (`:125`, `:557`), and since these bids have no deposit it reads "Last step — sign your waiver
  to finalize." Waivers are out this phase (decision 8): don't render the slot for these bids.
  Gate it on a per-bid signal (e.g. an `estimate`-origin marker or the absence of a required
  waiver) so existing/historical bids are unaffected.
- **Treat no-deposit/no-waiver as "set" on confirm.** `StatusBanner`'s `finalized` logic
  (`:293-296`) only reaches the celebratory "you're all set" state once `signed`. With no waiver,
  a `confirmed` bid must read as fully set on its own (confirmed event details, nothing left to do).
- **"Pending" time tag.** `BidHero` always prints `{date} · {start}–{end} CT` (`:223`). While the
  bid is `pending_review` (provisional slot), append a **"pending"** tag so the guest sees the time
  they picked isn't locked. The tag drops once the slot is locked/confirmed (§7).

These are presentation/branch edits — no schema change. They can land with Phase D.

---

## 9. Right-column sticky behavior (form UX)

On the single-page form, the **right column** (the live estimate / summary rail) should stay in
view while the user scrolls the longer left-hand form, then settle back into its original spot at
the top.

**Desired behavior:**
- At the top of the page, the right column sits in its **natural position** (in normal flow,
  aligned with the top of the form).
- As the user scrolls **down**, once the column's top would scroll off, it **sticks** and stays
  pinned (with a small top offset / gutter) so the estimate is always visible.
- As the user scrolls **back up** to the top, it **unpins and locks back into its original
  position** — no jump or overlap with the header.
- If the column is taller than the viewport, it should still allow its own overflow to be reached
  (don't trap content above the fold).

**Implementation note:** prefer pure CSS `position: sticky; top: <offset>` on the right column
(with the grid/flex parent tall enough to allow the slide). That gives the "pin on scroll-down,
release at original position on scroll-up" behavior for free, no scroll-listener JS. Only reach for
a JS scroll handler if a design detail (e.g. a hard stop at the footer) needs it. Respect the
existing layout breakpoints — on narrow/mobile widths the column stacks and sticky is disabled.
This is presentation-only and can ship independently of the backend/pricing work.

---

## 10. Phased implementation

**Phase A — Status-gated triggers** (smallest, unblocks everything) — see §6
- One migration: add the `status = 'pending_review'` early-return to `validate_booking_start_time()`
  and `check_property_capacity()`, and exclude `pending_review` from the capacity SUM. **No new
  column, no RPC signature change.**
- Manual DB tests (CLAUDE.md rule 6): `pending_review` insert at a taken time succeeds; locking a
  `pending_review` row (→ `awaiting_guest`) onto an `awaiting_guest`-held slot is rejected; two
  `pending_review` rows don't block a later lock.

**Phase B — `createPublicBooking` lineItems + submit rewrite** (see §8) — ✅ DONE
- Add the optional `lineItems` input to `createPublicBooking()`; when present, skip
  `materializeBidLineItems()` and insert those lines. Default path unchanged for `/book`.
- Rewrite `submitEstimateAction` to map payload → `PublicBookingInput` + carried lines (§7), insert
  at `pending_review`, return `{ ok, bidPath }`. Keep honeypot + rate-limit. Drop the
  `create_estimate_request` call. On success redirect to `/bids/{slug}/{code}`.
- *Two corrections found in build, both recorded above:* `durationHours` is always `2` (not
  `lessonHours`) per the `plan_a_visit` CHECK; and `staff_notes`/`schedule_notes` don't exist yet so
  host-intent/backup-date/internal-notes/advisories are **deferred to Phase C** (only the guest's own
  note is persisted, since `guest_notes` is guest-visible).

**Phase C — Catalog wiring + advisories** (see §8) — ✅ DONE
- **Add the `staff_notes` / `schedule_notes` column(s) to `bookings`** (migration) — the destination
  for the deferred Phase B fields. Then carry into them: host intent + "verify membership", the
  backup date, staff internal/phone notes, and the advisory flags below. *(Done: migration
  `20260623235211_estimate_booking_staff_notes.sql`; both columns are staff-only — excluded from the
  get-bid customer-safe projection so they never reach the guest. `createPublicBooking` stamps them
  post-insert alongside attribution; the RPC signature is unchanged. **Must be pushed before submits
  persist them — the stamp is non-fatal if the column is absent.**)*
- Resolve experiences/add-ons to DB UUIDs for `booking_disciplines`/`booking_add_ons`. *(Done, but
  **server-side in the submit action**, not in `estimate-intake.tsx` — no client-sent UUIDs to tamper
  with, single round-trip. New pure resolver `src/services/estimates/resolve-estimate-catalog.ts`
  matches BY NAME against `getPublicServicesForProperty`.)*
  - **Did NOT seed new catalog rows.** The seeded catalog is placeholder and only partly overlaps the
    estimate experiences, so per the "omit rather than FK-fail" rule the resolver is **intentionally
    lossy**: only `clays`→Sporting Clays (HSB+HH), `pistol`→Pistol Bays (HSB), `ammo`→Ammunition Pack,
    `cart`→Drink Cart wire up. `lesson`/`class`/`event`/`facility`, HH `pistol`, `gear`, and `catering`
    have **no catalog row and are omitted** (priced on `bid_line_items` regardless). **Fuller structure
    needs real catalog seeding** — a content task (ideally via the admin dashboard, not a speculative
    seed migration). Extend the maps in the resolver when that catalog lands; nothing else changes.
- **Extract advisories** (RSO, instructor escalation, 9+ Private Event/72-hr, heat) into a shared
  `booking-advisories` module; wire the form to it and carry the flags into `staff_notes`/`schedule_notes`.
  *(Done: `src/services/public/booking-advisories.ts`; `rules.ts computeEstimate` now delegates, so the
  form and the submit action derive identical flags.)*
- Light parity check (§8): carried pre-discount total == displayed total; advisory module == prior output.
  *(Advisory logic is a verbatim move; resolver FK-safety confirmed against the live catalog.)*
- **Still open for Phase D:** surface `staff_notes`/`schedule_notes` in the admin bid detail so staff
  actually read the advisories/host-intent (this phase only persists them).

**Phase C2 — Sticky right column** (see §9) — ✅ DONE. *Pure CSS. The pre-existing
`position: sticky` was on the inner `.estimate` card (zero travel — its wrapper shrink-wraps it);
moved it onto the grid item (`.rail`), which travels within the tall grid. Added a viewport
max-height/overflow guard and disabled sticky in the stacked mobile layout. Visual confirmation
pending a running dev server (per CLAUDE.local.md, the user runs the app).*

**Phase D — Admin lock action + bid-page edits + consolidation** — ✅ DONE
- **Slot-lock action** (§7). *Done as a **combined** action (the §7 "one combined action" option):
  migration adds `lock_booking_slot()` (sets a real `start_time` tz-correctly + `duration_hours` AND
  advances `bookings.status` → `awaiting_guest` in one UPDATE — `start_time` is in the SET list, so
  the §7 gotcha is satisfied). `lockBookingSlot` service maps trigger rejections; `lockAndConfirmBidAction`
  locks then confirms (lock-before-confirm guaranteed). `BidActions` shows "Lock slot & confirm" (date/time
  prefilled from the provisional slot) only for quote-only estimate bids whose booking is still
  `pending_review`; /book keeps the plain Confirm.*
- **Bid-page edits** (§8a). *Done via a new `bids.requires_waiver` marker (default true; estimate sets
  false — the §11 waiver seam). Page suppresses `SignatureSlot` when `!requiresWaiver`, treats a confirmed
  no-waiver bid as fully "set" (finalized without sign/pay), and tags the `pending_review` time "pending".*
- Hide `/admin/estimates` nav entry *(done)*; stop writing `estimate_requests` *(already done in Phase B)*.
- **Schedule visibility** *(done + corrected): the dashboard "Upcoming" panel already filtered to
  confirmed/signed/paid, but the `/admin/bookings` month calendar counted all non-terminal bookings —
  so `pending_review` was added to the calendar's excluded set. A soft request now appears only once
  locked + confirmed (status → awaiting_guest).*
- **Staff-notes correction (found in Phase D):** Phase C added `staff_notes`/`schedule_notes` to
  **bookings**, but `bids` already has them and the admin bid detail renders them. Redirected the stamp
  to `bids.staff_notes` (staff-only — not in the public get-bid projection; `bids.schedule_notes` IS
  guest-visible, so all staff context folds into `staff_notes`) and **dropped the unused bookings
  columns**. The admin "Staff notes" card now surfaces the intake context with no new UI.
- **Deferred from §7:** true *reschedule* of an already-locked/confirmed booking (the function supports
  it, but there's no admin reschedule UI yet) — fits the §13 future direction.

**Phase E — Hide `/book`** ✅ DONE (see §12)
- *Done: public CTAs repointed `/book` → `/request-estimate` (homepage final CTA, `homepage-hero.ts`
  default `primaryCtaHref`, admin hero-form help text/placeholder + a stray comment), and the funnel
  route entries now `redirect("/request-estimate")` — at `app/(public)/book/page.tsx` and the
  `app/(public)/book/[property]/layout.tsx` chokepoint (covers type-picker + disciplines + details).
  No middleware `/book` entry existed (project has no `middleware.ts`), so nothing to pull there. All
  funnel code retained intact — `BookingFlowProvider`, the step components, deeper pages, and the
  `createPublicBooking` primitive / `create_public_booking` RPC — per §12; deletion is the later task.
  NOTE: the homepage-hero CTA href is DB-editable, so if the live `homepage_hero` row still stores
  `/book` it must be changed in `/admin/homepage` (dashboard-first) — not a code/migration fix.*

**Phase F — Verify end-to-end** (hand off to user to run the app per CLAUDE.local.md)
- Submit → bid URL shows "being prepared" with the picked time tagged "pending" → appears in
  `/admin/bids` → staff lock slot + confirm → URL shows confirmed event details, no waiver/deposit.
- **Static + build verification — DONE (code side clean):** full static trace of all five steps
  found 0 defects; `npm run typecheck` and `npm run build` both clean. Verified specifically:
  (a) submit → `pending_review` booking + quote-only bid (`requires_waiver=false`, `deposit_amount`
  NULL → `requiresDeposit=false`); (b) bid page `pending_review` → "pending" time tag + "being
  prepared" banner, no embeds; (c) admin list (no filter) returns all statuses newest-first so the
  request surfaces (also the `needs_review` group); (d) `needsSlotLock = !requiresWaiver &&
  bookingStatus==='pending_review'` → "Lock slot & confirm", prefilled tz-correctly; lock RPC sets
  real slot, trigger `00` recomputes `end_time`, status→`awaiting_guest` re-arms capacity+slot
  triggers, then `confirmBid` → confirmed; (e) confirmed page suppresses signature + deposit slots,
  shows "all set". **Operational caveat for the live pass:** the locked time must exist in
  `time_slots` for that property/weekday or `validate_booking_start_time` rejects it (mapped to a
  friendly "invalid slot") — seed/choose a listed slot (§11 catalog-seeding risk).
- **Runtime click-through — PENDING USER** (chose manual test; CLAUDE.local.md bars Claude from
  starting the dev server). Checklist delivered; sign off here once the live submit→lock→confirm
  pass is green.

---

## 11. Risks / open items

**Resolved by the decisions in §3 (recorded here so they aren't re-litigated):**
- *Capacity pollution* — `check_property_capacity` counted `pending_review` rows (lines 205–210),
  so the old bypass design would have let soft requests occupy capacity. Closed by status gating
  (§6): `pending_review` is both skipped and excluded from the SUM.
- *Persistent-bypass hole* — a `bypass` column would also skip enforcement on the slot-lock UPDATE.
  Closed by gating on status instead (§6).
- *Bid-line override churn + false warning* — closed by passing explicit `lineItems` and skipping
  materialization (§8), now that `createPublicBooking` is single-caller.
- *HSB members-only vs membership we can't verify* — gate dropped; admin verifies (§3.5/§8).
- *Booking type vs experiences* — decided: `plan_a_visit` generic container, no instructors (§3.2).
- *Member pricing on trust* — accepted: member host gets member pricing, admin verifies (§3.5).

**Live risks to watch:**
- **Provisional-slot operational discipline.** Until staff run the lock action, a `confirmed` bid
  could be confirmed *before* the slot is locked. Enforce lock-before/at-confirm in the action (§7)
  so a confirmed bid never sits on an unenforced slot.
- **Catalog seeding.** `booking_disciplines` / `booking_add_ons` need real `services` /
  `service_add_ons` rows per property or inserts fail FK `23503` (§8). This is the most likely
  place Phase C slips; audit before wiring.
- **Abuse surface.** This becomes the *only* booking front door; each accepted submit mints a
  Booking + Bid + access code and fires the guest-confirmation Inngest. Keep the existing rate limit
  (`action.ts:62-67`); the capacity-DoS angle is gone (soft rows hold no capacity), so no
  email-verification in v1. Revisit if abuse appears.
- **Waiver re-introduction.** The signature slot is *suppressed*, not removed (§8a). When waivers
  return, the suppression signal is the seam to flip.
- **estimate_requests cleanup.** Table + RPC stay in place short-term; remove once the bid path is
  proven in production.

---

## 12. Explicitly NOT in this plan
- Payments / deposits (no Stripe on this route).
- Waiver / e-sign of any kind (native or vendor). The signature slot is suppressed for these bids
  (§8a); waivers return later behind a flag.
- **Deleting** the `/book` funnel code. This plan only **hides** `/book` (nav + middleware) and
  keeps `createPublicBooking` as the shared primitive; deleting the funnel pages /
  `BookingFlowProvider` / components is a separate follow-up task once the estimate→bid path is
  proven.
- Instructor-led (private lesson) *scheduling* — no instructor is assigned this version; lessons are
  priced but unscheduled (§3.2).
- Building an admin "add arbitrary bid line" UI — staff use total-override + note (§3.8).

---

## 13. Future direction (supported by this architecture, NOT built now)

### Guest self-reschedule / edit from the bid URL

A future phase could let the guest change their own booking (e.g. move 9 AM → 1 PM, adjust party
size) directly from `/bids/{slug}/{code}`, without a phone call. This is called out **because the
design here actively enables it** — it would be a new phase, not a rewrite. What's already in place:

- **An authenticated handle.** The unique URL's access code already proves "this is my booking."
  The app already lets an unauthenticated guest *mutate* their booking through that URL via a
  `slug + code` server action — the waiver-sign and deposit-pay flows do exactly this
  (`WaiverSignModal` / `DepositPaymentForm`). A "change my time" action is the same shape.
- **The DB is the single referee for availability.** The capacity/slot triggers (§6) run on *any*
  time change, staff- or guest-initiated, so a guest move to a taken slot is rejected by the
  database — no need to trust the guest's view of what's open.
- **The status model already separates "request" from "committed."** Editing a still-`pending_review`
  booking is low-risk (it holds nothing yet).

What a future phase would still need to decide/build (policy, not plumbing):

- A **guest-facing reschedule server action** (sibling of the staff lock action, §7).
- **Soft-model gotcha:** a `pending_review` booking holds *no* capacity, so "is 1 PM open?" isn't
  guaranteed until something **locks** it. A guest pick that must "stick" has to lock the slot
  (→ `awaiting_guest`) — i.e. decide whether guests may commit a slot themselves, or whether a
  guest change drops the bid **back to review** for staff to re-bless.
- **Re-pricing** on edits that change party size / experiences (re-runs the same quote + line carry).
- **Post-edit workflow** for an already-`confirmed` bid (silent re-confirm vs. back-to-review).

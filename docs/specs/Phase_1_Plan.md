# Phase 1 — Per-line Override Bidder · Implementation Plan

**Status** Approved to build. Sequences the locked design in [`Phase_1_Design.md`](./Phase_1_Design.md), incl. the **2026-06-17 manual-markdown reconciliation addendum (R1–R3)** folded into PR-2 §5–§6.
**Builds on** Phase 0 (`bid_line_items`, PR #6) — **merged to `main` 2026-06-16** (`a7c8909`).
**Delivery** Two PRs: **PR-1** backend + admin, **PR-2** customer-facing + dashboard.
**Author** Claude Code session, 2026-06-16; revised 2026-06-17.

This plan does **not** re-argue the five rulings — Q1–Q5 are locked in `Phase_1_Design.md §7`.
It lays out the concrete, file-by-file build. Two gaps surfaced during evaluation drive the
sequencing; both are already endorsed by the design:

1. **The manual price-edit path is unaudited today.** `src/services/admin/update-bid-pricing.ts`
   just `UPDATE bookings SET confirmed_price, deposit_amount` — no actor, timestamp, or history.
   The new `bid_pricing_events` audit must capture **both** the override path *and* this
   pre-existing manual path, or the timeline is half-blind (design §1a).
2. **The customer has never seen line items.** Phase 0 stopped at the admin surface; the public
   bid page renders a single effective-quote number. Q3 ("always show the breakdown") is net-new
   **customer** UI, not merely a discount line.

### Locked implementation decisions (beyond Q1–Q5)

- **Deposit on comp → warn, don't auto-touch.** `applyLineOverride` never mutates
  `deposit_amount`. When a comp pushes the new total below the existing deposit, the
  `WaiveDialog` warns and asks the admin to adjust the deposit manually via the existing
  `PricingEditor`. Keeps the money-path invariant `deposit ≤ effectiveQuote` an explicit
  admin responsibility (trust-and-verify).
- **Two PRs**, each independently reviewable and shippable.

---

## PR-1 — Backend + admin

### 1. Migrations (two files; follow Phase 0 conventions)

**`bid_line_overrides`** — append-only, immutable (Q1). Keyed on `booking_id` to match
`bid_line_items`. Per design §1:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `booking_id` | uuid NOT NULL → `bookings(id)` ON DELETE CASCADE | RLS join key |
| `line_item_id` | uuid NOT NULL → `bid_line_items(id)` ON DELETE CASCADE | line being waived |
| `original_amount` | numeric(10,2) NOT NULL | snapshot at override time |
| `new_amount` | numeric(10,2) NOT NULL CHECK (≥ 0) | 0 = full waive |
| `delta` | numeric(10,2) GENERATED ALWAYS AS (`new_amount - original_amount`) STORED | negative for a discount |
| `reason` | text NOT NULL CHECK (length ≥ 10) | **ADMIN-ONLY — never leaves the admin layer** |
| `customer_facing_label` | text NULL | null → renders "Discount applied" |
| `actor_id` | uuid NOT NULL → `auth.users(id)` | from session |
| `actor_email` | text NOT NULL | captured at write time |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

No `updated_at`; no UPDATE/DELETE path. Corrections are reversing inserts (Q1).

**`bid_pricing_events`** — source-tagged price-change audit (design §1a):
`id`, `booking_id` (→ `bookings`), `source` enum (`manual` · `line_override`),
`line_override_id` (nullable → `bid_line_overrides.id`), `old_total`, `new_total`,
`actor_id`, `actor_email`, `note` (nullable), `created_at`.

**RLS — staff-only, narrower than `bid_line_items`.** Phase 0's `bid_line_items` is readable
by the owning member/partner; **these two tables must not be** — `reason` is admin-only. So
they get their **own** SECURITY DEFINER selector (modeled on `bid_line_visible_booking_ids()`
in `supabase/migrations/20260616210000_bid_line_items_rls_and_backfill.sql`, but **dropping
the member/partner branches**): `super_admin`/`admin` see all; `property_manager` scoped via
the `bookings.property_id` join. SELECT policy = `booking_id IN (SELECT <staff_selector>())`.
INSERT/UPDATE/DELETE: **none for authenticated users — service-role only.**

Per `CLAUDE.md` RLS rules, route the new selector + policies through the **Supabase Auth &
Access Architect agent** (`agents/supabase_auth_rls_agent.md`) and a dependency-graph audit
before the migration lands. No cycle expected — both tables reference `bookings` /
`bid_line_items`; neither is referenced back. Wrap `auth.uid()`/`auth.jwt()` in `(SELECT …)`;
`SET search_path = public` on the function (rules 3–4). Add an explicit query-as-role test
(rule 6).

### 2. Close the audit gap — wire BOTH write paths into `bid_pricing_events`

- **Manual path (pre-existing gap).** Extend `src/services/admin/update-bid-pricing.ts`: read
  `old_total` (current `confirmed_price ?? estimated_price`) before the UPDATE, then append a
  `source = 'manual'` event with `old_total`/`new_total` and actor identity. The calling action
  `app/admin/bids/[id]/edit/actions.ts` resolves the session actor; reuse `getStaffIdentity`
  (`src/services/admin/staff-identity.ts`) for `actor_email`.
- **Override path (new).** `applyLineOverride` (§3) appends a `source = 'line_override'` event
  linked to its override row.

### 3. `applyLineOverride` service + action (Option A reconciliation)

New service `src/services/admin/apply-line-override.ts`. Signature (design §3):
`applyLineOverride({ bookingId, lineItemId, newAmount, reason, customerFacingLabel? })`.

1. **Authz** — staff role; `property_manager` scoped to the bid's property. Reuse existing
   role-claim / `hasAdminAccess` helpers.
2. **Guard** — bid status `pending_review` only (consistent with `bid-line-items.ts`
   `FULL_BUILD_STATUSES` and `bid-actions.tsx` `canConfirm`). Reject otherwise.
3. **Snapshot** — read the line's current `line_amount` as `original_amount`.
4. **Validate** — `0 ≤ newAmount ≤ original_amount` (comps only lower); `reason` length ≥ 10.
5. **Write** — service-role INSERT into `bid_line_overrides`, stamping `actor_id`/`actor_email`.
6. **Reconcile (Option A)** — new `confirmed_price` = current effective base
   (`confirmed_price ?? estimated_price`) **− Σ(latest override delta per line)**; write it to
   `bookings.confirmed_price`. All 15 reader sites already coalesce `confirmed_price ??
   estimated_price`, so they show/charge the discounted number with **zero changes** (see
   Reader-site map below).
7. **Deposit** — do **not** touch `deposit_amount`. Return `depositExceedsTotal: true` when
   `deposit_amount > newConfirmedPrice` so the UI warns.
8. **Audit** — append the `bid_pricing_events` `line_override` row (§2).

New action wrapper under `app/admin/bids/[id]/` (mirror `edit/actions.ts`): validate → call
service → `revalidatePath`. **Reversing entries (Q1) need no new code** — a reversal is just
`applyLineOverride` with `newAmount = original_amount`.

**Shared helper — "latest override per line."** One function (group by `line_item_id`, take
max `created_at`) reused by reconciliation (§3.6), the customer page (§5), and the queue flag
(§6). Single source of truth for the override math.

### 4. Admin UI

- **Per-line Waive action.** In `src/components/admin/bid-line-items-card.tsx` (Phase 0's
  read-only card) add a "Waive" button per row → new `WaiveDialog` (new amount or "waive in
  full"; required reason ≥ 10; optional customer-facing label). Visible only on
  `pending_review`. Surface the deposit warning when `depositExceedsTotal`.
- **Pricing-history panel.** New `src/components/admin/bid-pricing-history-card.tsx`, inserted
  in the rail of `app/admin/bids/[id]/page.tsx` **after `BidLineItemsCard` (~line 429), before
  the Lifecycle card** ("beneath the breakdown, above bid actions"). Renders `bid_pricing_events`
  newest-first; each entry tagged `[manual]` / `[line override]`; line-override entries expand
  to line + label + **reason** (admin-only). Empty state: "No pricing changes on this bid."
- **Data wiring.** Extend `AdminBidDetail` (`src/services/admin/get-bid-detail.ts`) with
  `overrides` + `pricingEvents`, fetched alongside the existing `lineItems`.

### PR-1 acceptance

- Concierge waives a line on a `pending_review` bid (reason + label); `confirmed_price` drops
  by the delta; `deposit_amount` untouched; warning shown when deposit now exceeds total.
- Manual `PricingEditor` edit writes a `source: manual` event; the waive writes a
  `source: line_override` event — visible, distinguishable, never collapsed.
- A reversing entry restores the line and is itself recorded; no row is ever edited/deleted.
- RLS: member/partner cannot read `bid_line_overrides` / `bid_pricing_events` — especially
  `reason` (query-as-role test, `CLAUDE.md` rule 6); `property_manager` scoping holds.
- `npm run typecheck` clean; migrations apply.

---

## PR-2 — Customer-facing + dashboard

### 5. Public bid page (the second called-out gap)

`app/(public)/bids/[slug]/[code]/page.tsx`, data via `src/services/bids/get-bid.ts`:

- **Always-show breakdown (Q3).** Render the itemized `bid_line_items` on every bid — net-new
  customer UI. `get-bid.ts` now also selects the lines.
- **Discount line — derived arithmetically (design §5, R1).** `discount = subtotal(Σ
  line_amount) − effectiveQuote(confirmed_price ?? estimated_price)`, rendered as a **single
  rolled-up line whenever `discount > 0`** — for **any** cause (line override, manual
  `PricingEditor` markdown, or a mix). Layout: Subtotal → discount line → net total
  (`confirmed_price`) → deposit. **The math needs only line items + `effectiveQuote`** —
  override deltas are *not* required to compute the discount (Option A already baked manual
  edits into `confirmed_price`); they only inform the **label**.
- **This honors the manual-markdown requirement (R1) for free.** A manual price drop with no
  override row still reconciles: subtotal stays at the line sum, `effectiveQuote` is the lowered
  total, the gap renders as a generic "Discount applied: −$X". No new infrastructure beyond the
  line-item fetch this section already adds.
- **Label.** Use the shared override `customer_facing_label` only when override deltas **fully
  account for** `discount` *and* every comp shares one label; otherwise — including any
  manual-markdown component or mixed labels — the generic "Discount applied".
- **Edge — total ≥ subtotal (R2).** Manual increase above the line sum → render **no**
  discount/surcharge line; show the higher total. Clamp the discount at zero.
- **Safe-field selection.** Override rows are read **only** for their `customer_facing_label`
  (label logic) — **never** `reason`, `actor_id`, `actor_email`. The discount *amount* comes
  from the arithmetic gap, not from selecting `delta`. Boundary enforced twice: RLS (§1) blocks
  any non-staff read, and the service hand-picks columns.

```
Your quote
  Sporting Clays — 3 adults × $85 + 2 juniors × $55      $365.00
  Ammunition Pack × 2                                     $150.00
  ─────────────────────────────────────────────────────────────
  Subtotal                                                $515.00
  VIP comp                                               −$150.00
  ─────────────────────────────────────────────────────────────
  Total                                                   $365.00
  Deposit due now                                         $100.00
```

### 6. Dashboard + queue surfacing

- **Queue flag.** Add a column to `src/components/admin/bid-list-table.tsx`; hydrate
  `hasOverride` / `overrideTotal` in `src/services/admin/bids.ts` (grouped override sum per
  booking). Hover text "Override applied −$X".
- **"Overrides this week" card.** Extend `AdminDashboardData` in
  `src/services/admin/dashboard-data.ts` with current-week override count + total $ waived,
  linking to `/admin/bids?has_override=true`.
- **25% threshold flag (Q5).** Red flag on that card for any bid whose total comp > 25% of its
  subtotal. **Detection only — no hard cap.** Recalibrate after ~3 months.
- **These three surfaces are override-only (R3).** Queue flag, dashboard card, and the 25%
  threshold all count `bid_line_overrides` rows only. A manual `PricingEditor` markdown does
  **not** trip them — it's audited in Pricing history (`source: manual`, PR-1 §2) and reconciled
  on the customer page (§5), but is not counted as an "override." Keep the override sum/grouping
  in `bids.ts` / `dashboard-data.ts` scoped to the overrides table; do not derive it from the
  `confirmed_price` gap.

### PR-2 acceptance

- Public bid page shows each line at its **original** (`line_amount`) amount, the discount line,
  and the lower total — and never `reason`/actor/timestamp.
- No `customer_facing_label` → defaults to "Discount applied".
- A bid with no override **and no manual markdown** looks as it does today **plus** the new
  breakdown (`discount = 0`, no discount line).
- **Manual-markdown reconciliation (R1):** a manual `PricingEditor` discount with no override
  row → customer page shows the full subtotal, a generic "Discount applied: −$X", and the lower
  total; the list reconciles.
- **Manual increase (R2):** `confirmed_price` above the line sum → no discount/surcharge line;
  higher total shown.
- Queue row shows the override flag; dashboard card shows count + $ waived; a >25% comp raises
  the red flag and still applies. **A manual markdown trips none of these (R3).**

---

## Cross-cutting tests (the Option-A money-math watch-out)

Beyond design §8 — which under-specifies the reconciliation math — require explicit coverage:

- **Deposit warning correctness** after an override, including a comp that pushes total below
  the existing deposit (`depositExceedsTotal`).
- **Multiple comps across different lines** summing correctly into `confirmed_price`.
- **Reversing-entry round-trip** restoring the exact pre-comp `confirmed_price`.
- **Manual-markdown reconciliation (R1):** a manual `PricingEditor` discount with no override
  row → customer page `discount = subtotal − effectiveQuote` renders a generic "Discount
  applied" line; `subtotal − discount === total` holds.
- **Total ≥ subtotal clamp (R2):** a manual increase yields no discount line (no negative
  discount).
- **Override-only metrics (R3):** a manual markdown does not increment the queue flag /
  dashboard override count / 25% threshold.

---

## Reference — `confirmed_price` reader sites (why Option A is "zero changes")

Every site below already reads `confirmed_price ?? estimated_price`, so writing the discounted
total into `confirmed_price` propagates automatically. None needs editing for overrides:

- **Money path** — `src/services/stripe/create-deposit-session.ts` (charge ceiling),
  `src/services/stripe/handle-payment-intent-succeeded.ts` (balance due).
- **Customer display** — `lib/inngest/functions/send-bid-confirmed-email.ts`,
  `lib/inngest/functions/send-waiver-signed-email.ts`, public page via
  `src/services/bids/get-bid.ts`.
- **Admin/member display** — `src/services/admin/get-bid-detail.ts`,
  `src/services/admin/dashboard-data.ts`, `src/services/admin/bids.ts`,
  `src/services/members/booking-detail.ts`, `src/services/members/bookings.ts`.

`confirmed_price` semantics shift from "original quote" to "current effective total to charge";
the original quote is preserved in **`bid_line_items.line_amount`** (Phase 0's table has no
`original_amount` column) and in each override's snapshotted `original_amount`.

---

## Verification (end-to-end)

- `npm run typecheck` after each PR (Claude runs this).
- **RLS** — run the actual SELECT as member / partner / property_manager against the DB; confirm
  `reason` is unreadable and property scoping holds (`CLAUDE.md` rule 6).
- **App smoke** (developer runs the dev server; Claude hands it off per `CLAUDE.local.md`):
  apply a comp on a `pending_review` bid → verify admin total, pricing-history source tags,
  public-page discount, Stripe deposit-session ceiling, and the confirmation email all reflect
  the discounted number; then append a reversing entry and confirm the round-trip.
- **Migrations** applied via the linked-cloud workflow (`db push`) — not `db reset`.

---

## Scope guards

- No `events_concierge` role (Q4) — Cassi maps to `admin`.
- No approval gate on overrides (audit-and-flag, trust-and-verify).
- Files touched are migrations / services / components only — no foundational files; consistent
  with the project structure rules in `CLAUDE.md`.

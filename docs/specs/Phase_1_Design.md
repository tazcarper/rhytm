# Phase 1 — Per-line Override Bidder · Design Sketch

**Status** Design **approved 2026-06-16** — all five rulings locked (§7); **manual-markdown reconciliation addendum (R1–R3) locked 2026-06-17** (§7 addendum). Phase 0 (#6) **merged to `main` 2026-06-16**; implementation cleared to begin, surfaced for review before merge. *(2026-06-17 review also corrected a column reference: the original-quote record is `bid_line_items.line_amount`, not a non-existent `original_amount` — see §4.)*
**Builds on** Phase 0 (`bid_line_items`, PR #6). **Adapts** Build Spec §2.2 / §4.2 to the real codebase.
**Author** Claude Code session, 2026-06-16.

---

## 0. What Phase 0 already gives us

Phase 0 materializes every bid into real `bid_line_items` rows (keyed on `booking_id`, since bids↔bookings is 1:1), each with a stable `id`, a `label`, `line_amount`, and a `tax_status`. Phase 1 lets a concierge **waive or comp a specific line**, shows the customer a transparent discount, and records an admin-only audit trail.

The three drifts from the Build Spec's illustrative SQL, already resolved in Phase 0 and carried here:
1. **`booking_id` keying**, not a `bid_id`-on-bookings conflation.
2. **JWT-claim RLS** (`auth.jwt() -> 'app_metadata' ->> 'role'`), not an `admin_users` table.
3. The customer surface is the **web page `/bids/[slug]/[code]`**, not a PDF.

---

## 1. The override table

A new `bid_line_overrides` table, append-only (audit-immutable), keyed on `booking_id` to match `bid_line_items`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `booking_id` | uuid NOT NULL → `bookings(id)` ON DELETE CASCADE | matches the line-items key; RLS mirrors `bid_line_items` |
| `line_item_id` | uuid NOT NULL → `bid_line_items(id)` ON DELETE CASCADE | the line being waived |
| `original_amount` | numeric(10,2) NOT NULL | snapshot of the line's amount at override time |
| `new_amount` | numeric(10,2) NOT NULL CHECK (≥ 0) | the comped amount (0 = full waive) |
| `delta` | numeric(10,2) GENERATED ALWAYS AS (`new_amount - original_amount`) STORED | negative for a discount |
| `reason` | text NOT NULL CHECK (length ≥ 10) | **ADMIN-ONLY. Never leaves the admin layer.** |
| `customer_facing_label` | text NULL | concierge label e.g. "VIP comp"; null → renders "Discount applied" |
| `actor_id` | uuid NOT NULL → `auth.users(id)` | who applied it, from the session |
| `actor_email` | text NOT NULL | captured at write time for a stable audit even if the user is later removed |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Immutability.** No `UPDATE`/`DELETE` path is exposed, and there's no `updated_at`. A mistaken comp is corrected by appending a **reversing override** on the same line (a `new_amount` back to `original_amount`, reason "reversing prior comp — keyed wrong"). This preserves the audit trail rather than erasing it. *(Open question Q1: do we want a `super_admin`-only void instead? The spec says strictly immutable; the reversing-entry approach honors that.)*

**One active override per line?** The build spec implies a single waive per line. The reversing-entry model means a line can have multiple override rows over time; the **effective** override for a line is its **most recent** row. The total math (below) must therefore sum only the latest override per line, not every row. **Locked (Q1): strict append-only with reversing entries — never a void.** A mistake is corrected by appending a reversing override; the social-pressure "undo button" is removed entirely.

---

## 1a. Source-tagged pricing audit — manual vs. line override (Q2 addendum)

Under Option A, **two distinct mechanisms write the same field** `bookings.confirmed_price`:

1. **Manual** — `PricingEditor` → `update-bid-pricing.ts` sets a confirmed price directly.
2. **Line override** — `applyLineOverride` writes a `bid_line_overrides` row and re-derives `confirmed_price`.

Today the **manual path leaves no audit at all** — `update-bid-pricing` just UPDATEs the column. So a price-change timeline can't currently tell the two apart, which is exactly the unlabeled-timeline failure to avoid. Fix:

- A lightweight append-only **`bid_pricing_events`** table: `id`, `booking_id`, **`source` enum (`manual` · `line_override`)**, `line_override_id` (nullable → `bid_line_overrides.id`), `old_total`, `new_total`, `actor_id`, `actor_email`, `note` (nullable), `created_at`. RLS mirrors `bid_line_overrides` (staff read, service-role write).
- **Both** paths append one event: `update-bid-pricing` writes `source = manual`; `applyLineOverride` writes `source = line_override` linked to its override row.
- The admin **Pricing history** timeline (in the audit panel, §6) renders every entry with a visible **`source: manual` / `source: line override`** tag; line-override entries expand to the per-line detail (line, label, reason) from the linked row.

This is the "cheap affordance now" — it also closes a real pre-existing gap (manual price edits were unaudited). Net-new for Phase 1, small, and it makes `confirmed_price`'s full mutation history legible by mechanism.

---

## 2. RLS (JWT-claim pattern)

Mirrors `bid_line_items` / `booking_add_ons` for the **staff read** side, but is **deliberately narrower** — the customer (member/partner) must never read this table, because `reason` is admin-only:

- **SELECT** — `super_admin`, `admin` (all); `property_manager` (their property, via the `bookings` join). **No member/partner/anon read policy.**
- **INSERT/UPDATE/DELETE** — none for authenticated users; **service-role only**.

**How the customer still sees the discount.** The public bid page reads through the **service-role `get-bid` path** (already how `/bids/[slug]/[code]` loads). That service will select **only the customer-safe fields** — `customer_facing_label` and `delta` (or `original_amount`/`new_amount`) — and **never** `reason`, `actor_id`, or `actor_email`. The security boundary is therefore enforced twice: RLS blocks any authenticated non-staff read, and the public service hand-picks safe columns. Reason text has no path to the customer.

This is a non-trivial RLS change, so per `CLAUDE.md` it goes through the Supabase Auth & Access Architect agent and a policy-dependency-graph audit before the migration lands. No new cross-table cycle is expected (the table references `bookings`/`bid_line_items`; neither references back).

---

## 3. Applying an override (server action)

A new admin server action `applyLineOverride({ bookingId, lineItemId, newAmount, reason, customerFacingLabel? })`:

1. **Authn/authz** — resolve the caller from the session; require a staff role (`super_admin`/`admin`/`property_manager` scoped to the bid's property). Reuse the existing `hasAdminAccess` / role-claim helpers.
2. **Guard** — only on a bid in `pending_review` (per spec; matches where pricing is still editable). Reject otherwise.
3. **Snapshot** — read the line's current `line_amount` as `original_amount`.
4. **Validate** — `newAmount ≥ 0` and `≤ original_amount` (a comp lowers, never raises — raises would be a different feature); `reason` length ≥ 10.
5. **Write** — service-role insert into `bid_line_overrides`, stamping `actor_id` + `actor_email` from the session.
6. **Reconcile the quote** — see §4.

No approval gate (per spec: audit-and-flag, trust-and-verify).

---

## 4. The total, and how it reconciles with `confirmed_price`

This is the crux and the main thing to rule on.

**Today:** the customer total on the bid page is `effectiveQuote = confirmed_price ?? estimated_price` (a single stored number). The Phase 0 line subtotal mirrors `estimated_price`.

**Spec's intent:** `customer total = sum(line original_amounts) + sum(override deltas)`.

**LOCKED — Option A: overrides mutate `confirmed_price`.** The audit settled it: the effective total is re-derived independently at **15 reader sites** — including the **Stripe deposit charge ceiling** (`create-deposit-session.ts`), the **payment webhook** (`handle-payment-intent-succeeded.ts`), and **two customer emails** — none routed through a shared helper. Under a presentational model every one would have to learn about override deltas or charge/show the undiscounted price; centralizing them is the far larger refactor and lands on the money path. So:

- `applyLineOverride` computes the **adjusted total** = current effective base (`confirmed_price ?? estimated_price`) **− Σ (latest override delta per line)** and **writes it into `bookings.confirmed_price`**. Every existing reader (Stripe, webhook, emails, admin, member, bid page) then shows/charges the discounted number with **zero changes**.
- **`confirmed_price` semantics shift** from "original quote" to **"current effective total to charge."** The forensic record of what each line was originally quoted at is preserved in **`bid_line_items.line_amount`** (the materialized per-line amount; Phase 0's table has no `original_amount` column) and in each override's snapshotted `original_amount`. `bid_line_items.line_amount` is immutable from Phase 1's perspective — overrides live in the separate append-only `bid_line_overrides` table and never mutate the line rows — so it remains the authoritative original-quote record.
- On the **customer bid page**, render: line items → **Subtotal** (pre-discount) → **"Discount applied: −$X"** (or the concierge label) → **net total** = `confirmed_price` → deposit/balance as today. Display and charge are provably identical because they're the same number.
- If the original deposit was a percentage of the quote, re-derive it from the adjusted total.

---

## 5. Customer-visible discount on `/bids/[slug]/[code]`

Phase 1 adds, to the public bid page, the **itemized breakdown the customer doesn't see today**, plus the discount line:

```
Your quote
  Sporting Clays — 3 adults × $85 + 2 juniors × $55      $365.00
  Ammunition Pack × 2                                     $150.00
  ─────────────────────────────────────────────────────────────
  Subtotal                                                $515.00
  VIP comp                                               −$150.00   ← customer_facing_label or "Discount applied"
  ─────────────────────────────────────────────────────────────
  Total                                                   $365.00
  Deposit due now                                         $100.00
```

**The discount line is derived arithmetically, not from override rows.** This is a deliberate change from the first draft (which gated the line on "an override exists") and exists to honor a product requirement: when staff lower a price the *old* way — the manual `PricingEditor`, **no override row** — the customer page must *still* reconcile. The rule:

- `subtotal = Σ bid_line_items.line_amount` (always shown, per Q3).
- `total = effectiveQuote = confirmed_price ?? estimated_price`.
- `discount = subtotal − total`. Render a discount line **whenever `discount > 0`**, for **any** reason the total is below the line sum — line override, manual markdown, or a mix.

Because Option A (§4) means `confirmed_price` already reflects *both* manual edits and overrides, this single rule reconciles every case by construction: `subtotal − discount = total` always holds. The customer page needs only the line items and `effectiveQuote` to render — override deltas are **not** required for the math; they only inform the *label*.

- **Shown:** each line at its **original** amount (`line_amount`), the subtotal, the discount (label + dollar value), the net total, the deposit. The customer feels the comp.
- **Never shown:** `reason`, `actor`, `timestamp`. Those have no code path to this page (§2).
- **Label (single rolled-up line — Nicholas, 2026-06-17).** All discounts collapse into **one** line. If the bid's override deltas fully account for `discount` *and* every comp shares one `customer_facing_label`, that label is used; otherwise — including any manual-markdown component, or mixed labels — the generic **"Discount applied"**. A manual-only markdown therefore always shows "Discount applied: −$X".
- **Edge — total ≥ subtotal (manual price *increase*) → clamp at zero (Nicholas, 2026-06-17).** If a manual edit raises `confirmed_price` to or above the line sum, show **no** discount/surcharge line — just the (higher) total. Line items are the baseline; `confirmed_price` is authoritative. No negative-discount or "surcharge" line.
- A bid with no override and no manual markdown shows `discount = 0`, no discount line — the page looks as it does today **plus** the new always-on line-item breakdown (Q3).

---

## 6. Admin surfaces

**Bid detail `/admin/bids/[uuid]`:**
- **Per-line "Waive" action** on each row of the Phase 0 *Quote breakdown* card → a `WaiveDialog` (new amount or "waive in full", required reason ≥ 10 chars, optional customer-facing label). Visible only on `pending_review`.
- **"Pricing history" audit panel** beneath the breakdown, above the bid actions — a single timeline of every `confirmed_price` change (from `bid_pricing_events`, §1a), each entry **tagged by source**:

```
Pricing history
  [line override]  Ammunition Pack   $150.00 → $0.00   (−$150.00)
                   "VIP comp"  ·  cassi@hsbsportingclub.com  ·  Jun 16, 3:42 PM
                   Reason: comp for VIP wedding party
  [manual]         Quote   $515.00 → $480.00   (−$35.00)
                   adam@hsbsportingclub.com  ·  Jun 16, 2:10 PM
```
  Line-override entries show actor + timestamp + line + delta + **reason** (admin-only). Manual entries show actor + timestamp + old→new total. The `source` tag means an investigator can always tell which mechanism made a given price change. Empty state: "No pricing changes on this bid."

**Bids queue `/admin/bids`:** a small flag icon in a new column when any override exists, hover-text "Override applied −$X".

**Dashboard `/admin`:** an "Overrides this week" card — count + total $ waived (current week, all properties) → links to `/admin/bids?has_override=true`. **Locked (Q5):** any bid whose total comp exceeds **25% of its subtotal** gets a **red flag** on this card — **detection only, no hard cap** (staff can still apply a >25% comp; it's just surfaced for review). Threshold to be recalibrated after ~3 months.

**Scope — these three admin surfaces are override-only (Nicholas, 2026-06-17).** The queue flag, the "Overrides this week" card, and the 25% threshold all count **`bid_line_overrides` only** — a manual `PricingEditor` markdown does *not* trip them. Manual price changes are still fully audited in the **Pricing history** panel (`source: manual`) and reconciled on the customer page (§5); they simply aren't counted as "overrides." The new customer-page reconciliation requirement does not widen these override metrics.

---

## 7. Locked decisions (Nicholas, 2026-06-16)

- **Q1 — Immutability → LOCKED: strict append-only with reversing entries.** Honor the spec verbatim; recovery via a reversing entry, never a void. No undo button.
- **Q2 — Total reconciliation → LOCKED: Option A.** Overrides mutate `confirmed_price` ("current effective total to charge"); `bid_line_items.line_amount` is the authoritative original-quote record (Phase 0's table has no `original_amount` column). See §4 + §1a (source-tagged audit).
- **Q3 — Public line breakdown → LOCKED: always show.** The itemized base + per-guest + add-ons renders on **every** bid, same structure; the discount line appears whenever `subtotal > total` (§5 — derived arithmetically, covering overrides *and* manual markdowns). Consistency builds trust.
- **Q4 — Who can waive → LOCKED: existing roles.** `super_admin` + `admin` (cross-property; the events-concierge/Cassi maps to `admin`) + `property_manager` (scoped to their property). No new `events_concierge` role for Phase 1 — add later only if `admin` proves too privileged.
- **Q5 — Comp ceiling → LOCKED: threshold flag, no hard cap.** >25% of subtotal raises a red flag on the dashboard card (detection only). Recalibrate after ~3 months.

### Addendum — manual-markdown reconciliation (Nicholas, 2026-06-17)

Folded into **PR-2**. A product requirement layered on top of the five rulings: when staff lower a price the *old* way (manual `PricingEditor`, no override row), the customer's itemized bid page must still reconcile. Resolutions:

- **R1 — Single rolled-up discount line, derived arithmetically.** The public discount = `subtotal − effectiveQuote`, shown whenever `> 0`, regardless of whether the gap came from an override, a manual markdown, or both. One line. Label = the shared override `customer_facing_label` only when overrides fully account for the gap; otherwise generic "Discount applied." See §5.
- **R2 — Manual price *increase* clamps at zero.** If a manual edit pushes the total at or above the line sum, no discount/surcharge line renders; the higher total stands. See §5.
- **R3 — Override-specific admin surfaces stay override-only.** Queue flag, "Overrides this week" card, and the 25% threshold count `bid_line_overrides` only; manual markdowns live in Pricing history (`source: manual`) and the customer page, not these metrics. See §6.

No new infrastructure — R1/R2 ride on the line-item fetch PR-2 already adds to `get-bid.ts`, and Option A means `effectiveQuote` already carries manual edits.

---

## 8. Acceptance (carried from Build Spec §6 Phase 1, adapted)

- A concierge waives the Ammunition Pack on a pending bid with reason "comp for VIP wedding party" and label "VIP comp".
- Bid total updates to subtotal + delta; deposit/balance stay consistent (per Q2 ruling).
- **Customer bid page** shows the line at its original amount, a "VIP comp: −$150" line, and the lower total. It does **not** show actor, timestamp, or the reason text.
- Bids queue row shows the override flag with "−$150"; dashboard card shows "1 override this week · −$150".
- Admin audit panel shows actor + time + line + delta + reason.
- **Pricing history distinguishes source:** a manual `PricingEditor` change appears tagged `source: manual`; the line waive appears tagged `source: line override` — never collapsed into an unlabeled timeline.
- **A reversing entry** restores a line to its original amount and is itself recorded; no override is ever edited or deleted.
- **A comp > 25% of subtotal** raises the red flag on the dashboard "Overrides this week" card; the comp still applies (no hard cap).
- A non-admin (member/partner) cannot read `bid_line_overrides` or `bid_pricing_events` — especially `reason` (RLS test).
- No `customer_facing_label` → customer page defaults to "Discount applied".
- **Manual-markdown reconciliation (R1):** staff lower a bid's price via the manual `PricingEditor` with **no** override row; the customer page shows the full line-item subtotal, a single generic "Discount applied: −$X" line, and the lower total — the itemized list reconciles (`subtotal − discount = total`).
- **Manual price increase (R2):** staff raise `confirmed_price` above the line sum; the customer page shows the higher total and **no** discount/surcharge line.
- **Override-only admin metrics (R3):** a manual markdown does **not** increment the queue flag, the "Overrides this week" card, or the 25% threshold; it appears only in Pricing history as `source: manual`.
- Typecheck clean; migration applies via `db reset`; no regressions to the existing pricing/deposit/payment flow.

---

*Implementation does not begin until Nicholas approves the Phase 0 merge and this sketch. Surfaced as a design PR; the implementation PR is separate.*

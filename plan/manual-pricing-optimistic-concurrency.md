# Plan — serialize the manual PricingEditor price write (optimistic concurrency)

Status: proposed · Scope: follow-up to Phase 1 PR-1 (per-line override bidder)

## Picking this up in a fresh session (cold-start context)

- **Branch:** `feature/phase-1-override-bidder-backend`. The work this plan
  follows lives in commits `e172aaf` (PR-1: per-line override bidder) and
  `f54d5d9` (PR-1 follow-up: atomic pricing writes + comp auto-reversal).
- **What already exists** (don't rebuild it): `bookings.confirmed_price` is now
  mutated atomically by two SECURITY DEFINER Postgres functions under a
  `SELECT … FOR UPDATE` booking lock — `apply_line_override()` (per-line comp)
  and `reverse_add_on_comps_and_clear()` (add-on edit auto-reverses comps).
  Migrations `supabase/migrations/20260617130000_*` (enum) and `…130100_*`
  (functions). The **manual** PricingEditor path (`updateBidPricing`) is the only
  confirmed_price writer NOT yet serialized — that is what this plan fixes.
- **This plan deliberately does NOT use a locked RPC** for the manual path (it
  would force relocating authorization out of RLS). It uses optimistic
  concurrency. See "Decision" below before changing approach.
- **Preconditions:** the two new migrations must be applied to the linked DB
  (`npx supabase db push`) and smoke-tested before/while doing this work. The
  developer applies migrations against a LINKED cloud Supabase (no local Docker)
  — use `db push`, not `db reset`.
- **Dev environment / guardrails:** Node 24 via nvm (already on PATH). Run
  `npm run typecheck` to validate; it must stay clean. Do **not** start the
  Next.js dev server — hand anything that needs the running app (clicking through
  the PricingEditor) to the user. Working tree has pre-existing CRLF drift on
  unrelated files; touch only the files in this plan and keep them LF.
- **Key files to read first:** `src/services/admin/update-bid-pricing.ts`,
  `app/admin/bids/[id]/edit/actions.ts`, `src/components/admin/pricing-editor.tsx`,
  and `src/services/admin/apply-line-override.ts` (for the result-shape pattern).

## Acceptance criteria

- A manual price save whose loaded `confirmed_price` no longer matches the DB
  (because a comp/auto-reversal landed in between) is rejected with a `conflict`
  result and a "reload" message — `confirmed_price` is left untouched (the comp
  is preserved). After reload + re-save it succeeds.
- Deposit-only and quote-note-only saves still succeed. The
  `depositExceedsTotal` warn-and-fix flow from PR-1 still works.
- The `manual` pricing-audit event's `oldTotal` is accurate (no stale snapshot).
- `npm run typecheck` clean. No new migration, no auth-model change.

## Problem

After PR-1, the per-line comp path (`apply_line_override`) and the add-on
auto-reversal path (`reverse_add_on_comps_and_clear`) mutate `bookings
.confirmed_price` atomically, under a `SELECT … FOR UPDATE` lock. The **manual**
PricingEditor path (`updateBidPricing`) still does a read-then-write of an
absolute value with no lock:

1. read `confirmed_price` / `estimated_price` (for the audit `oldTotal`)
2. `UPDATE bookings SET confirmed_price = <typed value>, deposit_amount = …`
3. append the `manual` pricing event

Two races remain:

- **Manual vs. comp (the real one).** A comp can commit in the gap between (1)
  and (2). The manual `UPDATE` then writes an absolute headline that **drops the
  comp's delta**. The override row still exists (the line still renders
  "Comped"), but `confirmed_price` no longer includes it — the line-items net
  total and the charged headline disagree until someone re-comps or reverses.
- **Stale audit `oldTotal`.** The `oldTotal` snapshot from (1) can be out of date
  by (2), so the timeline's "from" figure is wrong.

Both are low-probability at launch scale (needs two staff editing one bid's
price within a few seconds), and the customer is still charged exactly what the
admin last typed — but it is a real money/display inconsistency, not cosmetic.

## Decision

Use **optimistic concurrency** (compare-and-swap), not a locked SECURITY DEFINER
RPC.

- **Why not the locked RPC (option 1).** The manual path's authorization today is
  the `bids`/`bookings` **RLS update policies** (incl. property-manager
  scoping) — the action does no explicit role check. A `FOR UPDATE` requires a
  SECURITY DEFINER function that **bypasses RLS**, so we'd have to relocate that
  authorization into hand-written action/RPC code and re-implement property
  scoping. That is a security-sensitive refactor that deserves its own PR; not
  worth it for a low-probability race.
- **Why optimistic concurrency (option 2).** It keeps the write on the admin's
  RLS client (authorization unchanged), needs no new DB object, and fully
  prevents the clobber: if `confirmed_price` changed since the editor loaded it,
  the guarded `UPDATE` matches 0 rows and we reject with "reload." It also fixes
  the stale-`oldTotal` problem for free (on success, the value at write time is
  provably the loaded value).

`confirmed_price` is `numeric(10,2)` and every writer rounds to cents, so exact
equality in the guard is safe (no float drift). We guard only `confirmed_price`
— `estimated_price` is immutable after creation, and comps never touch it.

## Changes by file

### 1. `src/services/admin/update-bid-pricing.ts`
- Add `expectedConfirmedPrice: number | null` to `UpdateBidPricingInputSchema`
  (the effective `confirmed_price` the editor loaded; `null` when the bid was
  priced by estimate only).
- Replace the unguarded booking update with a **compare-and-swap**:
  - `let q = supabase.from("bookings").update({ confirmed_price, deposit_amount }).eq("id", bookingId)`
  - guard: `expectedConfirmedPrice === null ? q.is("confirmed_price", null) : q.eq("confirmed_price", expectedConfirmedPrice)`
  - `.select("id")` and inspect the returned rows.
  - **0 rows ⇒ conflict** (and the booking still exists): return
    `{ ok: false, conflict: true, error: "This bid's price changed since you opened the editor — reload to see the latest before saving." }`.
    Do **not** proceed to the `bids` quote-note update.
- Add `conflict?: boolean` to `UpdateBidPricingResult` so the UI can show a
  distinct reload affordance.
- Compute the audit `oldTotal` from the (now-proven) `expectedConfirmedPrice ??
  estimated` instead of the separate pre-read; drop the stale snapshot read.
  Keep the "only record movement > half a cent" guard and the injected
  `auditClient` (R4, already in place).

### 2. `app/admin/bids/[id]/edit/actions.ts`
- No logic change; the new field flows through `UpdateBidPricingRawInput`. The
  service already returns `{ ok:false, conflict }` which the action passes back.

### 3. `src/components/admin/pricing-editor.tsx`
- Pass `expectedConfirmedPrice: confirmedPrice` (the loaded prop) in **both**
  submit paths — the manual save (~line 98) and the "apply suggested quote"
  quick action (~line 122).
- On a `conflict` result, show the message and a **Reload** affordance
  (`router.refresh()`), and keep the admin's drafts so they can re-apply after
  seeing the latest. Generic (non-conflict) errors stay as today.

### 4. Types
- `UpdateBidPricingRawInput` gets `expectedConfirmedPrice` (number | null).
  The editor passes a number/null directly (not a money string), so it bypasses
  `moneyField`'s string transform — model it as `z.number().nullable()`.

## Edge cases

- **Loaded `confirmed_price` was null, comp set it.** Guard is `.is(null)`; the
  comp made it non-null ⇒ 0 rows ⇒ conflict. Correct.
- **Deposit-only edit after a `depositExceedsTotal` warning.** Admin loads the
  post-comp `confirmed_price`, lowers the deposit, saves. No further comp ⇒
  guard passes. The flow is unaffected.
- **Manual vs. manual.** Second save sees a changed `confirmed_price` ⇒ conflict
  ⇒ reload. Replaces silent last-writer-wins with an explicit reload (better).
- **quote_note-only edit (price unchanged).** `expectedConfirmedPrice` equals
  current ⇒ guard matches ⇒ proceeds. (The booking `UPDATE` re-writes the same
  `confirmed_price`; that's a no-op value-wise.)
- **bookings update succeeds, bids quote-note update fails.** Same two-statement,
  non-transactional behavior as today — not made worse. Acceptable; note in PR.

## Testing

- Manual UI: open PricingEditor on a bid; in another session apply a comp to a
  line; submit the editor ⇒ expect the conflict message + Reload, and
  `confirmed_price` unchanged (comp preserved). Reload, re-save ⇒ succeeds.
- Manual UI: deposit-only and note-only saves still succeed.
- Audit: after a successful manual save, the `manual` pricing event's `oldTotal`
  equals the value shown before the edit (no stale figure).
- Regression: comp → reverse, add-on auto-reversal, and the
  `depositExceedsTotal` warning flow all still behave as in PR-1.

## Non-goals

- No SECURITY DEFINER RPC for the manual path; authorization stays in RLS.
- No change to the override or auto-reversal RPCs (already atomic).
- No transaction wrapping the bookings + bids two-step (pre-existing; separate
  concern if ever needed).

## Risk / rollback

Low. One new optional input field + a `WHERE confirmed_price = expected` guard;
no schema migration, no auth-model change. Rollback = drop the guard and the
field. The only behavior change for users is that a price save during a
concurrent change now asks for a reload instead of silently winning.

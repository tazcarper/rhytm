# L1 — Deposit expiry: do unpaid deposits auto-expire a confirmed bid?

**Category:** Bid lifecycle (App 6 — Stripe deposit / App 3 — Admin Portal)
**Status:** Open · surfaced 2026-06-01
**Blocks:** Whether we build an automated bid-expiry job (Inngest) and, if so, what deadline it keys off of

## Context — what the code does today

When staff **confirm** a bid, the guest can then sign the waiver and pay the deposit. A
trigger stamps `bids.expires_at = now() + 7 days` at confirmation, and the parent booking
holds its slot the whole time.

**Nothing currently auto-expires or auto-cancels a confirmed bid.** The `expired` status,
the polling index, and an Inngest `bid/expired` event schema all exist, but **no job fires
them**. A confirmed-but-unpaid bid holds its slot indefinitely; the only ways to release it
today are a manual **deny** or **refund**.

## Decided (2026-06-01) — no auto-cancel for sign / pay before the event

We are **not** auto-cancelling a confirmed bid just because the waiver isn't signed or the
balance isn't paid ahead of time. Guests can sign and settle once they're on the property,
so a hard pre-event cancel would only create friction and lose us bookings.

## The open question — deposits specifically

A deposit is different from the rest-of-balance: it's the commitment that holds the slot.
So:

1. **If a bid requires a deposit and the deposit is never paid, do we auto-expire the bid
   (and release the held slot)?** Or do we still leave it for staff to chase / cancel
   manually?
2. **If we do auto-expire on an unpaid deposit, how long before the event should that fire?**
   Options to discuss:
   - A fixed window from confirmation (e.g. 7 days, matching the current `expires_at`).
   - A window pegged to the event date (e.g. "release the slot if no deposit by 14 days out").
   - Whichever comes first.
3. **Should the deposit deadline be separate from the overall 7-day bid expiry?** (i.e. a
   short "deposit due within N days" timer distinct from the sign/settle window.) — _Parking
   this until we hear the client's appetite on Q1/Q2; it only matters if they want deposit
   auto-expiry at all._

## Why it matters

- **Slot inventory.** Without deposit-driven expiry, an unpaid hold can block a date that a
  paying guest would have taken. For a property with limited concurrent capacity, a few
  stale holds can quietly choke availability.
- **Admin clarity.** "Confirmed" currently means "approved, slot held, waiting on the guest —
  possibly forever." Staff have flagged this as ambiguous. A deposit deadline gives
  "Confirmed" a definite meaning and a definite end state.
- **Scope.** The answer decides whether we build the Inngest expiry job now (the index +
  event schema are already there) or leave bid release fully manual.

## What it unblocks

- Whether to build the scheduled Inngest expiry function (scaffolding already exists:
  `idx_bids_expiry`, `bid/expired` event in `lib/inngest/events.ts`).
- Whether to add a deposit-specific deadline column/config separate from `bids.expires_at`.
- Admin-UI treatment of overdue holds (auto-expire vs. flag-for-staff).

## Recommendation (to propose, not assume)

Lean toward **auto-expiring only on an unpaid deposit**, on a window pegged to the event date
(release the slot if no deposit by N days out), and **keep no auto-cancel** for the
sign/settle steps per the 2026-06-01 decision. This protects inventory where it actually
matters (the slot-holding commitment) without punishing guests for finishing paperwork
on-site. Pending the client's preferred N.

## Answer

_(pending — discuss with client)_

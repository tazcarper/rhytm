# A1 — Deny / refund reason visibility to guest

**Category:** Admin operations (App 3 — Admin Portal, pre-build)
**Status:** Open · surfaced 2026-05-24
**Blocks:** Whether `bids.internal_notes` is surfaced on the denied-bid page or kept staff-only

## The question

When staff denies a bid or issues a refund on a customer's deposit, should the customer see the reason staff entered — or just a generic message like "This booking is no longer available"?

Three concrete patterns:

| Pattern | What the guest sees | What the team sees |
|---|---|---|
| **Generic to guest** | "This booking is no longer available." | The full reason in `internal_notes` |
| **Transparent to guest** | The literal note staff entered (e.g., "instructor unavailable that day") | Same |
| **Generic + offer to discuss** | "This booking is no longer available — reply to this email and we'll explain and find another date." | Full reason in `internal_notes` |

## Why it matters

- Showing the literal reason is transparent and helps the guest understand what happened. But raw internal notes can be awkward ("instructor sick" worries the guest; "double-booked" exposes operations).
- Generic messaging avoids those awkward moments but feels dismissive if the guest paid a deposit.
- The hybrid pattern (generic + invitation to talk) preserves the team's privacy on operational details while making the guest feel taken care of.

## What it unblocks

Whether `bids.internal_notes` is surfaced on the denied-bid public page or kept staff-only. Implementation differs by ~30 lines.

## Recommendation

Default to generic-to-guest, full-detail-internal — that's what most ops teams prefer because it gives them flexibility. Easy to flip later if preference changes. The hybrid version (generic + invitation to reply) is worth considering as a future enhancement.

## Answer

_(pending)_

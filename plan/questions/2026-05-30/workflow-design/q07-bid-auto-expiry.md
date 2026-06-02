# Q7 — Bid auto-expiry and the 48-hour follow-up

**Category:** Workflow design
**Status:** Open · surfaced 2026-05-30

Two sub-questions here. (See also the later refinement in
`plan/questions/2026-06-01/` on deposit-specific expiry — L1.)

## 7a — Should unsigned bids auto-expire?

Without expiry, an instructor's calendar stays blocked indefinitely by every
unsigned bid. The vision called for a 24h reminder + 48h human follow-up; we
also need to know when to *release* the slot.

**Recommendation:** auto-expire after 7 days, with a team warning at day 5.
Adjustable per property if needed.

## 7b — How should the 48-hour human follow-up surface?

When a bid is sent but unsigned at 48h, who/how gets prodded?

- Email to the team
- **HubSpot task assigned to the concierge who owns the deal** (recommended)
- Admin UI flag (visible on the bids queue, no push notification)
- Some combination

**Recommendation:** HubSpot task. Keeps follow-up traceable in the CRM you
already use; doesn't add another inbox to watch.

## Answer

_(pending)_

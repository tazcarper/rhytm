# Q7 — Bid expiry and 48-hour follow-up mechanism

**Category:** Bid Workflow
**Status:** Open · surfaced 2026-05-14 · restated in the 2026-05-30 packet
**Blocks:** Inngest reminder workflow design · instructor availability release logic · HubSpot webhook event list

## Context

The vision specifies an automated nudge at 24 hours unsigned and a human
follow-up at 48 hours. Two open decisions:

1. **Auto-expiry.** Does an unsigned bid become void after a set period (e.g., 7 days), freeing the instructor slot for other bookings? Without expiry, instructor availability is held indefinitely by unsigned bids. **Recommended:** auto-expire at 7 days with a team warning at day 5.
2. **The 48-hour human follow-up.** Does the system email the responsible team member, create a HubSpot task, or surface a flag in the admin UI? **Recommended:** HubSpot task assigned to the concierge who owns the deal, keeping follow-up traceable in the CRM.

## The questions

- Should unsigned bids auto-expire, and if so after how many days?
- How should the 48-hour human follow-up be surfaced — email to the team, HubSpot task, admin UI flag, or some combination?

## Answer

_(pending)_

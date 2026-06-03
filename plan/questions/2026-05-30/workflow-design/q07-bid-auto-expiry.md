# Q7 — Bid auto-expiry and the 48-hour follow-up

**Category:** Workflow design
**Status:** Resolved 2026-06-03 · surfaced 2026-05-30

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

**Decided 2026-06-03.**
- **7a (auto-expiry):** NO. Unsigned/unpaid confirmed bids are never auto-expired or
  auto-cancelled (upholds the 2026-06-01 no-auto-cancel decision). Deposit-driven release
  is also off for now — see [[L1]] (`l1-deposit-expiry-policy.md`), revisitable.
- **7b (follow-up channel):** a **per-property staff inbox** (`properties.notification_email`),
  not HubSpot tasks (HubSpot access isn't set up yet — see H1).
- **Timing/shape:** a **single consolidated daily digest** at the 48h threshold (config-in-DB
  on `reminder_settings`), not a per-bid nudge — one email per property listing its
  confirmed-but-unsigned bids.

Built as App 9 sub-phase 9.8 (`send-unsigned-bid-digest.ts`) — see TRACKER.

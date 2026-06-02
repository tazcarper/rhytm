# Q1 — From address for booking emails

**Category:** Email configuration
**Status:** Open · surfaced 2026-05-30
**Blocks:** `RESEND_FROM_EMAIL` in Vercel · flipping production email from dev-table logging to real inbox delivery

## The question

What email address should outbound booking emails come from? Resend is fully
integrated and tested; the send goes out from your verified `send.rhythm.co`
domain. Options:

- **`bookings@send.rhythm.co`** — clear purpose, transactional norm (recommended)
- `noreply@send.rhythm.co` — discourages legitimate replies; less warm
- `hello@send.rhythm.co` — warmer, invites conversation

## Recommendation

`bookings@send.rhythm.co`.

## Answer

_(pending)_

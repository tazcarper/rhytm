# Q3 — Reply-to inbox

**Category:** App 8 — Resend / outbound email
**Status:** Open · surfaced 2026-05-24
**Blocks:** `RESEND_REPLY_TO` env var in Vercel

## The question

When a customer hits "Reply" on a booking confirmation, where should the reply go? Candidates:

- **`hello@rhythm.co`** — apex domain, lands in whatever inbox the client already monitors on Google Workspace
- **A specific staff member's inbox** — e.g., a concierge or operations lead
- **A shared inbox the client already monitors** — e.g., `bookings@rhythm.co`, `concierge@rhythm.co`

Whichever inbox is chosen, confirm that **someone is actually reading it**.

## Why it matters

Customers WILL reply to booking emails — to ask questions, request changes, confirm details. Without an explicit reply-to, Resend's default behavior varies by email client; some replies bounce, some land at `bookings@send.rhythm.co` which no human reads. Either way, the customer thinks they reached us, but no one is actually there.

A missed reply often becomes a missed booking — or a bad review.

## What it unblocks

The `RESEND_REPLY_TO` environment variable in Vercel.

## Recommendation

Pick the inbox that's already monitored daily, not a new one created for this. The dependency we're avoiding is "we need to remember to check this address."

## Answer

_(pending)_

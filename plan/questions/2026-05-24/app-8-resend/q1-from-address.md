# Q1 — From address for booking emails

**Category:** App 8 — Resend / outbound email
**Status:** Open · surfaced 2026-05-24
**Blocks:** `RESEND_FROM_EMAIL` env var in Vercel · production email delivery

## The question

What email address should outbound booking emails come from? Options on the already-verified `send.rhythm.co` domain:

- **`bookings@send.rhythm.co`** — describes the purpose; what I'd default to
- **`noreply@send.rhythm.co`** — standard transactional pattern; signals "don't reply here" but discourages legitimate customer questions
- **`hello@send.rhythm.co`** — warmer tone; pairs naturally with a `hello@rhythm.co` reply-to
- Something else

## Why it matters

This is the literal "From:" header recipients see on every booking confirmation, deposit receipt, and refund notice. Sets the tone of the entire transactional email program. Hard to change later without retraining customer expectations — once people learn "expect mail from `bookings@`", changing it can trigger "is this real?" reactions.

## What it unblocks

The `RESEND_FROM_EMAIL` environment variable in Vercel. Until it's set, production cannot send (the factory falls back to logging-only mode).

## Recommendation

`bookings@send.rhythm.co` if the team treats booking confirmations as transactional. `hello@send.rhythm.co` if they want to invite a conversation.

## Answer

_(pending)_

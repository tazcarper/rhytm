# Q2 — Display name in the From header

**Category:** App 8 — Resend / outbound email
**Status:** Open · surfaced 2026-05-24
**Blocks:** Email service implementation shape

## The question

Should the friendly display name in the From header be a single "Rhythm Outdoors" across all emails, or branded per-property?

- **Single:** Every booking email says `Rhythm Outdoors <bookings@send.rhythm.co>` regardless of property.
- **Per-property:** Booking at HBSC shows `Horseshoe Bay Sporting Club <bookings@send.rhythm.co>`; booking at Hog Heaven shows `Hog Heaven Sporting Club <…>`; etc.

## Why it matters

Per-property branding is more relevant to the recipient — the email feels like it's from "the place I booked" rather than the parent brand they may not know. But it adds template complexity: we thread `property` through every `getEmailService()` call site and template render.

A single "Rhythm Outdoors" is simpler and works fine if the customer already knows which property they booked (they did just go through that property's booking flow).

## What it unblocks

Whether `RESEND_FROM_EMAIL` is a static env-var value (current design) or whether we need to compose `from` per-call with the property in the loop. The latter is ~10 lines of code, just deliberate.

## Recommendation

Single "Rhythm Outdoors" unless there's a strong preference. The property is named clearly in the email body — the From header doesn't need to repeat it.

## Answer

_(pending)_

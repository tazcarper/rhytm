# Q4 — Existing Resend usage on `send.rhythm.co`

**Category:** App 8 — Resend / outbound email
**Status:** Open · surfaced 2026-05-24 · low priority
**Blocks:** Confidence check; nothing immediately gated

## The question

What is the existing Resend account on `send.rhythm.co` currently being used for? Is it actively sending email today, or was it set up speculatively and unused?

- Marketing campaigns? (newsletters, promotions)
- Other transactional email? (account notifications, password resets for some other system)
- Nothing yet?

If it's actively used, are we okay sharing the same sending domain for booking emails — or would you rather we use a dedicated subdomain like `bookings.rhythm.co` to keep deliverability reputation isolated?

## Why it matters

Resend tracks deliverability reputation **per domain**. A spam complaint on a marketing blast from `send.rhythm.co` can lower the inbox-placement rate for transactional booking emails from the same domain. Same the other way around — a booking-receipt complaint could affect marketing campaigns.

In practice, separation is most useful when one side has high volume or high complaint risk (marketing usually). For a low-volume booking flow, sharing the domain is fine.

## What it unblocks

Either confidence to proceed with the current setup as-is, or a decision to add a dedicated subdomain in Resend (additional DNS records on Netlify, ~10 min of work).

## Recommendation

Most likely fine as-is. Worth a quick "what's it being used for?" check so we don't get surprised later.

## Answer

_(pending)_

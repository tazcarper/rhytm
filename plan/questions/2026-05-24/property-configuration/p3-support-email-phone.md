# P3 — Support email and phone per property

**Category:** Property configuration
**Status:** Open · surfaced 2026-05-24
**Blocks:** `properties.support_email` / `properties.support_phone` seeds · rendering of contact info on bid pages and emails

## The question

What email address and phone number should appear on each property's:
- Booking confirmation email (in the footer or body)
- Bid page (for guests who want to ask questions before signing/paying)
- Admin settings page (so staff knows what's been published)

Two structural options:

- **Same across all three properties** (one corporate email + phone — e.g., `hello@rhythm.co`, single number)
- **Different per property** (each location has its own concierge address and phone)

If different per property, please provide values for:
- Horseshoe Bay Sporting Club: email + phone
- Hog Heaven Sporting Club: email + phone
- Packsaddle Precision: email + phone

## Why it matters

Guests use these contact methods to:
- Ask questions before signing a bid
- Request changes (date, guest count, disciplines)
- Reach a human if something goes wrong (e.g., GPS doesn't find the property)

Today the admin form shows the literal placeholders `hello@example.com` and `(555) 555-5555`. These would look unprofessional if a guest saw them.

## What it unblocks

`properties.support_email` and `properties.support_phone` seed values per property. Also unblocks rendering these on bid pages and in email footers (currently hidden until they're populated, to avoid showing placeholder text to guests).

## Recommendation

Same across properties unless each property has a different concierge / front-desk number. Simpler to manage and easier for the team to handle when one inbox sees all customer requests.

## Answer

_(pending)_

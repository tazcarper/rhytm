# H1 — HubSpot account access & credentials

**Category:** App 9 — HubSpot CRM sync
**Status:** Open · surfaced 2026-05-31 · medium priority
**Blocks:** App 9 sub-phase 9.4+ (HubSpot deal sync) — currently blocked on client config, not technical readiness

## The question

To build the one-way sync that pushes booking/bid events into HubSpot, we need access to your HubSpot account. Specifically:

1. **A Private App access token.** In HubSpot: *Settings → Integrations → Private Apps → Create a private app*, scoped to CRM objects (`crm.objects.deals`, `crm.objects.contacts` read/write at minimum). Send us the token via a secure channel (not plain email). We store it as `HUBSPOT_API_KEY` in Vercel — never in the repo.
2. **Which HubSpot account / portal ID** this should write to, if you have more than one.

### Related — pipeline shape (also blocks the same work)

Even with credentials, we can't map events to deals until we know your pipeline:

- What are your **deal stages**, in order? (e.g. Inquiry → Bid Sent → Signed → Deposit Paid → Fulfilled)
- Do all three properties (Horseshoe Bay, Hog Heaven, Packsaddle) share **one pipeline**, or does each get its own?
- Any required custom properties on a deal we'd need to populate?

## Why it matters

HubSpot is downstream of the app — the database is the source of truth, and we push events to HubSpot (inquiry created, bid published, bid signed, deposit paid, bid expired, booking fulfilled). That sync is designed and tracked but completely unbuilt: there's no SDK dependency, no credentials, and no sync code yet. It's deliberately deferred until you can hand over CRM access and tell us the pipeline shape — both are client config, not engineering blockers.

## What it unblocks

App 9 sub-phase 9.4+. Once we have the token + pipeline definition, we wire the `@hubspot/api-client` SDK, add the `hubspot_deal_id` column to `bookings`, and build the Inngest functions that fire on each lifecycle event.

## Recommendation

No rush if App 9 isn't imminent — but creating the Private App and sending the token is a 10-minute task on your side whenever convenient, and the pipeline-stage list is something you can sketch in an email. Getting both early means we can slot the integration in without a back-and-forth.

## Answer

_(pending)_

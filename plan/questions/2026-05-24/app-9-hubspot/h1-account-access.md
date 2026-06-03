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

## Testing approach (decided 2026-06-03)

We can develop against a **temp / sandbox HubSpot account** and switch to the real one later — but "swap the API key" alone isn't enough, because pipelines, stages, and custom properties have **account-specific IDs**. So the integration will be built **config-driven** (pipeline ID + a stage→stage-ID map in DB/env config, HubSpot deal/contact IDs stored back on our records). Then cutover = swap token + remap a few IDs, not a code change.

We still want a brief look at the **real account's** pipeline + property shape before go-live so we map onto the client's actual process instead of creating a duplicate pipeline — that's a one-time discovery (`GET /crm/v3/pipelines/deals` + property list), not a rebuild. Best case if they're on Pro/Enterprise: a **sandbox** that mirrors their real setup.

## Client-ready ask (drafted 2026-06-03)

> **Subject: HubSpot setup — connecting your bookings to your CRM**
>
> As part of the booking system, we want every inquiry to flow automatically into your HubSpot as a deal that moves through your pipeline on its own — created when someone requests a booking, then advancing as they're confirmed, sign the waiver, pay the deposit, and finish their visit. No manual data entry on your end. To build it so it fits *your* HubSpot (not a duplicate setup), I need:
>
> **1. Which HubSpot plan are you on?** (Free / Starter / Professional / Enterprise.) Tells me whether we can test in a "sandbox" copy of your account.
>
> **2. How should bookings show up?** (a) flow into your **existing pipeline** (we match your stages), or (b) a **dedicated "Bookings" pipeline** we set up separately. Unsure is fine — I can look and recommend.
>
> **3. Access — a Private App token** (a scoped key you can revoke anytime):
> - HubSpot → ⚙️ **Settings → Integrations → Private Apps → Create a private app**
> - Name it "Rhythm Booking Sync"
> - **Scopes** tab → enable **CRM → Contacts (read + write)**, **Deals (read + write)**, **Deals schema (read)**
> - **Create app**, copy the **access token**, send it securely (not plain email)
> - *Easier alternative:* just add me as a user ([your email]) and I'll create the token myself.
>
> While we build, we'll work in a test/sandbox account or in a way that won't touch your live deals — nothing hits real data until you sign off, and the token only has the permissions above. Once I have read access I can pull your pipeline/field setup myself, so there's nothing for you to export.

## Answer

_(pending)_

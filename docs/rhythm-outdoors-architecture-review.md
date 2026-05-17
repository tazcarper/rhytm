# Rhythm Outdoors — Architecture Review & Stack Proposal

**Prepared for:** Nicholas Vedros, Founder
**Prepared by:** Technical consultant, vendor-neutral
**Scale assumption:** ~2,000–3,000 paying customers/year. High-value bookings, memberships, and partner group rates. Reliability matters more than raw speed.

---

## What We Are Building

One web application serving three properties — Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, and Packsaddle Precision — from a single codebase. Three distinct portals, one backend:

- **Public portal** — Any guest can configure an experience, see live pricing, and submit an inquiry.
- **Member portal** — Authenticated members see preferred pricing, exclusive programming, their booking history, and their household. The system knows who they are the moment they log in.
- **Partner portal** — Hotel and resort concierges log in, configure group experiences at pre-negotiated rates, and generate a bid without a single email to the Rhythm team.

Every portal leads to the same outcome: a **bid page** — a permanent, bookmarkable URL the guest receives with their gear list, schedule, map, FAQ, and an embedded signature and deposit. They sign and pay on the same page. The team gets a confirmed booking without a phone call.

---

## The Problem with the Original Stack

The original plan had no central database. Booking records lived in HubSpot, pricing rules lived in Notion, payments lived in Square, waivers lived in Smart Waiver, and calendar slots lived in Acuity — five separate systems with no way to talk to each other. The result:

- Answering "what did this guest book and what did they pay?" required opening five tabs.
- Double-bookings were possible because no single system owned availability.
- A booking could be "confirmed" in one system and unknown to another.

The decided stack fixes this at the foundation. Everything else follows from that one change.

---

## Decided Stack

| Layer | Tool | Role |
|---|---|---|
| Frontend + API | Next.js on Vercel | The web application — all three portals and the admin dashboard |
| Database | Supabase | Single source of truth for all bookings, members, pricing, and bids |
| Auth | Supabase Auth | Login for members, partner concierges, and internal staff |
| Payments | Stripe | Deposit and payment on the bid page |
| Email | Resend | All automated emails from concierge@send.rhythm.co |
| E-sign | Dropbox Sign | Signature embedded in the bid page — no third-party redirect |
| File storage | Vercel Blob | Bid PDFs, property photos, signed documents |
| CRM | HubSpot | Marketing and sales pipeline — fed by the app, never the source |
| Workflows | Inngest | Automated sequences: reminders, follow-ups, pre-event emails |
| Observability | Sentry + Axiom | Error alerts and log search so problems surface before guests notice |

**Estimated monthly infrastructure cost:** $50–200/month at current scale.

---

## Why Each Tool Was Chosen

### Supabase — the foundation everything else builds on

Every booking, member record, pricing rule, bid, and payment reference lives in one Supabase database. When a guest pays, the booking updates instantly. When a member logs in, their history is there. When two bookings come in at the same moment for the same instructor slot, the database rejects the second one automatically — double-bookings become physically impossible.

Members log in with their email address and receive a one-time sign-in link — no password to forget, no reset flow to build. Partner concierges and internal staff use the same login system. One auth system for all three portal types, managed in one place.

**What goes wrong without it:** A guest calls to ask if their deposit cleared. The team checks five systems. One says paid. Another hasn't updated yet. A second guest books the same instructor in the window between those updates. Two groups show up for the same 10am slot.

### Notion → pricing stays in Notion as documentation, not as a live system

Notion is a documentation tool. The original plan used it to calculate prices in real time as guests configured their booking — every time a guest changed their guest count or selected a discipline, the form asked Notion for the updated price. Notion's API is too slow and too limited for this job: it can only handle a few requests per second, and responses can take up to a second, making live price updates unreliable.

Pricing rules now live in Supabase, editable through a simple internal admin page. A GM updates a rate, hits save, and it's live immediately — no developer required, no deployment, no downtime. Notion keeps its rightful role: documentation of *why* every rate exists, policies, and institutional knowledge.

**What goes wrong in practice:** A concierge is on the phone with a Horseshoe Bay Resort coordinator, configuring a 40-person group bid. Notion stops responding mid-session. The form freezes. The concierge loses the configuration and tells the coordinator "let me get back to you" — the exact outcome this system was built to prevent.

### HubSpot → marketing and sales pipeline only

HubSpot is excellent at marketing automation and sales pipeline management. It is not a booking system. HubSpot updates on a delay — sometimes several minutes — and was never designed to check real-time availability or act as the system of record for a live transaction.

HubSpot now receives a notification every time something meaningful happens in the app: new inquiry, bid sent, bid signed, deposit paid, booking fulfilled. The team's pipeline stays current. But HubSpot is downstream — the app is always the authority.

**What goes wrong in practice:** A guest pays their deposit. The team checks HubSpot — it still shows the bid as unsigned because the update hasn't processed yet. The team tells the guest they don't see the payment. The guest is frustrated. Meanwhile, the same delay causes HubSpot to show an instructor's slot as still available, and a second booking is granted for the same time. Two groups, one instructor.

### Netlify Functions → Vercel + Inngest

The original plan used Netlify to coordinate between five different systems. When something went wrong mid-sequence — a rate limit, a brief outage, a slow response — Netlify had no way to retry or recover. The failure was silent. No one knew a booking was lost until a guest complained.

Inngest replaces this with reliable, trackable workflows. Every automated sequence — inquiry received, confirmation email sent, bid reminder at 24 hours, follow-up at 48 hours, pre-event emails in the days before the experience — runs as a guaranteed series of steps. If one step fails, it retries automatically. The team can see every workflow, every step, every failure in a dashboard.

**What goes wrong in practice:** A guest submits an inquiry Saturday evening. The confirmation email step fails silently. The guest hears nothing, assumes something went wrong, and calls a competitor Monday. Six months later the team notices inquiry volume seems low — but there's no way to know how many inquiries were lost this way.

### Google Drive → Vercel Blob

Google Drive works well for the team's internal documents. For customer-facing assets — the photos on a bid page, the gear list PDF, the signed waiver — Drive is the wrong tool. It has no fast delivery network, and its authentication tokens expire periodically, silently breaking every page that uses them.

All customer-facing files now live in Vercel Blob, which is built for exactly this: fast, reliable delivery anywhere in the world.

**What goes wrong in practice:** A guest opens their bid on their phone at the hotel and waits nine seconds for the photos to load. The bid was supposed to be the brand moment they share with their group. Then the Drive authentication token expires overnight. Every bid sent that weekend shows broken images. 

### Square → Stripe

Stripe is the industry standard for web-first payment flows: more stable, more customizable, and better supported for exactly this use case — a deposit embedded in a beautifully designed bid page. Square is better suited to in-person point-of-sale terminals.

**What goes wrong in practice:** Not a lot, but we have much less control and branding.

### Acuity → retired at go-live

Once the new system manages instructor scheduling, Acuity becomes a second, conflicting calendar. Instructors who still use Acuity for personal appointments create gaps the new system can't see. Acuity is retired the day the new system goes live.

**What goes wrong in practice:** An instructor blocks a Thursday afternoon in Acuity. The new system doesn't know. A concierge books that instructor for a private lesson. The bid goes out, the guest signs and pays, and two weeks later the conflict surfaces. The guest has already arranged travel.

### Smart Waiver → Dropbox Sign

Smart Waiver works, but the moment a guest clicks "Sign & Confirm," they're redirected to a third-party page — different URL, different fonts, no Rhythm branding. After a carefully designed bid experience, the guest suddenly feels like they've landed somewhere else. Some abandon.

Dropbox Sign embeds the signature directly in the bid page. Same URL. Same design. No redirect. The signed document, the deposit, and the booking record are all in one place.

**Pre-launch requirement:** Before the first waiver goes live, Rhythm's legal counsel should confirm the waiver language meets Texas liability requirements for firearms activity. Smart Waiver came with pre-reviewed language; Dropbox Sign does not.

### Resend — no change

The email infrastructure is solid. The `concierge@send.rhythm.co` domain is already verified. No change needed.

---

## What Notion Keeps Doing

Notion is not going away — it is being correctly scoped. Notion owns the company Charter, architectural decisions, the *why* behind every pricing rule, operating policies, the Source Documents registry, the FAQ database, and institutional memory. Nothing the customer-facing application touches at runtime comes from Notion.

---

## Summary

The product vision is right. The original technology choices couldn't deliver it. The decided stack gives Rhythm a single system where every booking, member record, and payment lives in one place — and every automated workflow runs reliably from inquiry to confirmed event. The business's data lives in a database Rhythm controls, not scattered across five vendors.


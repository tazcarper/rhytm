# Product

## Register

product

> Note — this is a split-surface app and the default above is a tie-breaker, not a
> ceiling. The bulk of the app and of active work is **product** UI: the admin
> dashboard, the public booking funnel, and the member/partner portals — design
> serves the task there. But the guest-facing **public site and bid pages**
> (homepage hero, property pages, adventures, the signed bid) are conversion
> surfaces where design *is* the pitch — treat those tasks as **brand** when you
> work on them. When in doubt on a given task, pick the register of the surface in
> focus, not this default.

## Users

Three guest-facing audiences and one staff audience, all on one backend:

- **Prospective guests (public).** People planning an outdoor sporting outing —
  shooting, fishing, a private lesson, a hosted occasion — across three clubs
  (Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, Packsaddle Precision).
  Often on a phone, deciding whether to commit. Their job: figure out what an
  outing looks like, request it, and end up holding a clear price they can sign
  and pay for — without a phone call.
- **Members.** Returning club members managing memberships, bookings, and RSVPs
  for themselves and their household in the member portal.
- **Concierge partners.** Trusted third parties booking on behalf of their own
  clients through the partner portal.
- **Staff (admin).** The people who actually run the clubs — reviewing inquiries,
  setting final pricing, sending bids, and managing every booking, member, bid,
  and piece of site content from a single dashboard. Their job: never juggle five
  tabs, a spreadsheet, and a phone again. The admin is their whole workday surface.

## Product Purpose

Rhythm Outdoors is one web app that runs three outdoor sporting clubs from a single
codebase, three portals, and one database. **Its core outcome: every inquiry ends
as a signed, paid bid page — no phone tag, no spreadsheets, no five open tabs.**

A guest picks a club and builds a booking (date, time, activities). Staff review
it, set the final price, and send back a **bid** — a private, access-code-gated web
page holding the schedule, gear list, a liability **waiver** to sign, and a
**deposit** to pay. When the guest signs and pays, the booking locks and the bid
page becomes their confirmation.

Success looks like: a prospect goes from "I'm curious" to "signed and deposited"
without ever speaking to a person, and a staff member runs a club's entire booking
operation from one screen.

## Brand Personality

**Refined heritage.** Quiet, understated, confident — an old sporting-club
tradition that lets the land and the experience speak rather than shouting about
them. The current system already carries this voice: an earth-toned palette
(olive / tan / cream / paper), a Cormorant Garamond serif paired with Inter, sharp
low radii, soft elevation, generous restraint.

- **Three words:** refined, grounded, trustworthy.
- **Voice:** plain-spoken and warm, never corporate or salesy. It explains, it
  doesn't pitch. A concierge who knows the property, not a call-center script.
- **Emotional goal (guest):** the calm confidence of being well looked-after —
  enough credibility to hand over a deposit without hesitation.
- **Emotional goal (staff):** control and clarity — the system holds the details so
  they don't have to.

## Anti-references

This should explicitly NOT look like any of:

- **A generic SaaS dashboard.** No Linear/Stripe-clone gray-card sameness, no
  identical icon-heading-text card grids repeated down the page, no soulless
  tool-UI. Even the admin has the brand's point of view.
- **A loud OTA / booking site.** No Expedia/Booking.com urgency theater —
  countdown timers, "only 3 left!" badges, discount confetti, manufactured
  scarcity, hard-sell banners. Pricing is set deliberately by staff and presented
  with confidence, not pressure.
- **A corporate hotel chain.** No sterile, focus-grouped, stock-photo blandness
  with no opinion. The clubs have character; the interface should too.
- **A trendy AI-startup.** No purple gradients, glassmorphism, gradient text, or
  the big-number hero-metric template. Restraint reads as more premium than effects.

## Design Principles

1. **Close the loop, don't decorate it.** Every screen either moves a guest toward
   a signed, paid bid or moves staff toward sending one. A screen that doesn't
   advance the booking is a screen to question. Impressive-for-its-own-sake loses
   to one-step-closer.
2. **The tool disappears into the task.** This is a working surface for staff and a
   high-trust transaction for guests. Reach for earned familiarity — standard,
   trusted affordances — over novelty. Delight is saved for moments (a confirmed
   bid, a signed waiver), not sprinkled on every page.
3. **Quiet confidence, never the hard sell.** Heritage restraint is the brand's
   persuasion. Let price, schedule, and the experience stand on their own; the
   moment the UI starts pushing, it stops feeling premium.
4. **One system across three properties and three portals.** Consistency is a
   feature: a guest or admin learns the pattern once. Variation by property or
   portal lives in configuration and strategy, not in divergent one-off UI.
5. **Trust is the product.** Waivers, deposits, private bid links — this app moves
   money and captures legal consent. Every step must read as credible and careful;
   visual sloppiness reads as financial and legal risk.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**.

- Body text ≥ 4.5:1 contrast against its background; large/bold text ≥ 3:1.
  Watch the muted-gray-on-warm-paper combinations the palette invites — `--gray`
  on `--paper` must clear 4.5:1 or move toward the olive ink end.
- Visible, non-color focus states on every interactive element; full keyboard
  operability across funnel, forms, and admin tables.
- `prefers-reduced-motion` is honored globally (already baselined in
  `app/globals.css`); components may opt back into a critical entrance as a
  fade/crossfade, never as a hard requirement to see content.
- Mobile-first reality: guests are often on phones outdoors — adequate touch
  targets and legibility in bright ambient light matter.
- Don't encode meaning in color alone (booking/bid status, errors): pair with text,
  icon, or shape.

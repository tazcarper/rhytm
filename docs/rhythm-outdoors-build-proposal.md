# Rhythm Outdoors — Build Proposal
**Version:** 1.0 · May 2026
**Status:** Decisions locked. Open questions catalogued in `need_answers.md`.

---

## What We Are Building

One custom web application serving three properties (Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, Packsaddle Precision), three audience types (public guests, members, hotel/resort partners), and one internal team — all from a single codebase and a single database. From interest to confirmed booking in fifteen clicks or fewer.

The application replaces: Notion on the hot path, HubSpot as a booking system, Netlify as an orchestrator, Google Drive as an asset server, Acuity, and Smart Waiver. It keeps: HubSpot (scoped to marketing only), Notion (scoped to documentation only), Google Drive (scoped to internal documents only), and Resend.

---

## Decided Stack

| Layer | Tool | Role |
|---|---|---|
| Frontend + API | Next.js on Vercel | Full-stack framework; API routes handle server-side logic |
| Database | Supabase (Postgres) | System of record for all bookings, inventory, pricing rules, and member data |
| Auth | Supabase Auth + RLS | All portal auth — members, partners, staff — tied to database row-level security |
| Payments | Stripe | Web-first deposit and payment flows; webhook-driven confirmation |
| Email | Resend | All transactional email from concierge@send.rhythm.co |
| E-sign | Dropbox Sign | Embedded waiver and bid signature; replaces Smart Waiver |
| File storage | Vercel Blob | Bid PDFs, brand images, signed documents; replaces Drive on the hot path |
| CRM | HubSpot | Marketing and sales pipeline only; synced downstream via webhook |
| Pricing rules | `pricing_rules` table in Supabase | Replaces Notion on the hot path; editable via internal admin UI |
| Workflows | Inngest | Multi-step async flows with retries, idempotency, and execution timeline |
| Observability | Sentry + Axiom | Error tracking + log search |

---

## Locked Architectural Decisions

### 1. One Supabase project for all three properties
All properties share one database. `property_id` is a foreign key on every table that belongs to a property. Cross-property queries (reporting, a concierge building a bid for any property) are native SQL joins — no cross-database gymnastics. The three properties have one owner; shared data is appropriate.

### 2. Member authentication — email + magic link
Members log in with their email address and receive a one-time link. No password to forget, no reset flow to build. Supabase Auth handles this natively. The member number (e.g., 17690) becomes a display field on their profile, not an auth credential. The existing Excel roster is seeded into Supabase at launch; each member receives a portal invite email.

*(Pending: Q1 in `need_answers.md` — roster email coverage)*

### 3. Partner authentication — individual concierge accounts linked to organizations
Each hotel/resort partner organization has a record in the `partner_organizations` table. Each concierge at that hotel gets their own Supabase Auth account linked to their organization. When a concierge builds a bid, their user ID is on the record — Rhythm always knows who built it. Deprovisioning is a single account disable, not a shared password rotation.

### 4. Payments — Stripe
Stripe handles all web-facing deposits and payments. Better API, better webhook reliability, better dispute tooling for a web-first booking flow. Stripe Checkout is embedded as a hosted iframe on the bid page — no card data touches Vercel functions, keeping PCI scope clean.

### 5. Inventory model — instructor-centric
The scarce resource is the instructor. A time slot is "taken" when an instructor is booked. The database enforces this with a uniqueness constraint on `(instructor_id, start_time)` — simultaneous double-bookings are physically impossible. Range is a soft field assigned by the team after booking. This is Phase 0, not Phase 7.

*(Pending: Q2 instructor headcount, Q3 self-guided bookings — in `need_answers.md`)*

### 6. Booking record shape
Disciplines are multi-select (a guest can choose sporting clays + wobble deck + pistol bays in one booking). `service_id` as a single FK is wrong — the correct model is a `booking_disciplines` join table. Pricing splits into two moments: `estimated_price` (calculated live as the guest configures the form) and `confirmed_price` (set by the team before the bid is sent). These are never the same field.

```
bookings
  id
  property_id
  audience_type          → public | member | partner
  customer_id
  partner_org_id         → if partner booking
  concierge_user_id      → if partner booking, which concierge
  instructor_id          → hard availability constraint
  range                  → soft field, team-assigned
  guest_count
  start_time / end_time
  status                 → inquiry | bid_sent | signed | deposit_paid | confirmed | fulfilled | cancelled | expired
  estimated_price        → live form calculation
  confirmed_price        → team-set before bid sends
  bid_id                 → FK to bids table
  stripe_payment_intent_id
  hubspot_deal_id
  notes

booking_disciplines
  booking_id
  service_id             → FK to services table
```

### 7. Bid pages — database-driven dynamic routes
Bids are rows in a `bids` table. The URL slug is auto-generated from guest/company name + date (e.g., `fleet-2026-07-12`, `hartwell-mitchell-wedding-2026-09-14`). Next.js renders `/bids/[slug]` server-side on each visit by fetching from Supabase. The page is always current — if the team edits the bid, the guest sees the update on their next visit. The slug can be manually overridden by the team before the bid sends.

```
bids
  id
  booking_id
  slug                   → human-readable, URL-safe
  status                 → draft | published | signed | paid | expired
  gear_list
  schedule
  map_embed
  faq                    → JSON array
  dropbox_sign_envelope_id
  published_at
  expires_at
```

*(Pending: Q6 in `need_answers.md` — when the guest receives the bid URL)*

### 8. HubSpot sync — one-way, downstream only
HubSpot is never on the hot path of a customer transaction. Events flow from the app to HubSpot via webhook. HubSpot never writes back to Supabase.

| App event | HubSpot action |
|---|---|
| Inquiry created | Create Contact (if new) + Create Deal → `inquiry` stage |
| Bid published | Update Deal → `bid_sent` |
| Bid signed | Update Deal → `signed` |
| Deposit paid | Update Deal → `deposit_paid` |
| Bid expired unsigned | Update Deal → `expired`, flag for follow-up |
| Booking fulfilled | Update Deal → `fulfilled` |
| Membership application submitted | Create Contact + Create Deal in membership pipeline |

HubSpot Tickets (customer service issues) are out of scope for the initial build.

### 9. Workflow engine — Inngest
Inngest handles all multi-step async flows: the bid reminder sequence, pre-event emails, post-event follow-up, membership approval, and HubSpot sync. Each step has automatic retries, idempotency keys, and a visual execution timeline. The free tier comfortably covers Rhythm's volume.

**Bid workflow (outline):**
```
Inquiry submitted
  → Save to Supabase
  → Send guest confirmation email (Resend)
  → Create HubSpot deal
  → [Team assembles bid in admin UI]
  → Bid published → send bid URL email to guest
  → T+24h: if unsigned → automated reminder email
  → T+48h: if unsigned → HubSpot task for team follow-up
  → T+7d:  if unsigned → expire bid, release instructor slot, notify team
```

**Post-confirmation workflow (outline):**
```
Booking confirmed (signed + deposit paid)
  → T-14d: gear list + directions email
  → T-3d:  reminder email
  → T-1d:  final confirmation email
  → T+1d:  post-event follow-up email
           (public guests: includes membership application link)
```

*(Pending: Q7 bid expiry/follow-up mechanism, Q15 pre-event cadence — in `need_answers.md`)*

### 10. File storage — Vercel Blob
All app-served assets live in Vercel Blob: generated bid PDFs, signed waiver documents, brand images used on bid pages. One vendor, one bill, native Next.js/Vercel integration. Google Drive remains for internal team documents only and is never accessed by the application at request time.

### 11. Admin dashboard — custom, role-based
A protected section of the Next.js app (`/admin/*` routes) with the following role hierarchy:

| Role | Access |
|---|---|
| `super_admin` | Everything — all properties, pricing, user management, system config |
| `admin` | Same as super_admin minus system configuration |
| `property_manager` | Full access to bookings and members across all properties; no user management |
| `concierge` | Inquiries and bid assembly across **all properties**; no pricing admin, no member records |
| `membership_coordinator` | Membership applications and member records; no booking management |

Concierges are cross-property — a concierge can build a bid for a Hog Heaven hunt the same way they'd build one for an HSB sporting clays event.

*(Pending: Q12 membership coordinator scope, Q13 read-only reporting role — in `need_answers.md`)*

### 12. Member adventures — separate data model
Member adventures (multi-day trips, exclusive events, household RSVP) are structurally different from bookings: the team creates them and members RSVP into them, rather than a guest configuring from scratch. Capacity is the constraint, not instructor availability.

```
member_adventures
  id
  property_id
  title / description
  start_date / end_date
  capacity
  price_per_member
  price_per_household_guest
  status                 → draft | published | sold_out | completed

member_adventure_rsvps
  id
  adventure_id
  member_id
  guest_count
  status                 → confirmed | waitlisted | cancelled
  stripe_payment_intent_id
```

*(Pending: Q14 deposit vs full payment, cancellation policy — in `need_answers.md`)*

### 13. Membership application flow
Same architecture as a bid: reactive form → sign → pay initiation dues → HubSpot deal in membership pipeline. A human approval step is recommended between payment and membership being granted — the team retains the final yes. On approval, Inngest fires: Supabase Auth invite sent to the new member, welcome packet email generated, HubSpot deal advanced to `member_won`.

Membership tiers are property-specific. HSB tiers differ from Hog Heaven tiers. Both need to be defined before the application form can be built.

*(Pending: Q8 approval step, Q9 tiers and fees, Q10 household structure, Q11 Packsaddle membership — in `need_answers.md`)*

### 14. Domain routing
One Next.js application on Vercel serves all domains. The incoming hostname determines which property's branding, content, and pricing renders.

| Domain | Audience | Property |
|---|---|---|
| `intake.rhythm.co` | Public | All properties |
| `partner.rhythm.co` | Partners | All properties |
| `members.horseshoebaysportingclub.com` | Members | HSB |
| `members.hogheavensc.com` | Members | Hog Heaven |
| `{property}.com/bids/[slug]` | Guests | Bid pages per property |

*(Pending: Q11 Packsaddle domain — in `need_answers.md`)*

### 15. Notion — scoped to documentation only
Notion is not leaving the stack. It keeps: Charter, architectural decisions, pricing rule documentation (the *why* behind every rate), policies, Source Documents registry, FAQ database, working history. Notion does not own any runtime data path. Nothing the customer-facing application reads at request time comes from Notion.

### 16. Dropbox Sign — replaces Smart Waiver
Dropbox Sign embeds natively into the bid page — same canvas, same URL, no third-party redirect. Provides timestamp, IP, and document-hash audit trail. Legal review of waiver language is a pre-launch gate before go-live.

---

## What Can Start Now

These areas have no open questions blocking them:

1. **Supabase project setup** — schema design for `properties`, `bookings`, `booking_disciplines`, `services`, `instructors`, `bids`, `partners`, `partner_organizations`
2. **Next.js project on Vercel** — skeleton app, domain routing by hostname, Supabase client setup
3. **Auth flows** — Supabase Auth for staff and partner concierges; magic link flow for members
4. **Stripe integration** — payment intent creation, webhook handler, deposit confirmation flow
5. **Inngest setup** — project scaffolding, event definitions, development environment
6. **Admin dashboard skeleton** — role-based route protection, navigation structure
7. **Public intake form** — multi-step form with discipline selection; estimated price shows as "starting from" until pricing formula is confirmed (Q5)

---

## What Is Blocked Pending Client Answers

See `need_answers.md` for the full list with context. The highest-priority answers needed to unblock the most build work:

| Priority | Question | Blocks |
|---|---|---|
| 1 | Q5 — Pricing formula | Live price calculation, pricing admin UI |
| 2 | Q9 — Membership tiers and fees | Membership application form, Stripe charge amounts |
| 3 | Q1 — Roster email coverage | Member portal launch, Supabase user seeding |
| 4 | Q6 — When guest receives bid URL | Inngest workflow sequence, confirmation email content |
| 5 | Q8 — Membership approval step | Membership Inngest workflow, admin UI approval action |

---

## Open Questions Summary

16 questions in `need_answers.md` across:
- **Auth** (1 question)
- **Inventory & Resources** (3 questions)
- **Pricing** (1 question — most consequential)
- **Bid Workflow** (2 questions)
- **Membership Application** (3 questions)
- **Member Adventures** (1 question)
- **Domain & Property Structure** (1 question)
- **Admin & Roles** (3 questions)
- **Pre-event Communications** (1 question)
- **Recurring Billing** (1 question)

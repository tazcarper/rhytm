# Turning Rhythm Outdoors into a Generalizable Hospitality Template

**Deep research + product strategy report** · 2026-07-08 · branch `big-future-planning`

This report answers one question: *how should the Rhythm Outdoors codebase evolve into a
reusable hospitality template — one well-architected base covering the common 80%, plus a
disciplined mechanism for per-business forks, theming, and vertical-specific booking rules?*

It is organized as: **Phase 0** — an honest inventory of what the app does today (file-referenced);
**Phase 1** — market research on what hospitality businesses across sub-verticals actually need
(externally cited); **Phase 2** — a prioritized gap analysis crossing the two; **Phase 3** — the
template architecture plan; **Phase 4** — a sequenced roadmap; and a one-page executive summary.

---

## Phase 0 — Current Capabilities Baseline

Everything below was verified against the code on 2026-07-08 (90 migrations, `src/services/`,
`app/`, `lib/`, `TRACKER.md`, `plan/`). Claims of *absence* were verified by search, not assumed.

### 0.1 Stack and shape

Next.js 16.2 (App Router, RSC, the `middleware.ts`→`proxy.ts` rename), React 19, Supabase
(Postgres + Auth + Storage), Stripe 22 (PaymentIntents + Payment Element), Resend 6 +
React Email, Inngest 4.5, pdf-lib, Zod 4 (`package.json`). Strict three-tree layout that
matches its own documentation: `app/` is routing artifacts only, `src/` is domain code
(services take injected Supabase clients), `lib/` is infrastructure (client factories,
design-system primitives, storage adapters).

Two corrections to the project's own docs discovered during inventory:

- **Vercel Blob is not used anywhere.** No `@vercel/blob` dependency exists; all file storage
  (waiver PDFs, adventure/homepage/service images) goes through **Supabase Storage** adapters
  in `lib/storage/` (waivers in a private `waivers` bucket).
- **HubSpot is not integrated.** It appears only in code comments as future work
  (`src/services/admin/transition-bid.ts`, `src/services/bookings/create-public-booking.ts:270`).
  There is no client, no API call, no env wiring.

### 0.2 Domain model

Multi-property from day one: the three clubs are **rows in `properties`**
(`supabase/migrations/20260517223212_phase_1_foundation.sql:42`), not tenants — with per-property
operational knobs (`max_concurrent_groups`, `timezone`, `booking_horizon_days` CHECK 1–365,
`notification_email`, support contacts, directions/parking/map).

| Cluster | Tables | Purpose |
|---|---|---|
| Catalog | `services`, `add_ons`, `service_add_ons`, `catering_options`, `instructors`, `time_slots` | Per-property experiences, add-ons (with `max_quantity`, images, detail content), F&B tiers, bookable slot grid |
| Booking | `bookings`, `booking_disciplines`, `booking_add_ons` | Same-day reservation (`start_time` + `duration_hours`), chosen disciplines, add-on lines with `unit_price_at_booking` snapshots |
| Quote/bid | `bids`, `bid_line_items`, `bid_line_overrides`, `bid_pricing_events` | 1:1 customer-facing quote artifact with bcrypt-hashed access code, itemized snapshot lines, append-only comp/waive overrides, pricing audit log |
| Membership | `people`, `memberships`, `membership_people` | Person ↔ account split; household junction with roles (primary/spouse/dependent/authorized); one active primary enforced by partial unique index (`20260518232029_split_members_into_people_memberships.sql`) |
| Adventures | `member_adventures`, `member_adventure_rsvps` | Curated multi-day third-party trips: capacity, per-RSVP guest caps, deposit vs inquire payment modes, waitlist, free-cancellation window, guest manifest |
| Waivers | `waiver_templates`, `waiver_documents` | Versioned config-in-DB waiver text per property (one active version); signed-PDF artifacts with audit trail; standalone/kiosk waivers not tied to a bid (`20260605120000`) |
| Estimates | `estimate_requests` | Lead/CRM object for the `/request-estimate` front door (party composition, jsonb experience selections, indicative total) |
| Staff/partner | `staff_profiles`, `partner_organizations`, `instructor_*` (5 tables) | Staff identity, partner org scaffolding, instructor portal/availability/travel-time matrix |
| Infra | `processed_webhooks`, `rate_limit_hits`, `reminder_settings`, `dev_email_outbox`, `homepage_hero`, `bid_faq_templates` + `bid_gear_templates` (+ scopes) | Webhook idempotency ledger, Postgres sliding-window rate limiter, reminder cadence config, dev email capture, editable homepage, scoped FAQ/gear content library |

**Booking types** are a three-value enum (`plan_a_visit | private_lesson | host_an_occasion`)
whose rules live in **DB CHECK constraints** (duration windows, `private_lesson_requires_instructor`
— `20260517225304_phase_2_booking_system.sql:84`) plus a funnel-side metadata map
(`src/constants/public/booking-types.ts`: default durations, `requiresInstructor`) and a max-guest
function (`src/services/public/pricing.ts:124`: 4 / 100 / 12).

**Availability and double-booking are database-enforced**, exactly as the project's rules demand:

- Ordered booking triggers: compute end time → set `capacity_reserved` (occasions take the whole
  property) → validate start against `time_slots` in property tz → **property-capacity check
  summing overlapping bookings under a `FOR UPDATE` lock** (`phase_2_booking_system.sql`).
- **Instructor exclusion**: a GiST `EXCLUDE` constraint on `(instructor_id, tstzrange)` for
  non-released bookings (`phase_2_booking_system.sql:240`).
- Cross-property **travel-buffer trigger** with an admin-editable minutes matrix
  (`20260608170000_property_travel_times`).
- Adventure capacity checks under row locks + auto sold-out sync.

**Pricing** is already a strategy system, in two generations:

1. `/book` funnel: `pricing_rules` rows keyed `(property_id, booking_type, audience_type)`
   producing three models — **flat** (rate × hours + per-head guest fee, junior split),
   **tiered** (party-size tiers), **team_quoted** (staff quotes) — assembled by
   `src/services/public/pricing.ts`.
2. Estimate catalog: `services.pricing_kind ∈ {guest_fee_tier, lesson_ladder, class_per_person,
   quote, per_target}` with strategy columns (lesson ladders, member/public class prices,
   per-target rates + allotments, reusable `session_fee`) (`20260624144448`, `20260630120000`).

Prices are **snapshotted server-side** at every commitment point (`unit_price_at_booking`,
`bid_line_items.unit_amount`) so client payloads can't rewrite history; `bid_line_items` carries
per-line `tax_status` (taxable/exempt, for the Texas §151.0048 bundling trap) but **no tax
computation engine exists**.

### 0.3 Portal / auth / RLS model

Defense in depth: an app-layer gate (`proxy.ts` `PORTAL_ALLOWLIST`, lines 7–18) plus RLS, both
keyed off a single server-controlled claim, `app_metadata.role`:

| Portal | Roles | State |
|---|---|---|
| `/admin` | `super_admin`, `admin`, `property_manager`, `concierge`, `membership_coordinator` | Full product surface; team management gated to the first two (`lib/auth/portal.ts` `canManageTeam`) |
| `/member` | `member` | Bookings, adventures (browse→reserve→pay→waitlist→cancel), profile |
| `/instructor` | `instructor` | Read-only "gameplan" schedule portal; instructors are deliberately not staff |
| `/partner` | `partner` | **Stub** — one page echoing the session (`app/partner/page.tsx`); backend scaffolding exists (`partner_organizations`, `bookings.partner_org_id`) but no product surface |

Supporting claims: `app_metadata.property_id` scopes `property_manager`/`membership_coordinator`
to one property; `partner_org_id` scopes partners. There is deliberately **no member-id claim** —
members are cross-property, resolved at query time via `people.user_id = auth.uid()`.

RLS follows a hardened, documented pattern (born from real Phase-4 recursion bugs):
**SECURITY DEFINER selector functions** (`current_person_id()`,
`current_member_membership_ids()`, etc. — `20260518235335_rls_helpers_for_member_access.sql`)
instead of inline cross-table subqueries; JWT helpers (`auth_role()`, `is_staff()`…) wrapped in
`(SELECT …)` for InitPlan caching; members have **no direct UPDATE policies** — writes go through
service-role Server Actions with column allowlists. Public bid pages are gated by a bcrypt-verified
access code RPC with constant-time dummy verification (`phase_3_bids.sql:125`).

### 0.4 Money flow

The core promise — *every inquiry ends as a signed bid page with embedded deposit* — is built and
working end to end:

1. **Two front doors, one artifact.** The `/book` funnel and the `/request-estimate` form both
   produce a `bookings` row + a `pending_review` bid via `create_public_booking`
   (`src/services/bookings/create-public-booking.ts`); estimate totals are **recomputed
   server-side** (`src/services/estimates/estimate-pricing.ts`) so carried prices can't be
   tampered with. Rate-limited + honeypotted. (A live plan, `plan/request-estimate-bid-integration.md`,
   retires the `/book` funnel so the estimate form becomes the sole front door.)
2. **Bid statuses**: `pending_review | confirmed | denied | signed | paid | expired | refunded`
   (`src/services/admin/bids.ts:3`), soft-deletable, with admin workflow groupings.
3. **Snapshot line items.** Base/guest-fee lines materialize once at creation; add-on lines
   rebuild only while `pending_review/confirmed`, then freeze (`src/services/bids/bid-line-items.ts`).
   Staff can comp/waive per line (append-only `bid_line_overrides`) or override the total, all
   audited in `bid_pricing_events`.
4. **Public bid page** `/bids/<slug>/<code>` — shareable, code-gated, mounts the waiver modal and
   deposit form; staff can regenerate codes and sign on a guest's behalf.
5. **Homegrown e-sign** (default): typed signature → pdf-lib render with audit lines (name, IP,
   UA, waiver version) → private Supabase Storage → atomic `record_bid_signature` RPC. Dropbox
   Sign remains a dormant provider behind `getWaiverProvider()` (`lib/waiver/provider.ts`).
   Walk-in kiosk + QR scan-to-sign party waivers exist (`app/(public)/waiver/[property]`).
6. **Stripe deposit**: PaymentIntents + Payment Element (not Checkout). Guests may pay any amount
   in `[deposit_amount, quote]` — deposit, partial, or full (`src/services/stripe/create-deposit-session.ts`).
   Webhook route claims idempotency via `processed_webhooks` before dispatch; success flips
   `paid`, reconciles amounts, emails a branded receipt.
7. **Refunds are manual-admin only** (`src/services/admin/refund-deposit.ts`): partial or full,
   Stripe-first with an idempotency key, double-refund guarded, audit note appended.

Verified money absences: no Checkout Sessions, **no subscriptions/recurring billing**, **no gift
cards/promo codes/vouchers** (zero hits), no automated refunds, no balance-due collection flow
(balance settled on property), no `payment_intent.payment_failed` handling yet.

### 0.5 Lifecycle automation

- **Email**: an `EmailService` interface with three implementations (Resend / logging-to-DB dev
  outbox / noop) selected by env (`src/services/notifications/send-email.ts`) — a textbook
  Liskov-compliant seam. **16 React Email templates** (booking confirmation, staff alerts,
  bid confirmed ×2, denied, waiver signed, deposit receipt, refund notice, unsigned digest,
  pre-visit, post-event follow-up, four adventure emails).
- **Inngest**: 11 registered functions (`lib/inngest/functions/index.ts`) — bid-event emails, a
  **pre/post-event reminder engine** with config-in-DB offsets and late-booking consolidation
  (`src/services/reminders/cadence-plan.ts`), a daily unsigned-bid digest cron (nudge-only by
  explicit decision), a 15-minute stale-adventure-hold sweeper, and adventure waitlist
  notifications ("spot opened" claim emails).
- Verified absences: `bid/expired` event is defined but never fired (no auto-expiry, by decision);
  membership events defined with no subscribers; no SMS channel.

### 0.6 Admin dashboard & config-in-DB (what a client self-serves today)

Admin sections (`src/components/admin/admin-nav.tsx`): Dashboard (next-24h schedule + pending
counts — operational, **not analytical**), Bids (full pricing/add-on/content editing, refunds,
sign-on-behalf), Bookings (+calendar), Adventures (full CRUD incl. capacity/deposit/payment-mode),
Properties (per-property workspace: basics, experiences, add-ons, catering, guest fees), Homepage
hero, FAQ & Gear template library (scoped global/property/service/booking-type, snapshotted onto
bids), Waivers (versioned text editing), Instructors (+schedules), Members, Team (invites, roles),
Release Notes, Setup/Welcome/Profile.

Config-in-DB knobs: booking horizon, capacity ceiling, notification/support contacts, reminder
cadence offsets + digest threshold (`reminder_settings`), adventure capacity/deposit/cancellation
windows, per-bid deposit amounts, versioned waiver text, and the full per-property
pricing/catalog. This philosophy — **operational knobs live in DB columns admins can edit** — is
one of the app's strongest template assets.

Verified absences: **no reporting/analytics pages** (only counts + schedule), no general settings
page, no CSV export, no audit-log UI (audit *data* exists for pricing).

### 0.7 Theming & design system

- Single-source token system: `app/globals.css` `:root` brand tokens (olive/tan/paper palette,
  Cormorant + Inter, 9-step type scale, olive-tinted shadows, radii, motion) → Tailwind v4
  `@theme inline` bridge → shadcn semantic-variable remap (lines 186–248). `DESIGN.md` (with
  named rules: One Accent, Olive-Line, Serif-Speaks…) + machine-readable `.impeccable/design.json`.
- 13 hand-rolled primitives in `lib/ui/` (Radix + CSS Modules); an in-flight dashboard migration
  to shadcn/TanStack/Tremor (`DASHBOARD_MIGRATION.md`, `docs/dashboard-ui-audit.md`) with an
  analytics dashboard planned in its Phase 4.
- **Global re-skin is trivial** (one CSS file + font swap in `app/layout.tsx`). **Per-property/
  per-tenant theming does not exist**: "Rhythm Outdoors" is hard-coded in the header, layout
  metadata, and ~10 email templates; per-club taglines and pill colors are code maps keyed by
  slug (`src/constants/public/property-copy.ts`, `src/components/admin/property-pill.tsx`); club
  names appear hard-coded in ~46 spots across ~20 files. No dark mode.

### 0.8 Guardrails & conventions

Two PreToolUse hooks (disabled only by a gitignored `.claude/.developer-mode` marker):
`client-guardrails.mjs` hard-blocks remote DB/Stripe writes, main-branch pushes, deploys, package
changes, and foundation-file edits; `dashboard-content-guard.mjs` blocks DML against
dashboard-managed tables and points at the right `/admin` page (its table→page map mirrors the
admin nav). Plus the safe-change / dashboard-first / build-a-feature skills and a Client Change
Driver agent. This is, in effect, a working prototype of "non-technical operator maintains their
own app under guardrails" — directly relevant to a template business model.

### 0.9 Project status (TRACKER.md)

Done: scaffold, Stripe payments, homegrown waiver (+kiosk), bid content library, instructor
scheduling/self-service, email preview tooling. In progress: public booking flow (being replaced
by the estimate front door), admin portal, member portal, staff book-for-customer, notifications,
Inngest workflows. Deferred: observability (Sentry+Axiom, pre-launch), guest waivers. The largest
launch gate is production cutover (test→live Stripe/Resend/Inngest/domain). ~90 migrations applied
against a **linked cloud Supabase** via `db push` (no local Docker stack in the developer loop).

### 0.10 Baseline summary — template assets vs. single-client artifacts

**Assets that generalize** (the template's crown jewels): DB-enforced availability
(capacity trigger + exclusion constraint + travel buffers), the quote→sign→deposit bid machine
with snapshot line items and append-only overrides, the person/account/junction membership model,
strategy-based pricing kinds, config-in-DB knobs, the versioned waiver engine with kiosk mode,
the `EmailService` seam + Inngest cadence engine, the RLS selector-function pattern, the token
design system, and the client-contributor guardrail apparatus.

**Single-client artifacts that would block cloning today**: hard-coded brand/wordmark and
slug-keyed per-property copy maps; a booking model limited to same-day slots (no nights, no
multi-day sessions except adventures); the three-value booking-type enum with rules split across
DB CHECKs and TS constants; two parallel pricing generations awaiting consolidation; no
tenant/site config table; no billing for memberships; no reporting.

---

## Phase 1 — Market Research: What Hospitality Businesses Actually Need

Method: per-vertical research across category-leader feature sets, review-site complaint themes
(Capterra, G2, Software Advice), operator forums, and industry reports (Arival, Grand View,
Fortune Business Insights). Each subsection ends with a shared-vs-vertical-specific verdict; §1.6
consolidates the cross-cutting themes with a universality rating.

### 1.1 Lodging & short-stay (glamping / cabins / RV parks / campgrounds; small independents)

**Table stakes** (present in essentially every leader — Campspot, Newbook, ResNexus, Firefly,
CampLife, Cloudbeds, Lodgify, OwnerRez, Guesty, Mews, Little Hotelier): direct online booking
engine with real-time availability ([Campspot](https://software.campspot.com/),
[Cloudbeds](https://www.cloudbeds.com/), [Lodgify](https://www.lodgify.com/)); **multi-night
stays with nightly + seasonal pricing** ([Campspot rules/pricing](https://support.campspot.com/rules-pricing));
reservation grid with drag-and-drop site assignment; **site/unit-type inventory** with physical
attributes — RV hookups, tent pads, pods ([Mews camping](https://www.mews.com/en/solutions/camping-management-software),
[PriceLabs for parks](https://hello.pricelabs.co/campgrounds-rv-holiday-parks/));
**minimum-stay rules by season/day-of-week/event** ([PriceLabs min-nights](https://help.pricelabs.co/portal/en/kb/articles/understanding-min-nights));
automated email + at least one-way SMS ([CampLife SMS](https://software.camplife.com/sms-texting));
embedded payments; double-booking prevention / channel sync; occupancy/ADR/RevPAR(-per-site)
reporting with CSV export ([Campspot reports](https://software.campspot.com/blog/reports-check-now-monitor-throughout-season/));
add-on/ancillary sales at checkout (firewood, golf carts, s'mores kits —
[Firefly](https://fireflyreservations.com/), [RoverPass](https://software.roverpass.com/campground-reservation-software));
contactless check-in with e-signature; configurable cancellation/deposit policies.

**Differentiators**: grid/**gap optimization** (Campspot's signature — auto-reshuffling
reservations to eliminate orphan nights, claimed $14M generated for parks in 2025 —
[Campspot](https://support.campspot.com/grid-optimization-faq)); paid **site-lock fees** (guest
pays to pin a specific site — [CampLife Site Guarantee](https://software.camplife.com/features));
native dynamic pricing; first-party marketplaces (Campspot 10% commission); **long-term/seasonal
guest billing + metered utilities** ([RoverPass smart metering](https://software.roverpass.com/campground-reservation-software/smart-metering),
[Newbook](https://www.newbook.cloud/whats-the-leading-software-for-rv-parks-with-utility-metering-and-billing-features/));
interactive site maps in the booking flow; camp-store POS; lodging-tax automation via Avalara
MyLodgeTax (11,000+ jurisdictions — [Avalara/OwnerRez partnership](https://www.avalara.com/mylodgetax/en/blog/2025/12/avalara-mylodgetax-and-ownerrez-partner-to-simplify-lodging-tax-compliance.html)).
Damage deposits are shifting to card-on-file holds and damage-waiver fees because OTAs restrict
host-collected deposits ([Hostaway on Airbnb deposits](https://www.hostaway.com/blog/airbnb-damage-deposits/)).

**Pain points** (the switching drivers): **per-booking fees and fee creep are #1** — Campspot
$3/reservation + 2.5% processing + 10% marketplace ([ResNexus comparison](https://www.resnexus.com/comparisons/campspot.html),
[Keepr teardown](https://keeprstay.com/compare/pricing): a 100-site park pays ~$18k/yr);
Hostaway's surprise 1.8% direct-booking fee triggered public operator backlash
([OwnerRez land-grab page](https://www.ownerrez.com/leaving-hostaway-percent-booking-fee));
Guesty's real cost runs 20–40% above initial quotes ([cashflowdiary](https://cashflowdiary.com/blog/guesty-pricing/)).
Second: **support decay as vendors scale** (Campspot "5–7 day response time" in 2024–25 reviews —
[Software Advice](https://www.softwareadvice.com/hotel-management/campspot-profile/)). Third: the
market churns **bidirectionally** — cheap tools hit a simplicity ceiling (Firefly "only suitable
for very simple parks" — [Capterra](https://www.capterra.com/p/190984/Firefly-Reservations/reviews/))
while feature-rich tools overwhelm two-person operations (ResNexus "63 pages of Setup" —
[Capterra](https://www.capterra.com/p/129392/Reservation-Nexus/reviews/)). Also: seasonal/monthly
guest workflows chronically half-baked; iCal-only channel sync (12–24h delays, silent failures —
[Rentals United](https://rentalsunited.com/blog/ical-vs-api-sync/)) vs the API-era; the
campground vertical lags vacation rentals by years here (Hipcamp only got its first real API
integration, with Cloudbeds, in 2025 — [Hipcamp](https://support.hipcamp.com/hc/en-us/articles/36369423518868-Hipcamp-now-integrates-with-Cloudbeds)).

**Market context**: glamping ~$3.8–4.2B (2025) growing 9.5–11.4% CAGR
([Grand View](https://www.grandviewresearch.com/industry-analysis/glamping-market)); campground
management software is a small (~$115–500M), fast-growing (10–23% CAGR), fragmented niche
([Verified Market Reports](https://www.verifiedmarketreports.com/product/campground-management-software-market/)).

**Verdict**: multi-night/nightly-priced stays, min-stay rules, unit-type inventory, and policy
engines are the *shared lodging core*; grid optimization, site-lock monetization, seasonal-resident
billing with utility metering, and site maps are outdoor-lodging-specific with no horizontal
substitute.

### 1.2 Experiences & activities (tours, classes, guided outings, ranges/clubs) + gear rental

**Table stakes** (FareHarbor, Peek Pro, Checkfront, Rezdy, Xola, TrekkSoft, Bookeo, RESMARK):
session/timeslot scheduling with capacity, cutoffs, min/max participants
([BookingTerminal](https://www.bookingterminal.com/blog/food-drink-tour-booking-software));
real-time availability across website/staff/agents/OTAs ([Zaui](https://www.zaui.com/blog/travel-booking-software/));
**resource management preventing guide/vehicle/gear double-booking** (Checkfront "asset pools"
shared across products — [Checkfront](https://support.checkfront.com/hc/en-us/articles/360035623434-Adding-asset-pools-and-assets));
automated transactional email; deposits/partial payments; **promo codes and gift cards/vouchers**
(treated as a cash-flow instrument — off-season revenue, ~6% never redeemed —
[Regiondo](https://pro.regiondo.com/blog/the-ultimate-guide-to-gift-vouchers-for-tour-and-activity-providers/));
daily **manifests** with per-guest fields; OTA connectivity (Viator, GetYourGuide, Google Things
to Do); per-person AND per-unit/group pricing with rule engines.

**Differentiators**: **integrated waivers** (RESMARK bundles WaiverSign free; Peek/Xola native;
FareHarbor/Rezdy rely on Wherewolf/Smartwaiver integrations —
[Wherewolf](https://getwherewolf.com/integrate-your-guest-booking-and-digital-waiver-software/));
walk-up POS/kiosk (Xola: EMV, self-serve kiosk where guests "book, pay, and sign digital waivers" —
[Xola kiosk](https://www.xola.com/kiosk/)); **abandoned-booking recovery** (~70% of started
checkouts abandon; Xola auto-emails at 8h — [Xola](https://www.xola.com/articles/how-to-prevent-booking-abandonment/));
**waitlists** (~7% of waitlisted guests convert — [Xola blog](https://blog.xola.com/waitlists/));
agent/reseller portals with commission automation ([Rezdy](https://rezdy.com/resellers/));
automated post-experience review requests; **memberships/recurring passes and lesson packages**
(Bookeo's territory — recurring memberships, member-only prices, prepaid 5-for-4 packages —
[Bookeo classes](https://www.bookeo.com/classes/)); pricing model itself (subscription-only
Bookeo/RESMARK marketing against the per-booking-fee model —
[RESMARK](https://www.resmarksystems.com/booking-software-pricing)).

**Pain points**: **fee shock is the loudest** — FareHarbor's ~6% (regionally 5–8%) guest-paid fee,
G2 operators reporting a 25% sales drop after joining ([G2](https://www.g2.com/products/fareharbor/reviews));
real all-in cost 8–11% of booking value ([JungleBee](https://junglebee.com/blog/peek-pro-vs-fareharbor-tour-operators));
48% of cart abandonment is caused by extra costs, and guests blame the operator
([CaptainBook](https://www.captainbook.io/blog/fareharbor-pricing-fees-explained)). **OTA
dependence**: OTAs captured 37% of experience bookings in 2025 (direct websites fell to 25%)
at 20–30% commission ([Arival](https://arival.travel/article/otas-capture-one-third-experiences-bookings/),
[SambaHQ](https://www.sambahq.com/ota-supplier-guide/ota-commission-rates)). Resource
double-booking (the shared-vs-private tour collision); weather cancellation/rebooking toil
(batch-cancel a departure, self-service rebook/voucher —
[TicketingHub](https://www.ticketinghub.com/blog/how-to-manage-tour-cancellation-policy));
waiver/check-in friction with standalone tools. Only ~40% of operators are satisfied with their
current system ([Arival booking-tech 2025](https://arival.travel/research/state-of-booking-tech-2025/)).

**Range/club-specific** (where the current vertical splits off): lane/station-as-resource
scheduling with facility maps ([AllBooked](https://www.allbooked.com/insights/shooting-range-scheduling-software)),
recurring membership billing with member-tier pricing and priority
([EZFacility](https://www.ezfacility.com/industries/shooting-range-gun-club-software/),
[Rapid Gun Systems](https://rapidgunsystems.com/range-management/)), door access control tied to
membership status, safety-gated approval workflows. Sporting-clays clubs stitch together
tournament tools (Score Chaser) plus generic membership systems — **no dominant integrated
booking + membership + events product exists for sporting clubs**.

**Gear rental ancillary**: pure rental platforms (Booqable, Twice) define the capability bar —
per-unit serialized inventory with maintenance routing and buffer times
([Twice kayaks](https://www.twicecommerce.com/rent/kayaks)), automated damage deposits
(fixed or % held on card), late-return flags with auto-charged fees
([Booqable](https://booqable.com/features/)), bundles with item-level tracking. Experience
platforms instead treat gear as **add-ons inside the activity booking**
([Checkfront kayak add-ons](https://www.checkfront.com/kayak-rental-software/)); nobody does both
well. Upsell economics: 65% of travelers requested add-ons
([WeTravel](https://academy.wetravel.com/cross-sell-and-upsell)).

**Market context**: experiences heading toward $342B by 2029
([Arival](https://arival.travel/article/experiences-surging-towards-342-billion/)); 39% of
operators still lack modern booking systems; small-operator adoption is only 42%
([Protect Group](https://www.protect.group/blog/global-experiences-booking-tech-where-operators-stand-now)).

### 1.3 Events & venues (private events, group bookings, weddings/occasions)

**Table stakes** (Tripleseat, Perfect Venue, Planning Pod, Event Temple, HoneyBook, Releventful):
lead/inquiry pipeline + CRM; **proposal with line items → e-sign contract → embedded payment in
one guest-facing link** (Tripleseat: "immediate signatures and instant payments… a guaranteed
deposit" — [Tripleseat](https://tripleseat.com/products/restaurants/); HoneyBook's interactive
proposals — [HoneyBook](https://www.honeybook.com/product/proposal-software));
**payment schedules/installments that auto-charge on dates**
([EverBridal on HoneyBook](https://www.everbridal.com/blogs/honeybook-for-wedding-venues));
**BEOs** (banquet event orders — the category's operational artifact: timeline, space, F&B,
setup/AV, cost breakdown — [Tripleseat BEOs](https://tripleseat.com/blog/everything-you-need-to-know-about-tripleseats-beos/))
with **versioned revisions** auto-propagating guest-count/menu changes
([Planning Pod](https://planningpod.com/banquet-event-orders)); multi-space calendar with
conflict alerts + **tentative holds** ([Planning Pod](https://www.planningpod.com/online-event-booking-software.cfm));
email/document templates with automated follow-ups.

**Differentiators**: **F&B minimums as a contract mechanic** (deposits typically 25–50% of the
F&B minimum; unmet minimums become a room fee — [GoGather](https://gogather.com/blog/negotiate-the-food-beverage-terms-of-your-event-in-your-venue-contract));
POS/kitchen integration; hotel objects (room blocks); **self-scheduled site visits/tours** with
reminders (~10 hrs/week saved, ~40% more tours booked —
[VenueQuoter](https://venuequoter.com/blog/8-easy-ways-to-automate-venue-tour-scheduling-software));
speed-to-lead automation and AI instant quoting.

**Pain points**: **lead response time is the #1 conversion lever** — median venue first reply is
11 hours; conversion by reply time: <1 min → 32%, 24+ hrs → 4%; a major cause is manual quote
building taking 20–45 minutes ([EveryBooking benchmark](https://everybooking.com/blog/wedding-venue-inquiry-response-time-benchmark)).
Tripleseat's most-cited complaint is **email deliverability** (platform emails landing in spam,
broken threads — [G2](https://www.g2.com/products/tripleseat-tripleseat/reviews)); feature
overwhelm and $3k+/yr pricing ([Perfect Venue comparison](https://www.perfectvenue.com/perfect-venue-vs-tripleseat));
chasing signatures/payments across fragmented tools.

**Verdict**: this category's centerpiece artifact — a line-itemized proposal with embedded e-sign
and deposit — is *exactly* what Rhythm's bid page already is, and instant self-serve quoting
directly attacks the category's biggest measured pain (11-hour reply medians). What venues add:
BEOs with change-order versioning, installment schedules, F&B minimums, tentative space holds,
tour scheduling.

### 1.4 Membership & club models

**Table stakes** (ClubExpress, Clubessential, Northstar, Jonas, MemberClicks, TidyHQ; Mindbody as
the gym-adjacent pattern): member database + **tiers/levels + automated renewals** (auto-renew N
days pre-expiry with reminder cadence — [ClubExpress](https://www.softwareadvice.com/nonprofit/clubexpress-profile/));
**recurring billing on Stripe**; **household/family memberships** (the canonical Wild Apricot
"bundle" pattern, whose documented limits — contact data on the coordinator only, no family event
registration — Rhythm's person/account/junction model already exceeds
([Wild Apricot bundles](https://gethelp.wildapricot.com/en/articles/164-membership-bundles),
[wishlist complaints](https://forums.wildapricot.com/forums/308932-wishlist/suggestions/8826118-registering-families-bundles-for-events)));
member self-service portal + event RSVPs with waitlists; directories with privacy controls;
country-club billing objects (house accounts, statements, monthly minimums with carry-forward —
[Northstar](https://www.globalnorthstar.com/club-accounting-software)).

**Differentiators**: amenity reservations with fair-allocation logic; POS charge-to-account;
mobile apps/beacon check-in/access control; guest privileges & fees (per-tier guest counts,
accompaniment rules, lead-time surcharges — [Bald Head Island Club example](https://www.bhiclub.net/guest-passes));
**dunning sophistication** — smart retries recover ~40% of failed payments, card updater ~25%,
emails +15–20%, combined ~70% ([Digital Applied playbook](https://www.digitalapplied.com/blog/failed-payment-recovery-dunning-playbook-2026)).

**Pain points**: legacy clunkiness (Jonas: "adequate to subpar in all areas, outstanding at none" —
[WifiTalents](https://wifitalents.com/best/private-club-management-software/); MemberClicks
post-acquisition support collapse — [ReviewMyAMS](https://reviewmyams.com/listing/memberclicks));
**involuntary churn** — 20–40% of all subscription churn is failed payments, ~9% of MRR lost
annually ([DunningCompare](https://www.dunningcompare.com/stats/involuntary-churn-statistics-2026));
billing-lifecycle UX failures (Mindbody BBB complaints center on cancellations not honored —
[BBB](https://www.bbb.org/us/ca/san-luis-obispo/profile/computer-software-developers/mindbody-inc-1236-5002899/complaints)).

**Verdict**: Rhythm's membership *data model* is ahead of the category norm; the entire *billing
engine* on top of it (subscription dues, renewals, dunning, tier entitlements, guest-privilege
rules) is absent (baseline §0.2: `memberships` has tier and status but no dues amount, invoicing,
or payment schedule).

### 1.5 Camps & programs (summer camps, retreats, enrollment businesses)

**The enrollment domain model** (how CampMinder, UltraCamp, CampBrain, CampDoc, Sawyer, Regpack,
Amilia, Jumbula actually model it):

- **Household ≠ camper ≠ payer.** A parent-owned family account contains multiple camper
  profiles; the registrant is never the attendee. CampMinder's "Unified Person Record"
  accumulates registration/health/financial history across roles and years
  ([CampMinder](https://campminder.com/features/), [Sawyer](https://www.hisawyer.com/for-business)).
- **Sessions, not bookings.** The unit of sale is a named, capacity-limited, date-bounded program
  instance built from session templates, recurring annually — which creates the **year-rollover**
  problem (CampSite ships a "Database Rollover Wizard" copying sessions/tuition/discounts/forms
  into the new year — [CampSite](https://support.campmanagement.com/hc/en-us/articles/360051597312-Database-Rollover-Wizard-Overview);
  its absence is a top UltraCamp complaint — [G2](https://www.g2.com/products/ultracamp/reviews)).
- **Money model**: deposit at registration → auto-charged monthly installments → balance due N
  days before session, card-on-file + dunning ([Regpack](https://www.regpacks.com/camp-registration-software-3/),
  [YMCA Camp Jewell policy](https://campjewell.org/2025/10/18/how-payment-plans-financial-aid-work/)).
  Sibling/multi-session discounts are first-class pricing objects
  ([ACTIVE](https://www.activenetwork.com/camp-and-class-manager/features)); financial-aid /
  sliding-scale workflows are underserved ([Communal](https://getcommunal.com/guides/camps/camp-management-software-for-nonprofits)).
- **Clinical health layer**: allergy databases, immunization uploads, eMAR medication
  administration, SOAP-note clinic logs meeting ACA/state health-log rules
  ([CampDoc](https://www.campdoc.com/electronic-health-record/)) — CampDoc wins because it's "a
  medical record that added registration" while everyone else bolted medical onto registration
  ([Alliance for Camp Health forum](https://allianceforcamphealth.org/bbpressforums/topic/campdocs-vs-campbrain/)).
- **Custody/safety workflows**: authorized-pickup lists with photos, timestamped check-in/out
  ([Amilia](https://www.amilia.com/industry/camp-registration-software)); bunk/group assignment
  boards from bunkmate preferences ([CIRCUITREE](https://www.circuitree.com/features/operations-management));
  seasonal-staff hiring pipelines with background checks ([CampMinder](https://campminder.com/features/)).
- **In-season parent engagement**: photo streams with facial recognition are now an expected
  overnight-camp feature (CampMinder's Campanion, Bunk1, Waldo at ~$1–2/child/day —
  [Washington Post](https://www.washingtonpost.com/technology/2019/08/08/summer-camps-turn-facial-recognition-parents-demand-more-smiles-please/)).

**Pain themes**: **registration-morning load spikes** crash real systems (Evanston IL's
registration died within 2 hours — [Daily Northwestern](https://dailynorthwestern.com/2018/02/13/city/city-website-crashes-technical-difficulties-handling-summer-camp-registration/);
DC parents call it "an absurd race… akin to getting Taylor Swift tickets" —
[Washingtonian](https://washingtonian.com/2024/02/08/summer-camp-registration-has-become-an-absurd-race/));
admin UX complexity (UltraCamp session creation "takes about a million steps" —
[Capterra](https://www.capterra.com/p/79171/UltraCamp/reviews/)); poor mobile parent UX on legacy
platforms while 71% of parents book on phones ([ACA](https://www.acacamps.org/blog/sponsored/2026-camp-booking-pricing-trends));
reporting slowness; year-rollover drudgery; opaque pricing (CampMinder $2,500–5,000+/season —
[CampNetwork comparison](https://www.campnetwork.com/camp-registration-software-comparison)).

**Compliance**: HIPAA usually does **not** cover camps (it triggers only if the camp
electronically bills health insurance — [ACA legal analysis](https://www.acacamps.org/article/campline/hipaa-camps-compliance-required));
the real requirements are ACA accreditation standards plus a **state licensing patchwork**
([ACA state laws](https://www.acacamps.org/resources/state-laws-regulations)). COPPA matters and
is tightening: the FTC's 2025 amendments (effective April 2026) make **biometric identifiers
personal information** — directly relevant to facial-recognition photo features
([FTC](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)).

**Market context**: 20,175 US camps, an $18B industry, 82% flat-or-growing enrollment
([ACA facts](https://www.acacamps.org/press-room/aca-facts-trends)); camp-management software is
a small (~$150–200M), high-retention niche ([Grand View](https://www.grandviewresearch.com/horizon/outlook/camp-management-software-market-size/global)).

**Verdict**: a generic booking engine already covers capacity+waitlists, forms, deposits,
coupons, reminders, waivers, rosters, and portals. Camps structurally diverge on: the
household/attendee person model (Rhythm's people/memberships model is a strong seed), session
lifecycle + annual rollover, the clinical health layer, custody workflows, installment schedules
keyed to session dates, and registration-burst capacity engineering.

### 1.6 Cross-cutting capability themes (validated universality)

| Theme | Universality | Evidence & "what good looks like" |
|---|---|---|
| Cancellation/refund policy engine | **Universal** | Tiered days-out→% schedules + weather carve-outs + operator-initiated override ([TourAmigo](https://www.touramigo.com/post/what-is-a-good-cancellation-policy-for-tour-operators), [TrekkSoft](https://www.trekksoft.com/en/blog/managing-cancellations-and-refunds-for-tours-and-activities)) |
| Deposits / installments / payment plans | **Universal** | Stripe documents deposits+installments as "common and expected" in travel; deposit now + saved card + scheduled balance ([Stripe travel](https://stripe.com/industries/travel), [Stripe billing guide](https://stripe.com/resources/more/a-guide-to-automated-billing-for-hospitality-businesses)) |
| Promo codes / discounts | **Universal** | % or fixed, validity window, usage cap, product scoping, attribution ([FareHarbor](https://help.fareharbor.com/hc/en-us/articles/42957480670363-Discount-codes)) |
| Guest lifecycle messaging | **Universal** | Event-triggered confirmation / pre-arrival / post-visit templates, email+SMS ([HelloShift](https://www.helloshift.com/guest-messaging), [SendSquared](https://sendsquared.com/solutions/pre-arrival-to-post-stay/)) |
| Reporting/analytics | **Universal** (small fixed set) | ~5 metrics: revenue, occupancy/utilization, ADR-analog, YoY, booking source ([RoomPriceGenie](https://roompricegenie.com/reporting-analytics-dashboard/)) — not a BI suite |
| Tax handling | **Universal problem**, uneven | Lodging is the hard case (~30 states + layered local bed taxes remitted separately — [Avalara](https://www.avalara.com/mylodgetax/en/resources/state-lodging-tax-requirements.html)); day-experiences mostly fine with Stripe Tax product codes ([Stripe Tax](https://docs.stripe.com/tax/tax-codes)) |
| Loyalty/CRM | **Universal as CRM, not points** | Low-frequency stays kill points programs; the mature pattern is history-based segmentation + re-engagement ([SendSquared](https://sendsquared.com/blog/hotel-loyalty-program-software/)); a membership club is the strongest native form |
| Waivers / consent / medical forms | **Universal in activity verticals** | Minor/guardian enforcement, kiosk mode, per-person waiver vault, returning-participant renewal ([Smartwaiver](https://www.smartwaiver.com/features)); camps extend to full health records ([CampDoc](https://www.campdoc.com/electronic-health-record/)) |
| Waitlists | **Most** (classes/camps strongest, lodging weakest) | Auto-promote in order, or first-to-claim blast ([Mindbody](https://www.mindbodyonline.com/business/education/product-waitlist-improvements), [Bookwhen](https://support.bookwhen.com/en/articles/753351-waiting-lists)) |
| Group / multi-unit bookings | **Most** (venues = whole product) | Lead→proposal→contract→BEO→deposit ([Tripleseat](https://tripleseat.com/)); Rhythm's occasion+bid flow is structurally this pattern |
| Gift cards / vouchers | **Most** | Stripe has **no native gift-card product**; ecosystem answer is Gift Up/Cardivo via promotion codes ([Gift Up](https://help.giftup.com/article/75-stripe-payments)); in-house means owning ASC-606 deferred-revenue liability + escheatment ([Leapfin](https://www.leapfin.com/blog/how-to-properly-recognize-gift-card-revenue)) |
| Reviews / reputation | **Most** | Post-visit review-request automation is the 80/20 ([Origin](https://exploreorigin.com/blog/automated-review-request/)); monitoring suites are buy-not-build |
| Staff / resource scheduling | **Most** | Bookable availability derived from staff availability; assignment + double-book prevention ([Flybook guide management](https://www.theflybook.com/guide-management/)) — Rhythm's instructor system is this |
| Dynamic / seasonal pricing | **Vertical-dependent** | Mature+algorithmic in lodging (~41% of US Airbnb listings use third-party tools — [RevFactor](https://www.revfactor.io/blog/dynamic-pricing-str-beginners-guide)); elsewhere "good" = seasonal rate calendars and early-bird tiers, not algorithms |
| OTA / channel management | **Vertical-dependent** (widest variance) | Existential in rentals (API sync; iCal fails silently — [Rentals United](https://rentalsunited.com/blog/ical-vs-api-sync/)), growing in tours (37% share), ~zero for private clubs/venues |

---

## Phase 2 — Gap Analysis

Crossing Phase 1 against the Phase 0 baseline. **Tiers**: (A) needed in the shared template base;
(B) common but built per-vertical as a fork/module; (C) niche or defer. **Blast radius** names
what a gap touches: schema, RLS, payments, funnel, admin-content-only. Effort is T-shirt sized
for this codebase specifically (an M here assumes the existing service/RLS/admin patterns are
reused, not reinvented).

### 2.1 Ranked gap table

| # | Capability | Verticals that need it | Status vs baseline | Effort | Blast radius | Tier |
|---|---|---|---|---|---|---|
| 1 | Tenant/site config & de-hardcoded brand | all (prerequisite to cloning at all) | **True gap** — wordmark + copy hard-coded in ~46 spots; per-property theming absent (§0.7) | M | admin content, theming, email templates; tiny schema (`site_config`) | **A** |
| 2 | Bookable-resource + booking-policy abstraction | all | **Partial** — booking types exist but as a 3-value enum with rules split across DB CHECKs and TS constants (§0.2); pricing is already config-driven | L | schema, funnel, services, triggers | **A** |
| 3 | Payment schedules / installments / balance-due | all (venues, camps hardest) | **True gap** — single deposit-to-full payment only; no scheduled balance collection (§0.4) | L | payments, schema, Inngest, bid page | **A** |
| 4 | Cancellation/refund policy engine | all | **True gap** — refunds are manual-admin; no days-out→% rules (§0.4); adventures have a `free_cancellation_days` seed | M | schema, payments, member/guest UI | **A** |
| 5 | Promo codes / discounts | all | **True gap** — zero hits for coupon/promo (§0.2); comp/waive overrides exist but are staff-side | M | schema, funnel, pricing, Stripe | **A** |
| 6 | Reporting dashboard (~5 metrics + CSV export) | all | **True gap** — admin dashboard is operational only (§0.6); already planned in `DASHBOARD_MIGRATION.md` Phase 4 | S–M | admin read-only; no schema beyond views | **A** |
| 7 | Waitlists on core bookings | most (classes/camps/sessions) | **Partial** — adventures have waitlist + claim emails (§0.5); core bookings don't | S–M | schema, funnel, Inngest | **A** |
| 8 | Date-range (multi-night / multi-day) scheduling | lodging, camps | **Partial** — bookings are same-day slots, but availability math is already `tstzrange` overlap (§0.2); adventures already span dates | L (part of #2) | schema, triggers, funnel | **A** (the primitive) / **B** (nightly-pricing UI) |
| 9 | Membership dues billing + renewals + dunning | clubs (incl. current client), camps-lite | **True gap** — `memberships` has tier/status but no dues, invoicing, or schedule (§0.2); tier/dues are open client questions | L | payments (subscriptions), schema, member portal | **B** (first fork-grade module; base-ready interfaces) |
| 10 | Per-person participant & forms engine (medical/consent/custom fields) | camps, tours, ranges | **Partial** — waiver engine is per-signature with versioned templates (§0.4); no per-participant profiles or conditional-logic forms | L | schema, RLS, funnel, admin | **B** (camps fork; waiver engine is the seed) |
| 11 | Seasonal/tiered rate calendars | lodging strongest; mild elsewhere | **True gap** — static pricing only (§0.2) | M | pricing strategies, admin | **B** |
| 12 | Damage deposits / card-on-file holds | rentals, glamping, venues | **True gap** — PaymentIntents captured immediately; no auth-holds | S–M | payments | **B** |
| 13 | BEO/ops documents + change orders + F&B minimums | venues | **Partial** — bid snapshot + pricing events are the versioning seed (§0.4); no ops-facing doc, no minimums object | M | schema, admin, PDF render (pdf-lib exists) | **B** |
| 14 | Tax computation | all; lodging is the hard case | **Partial** — per-line `tax_status` stored, no engine (§0.2); Stripe Tax covers experiences well ([Stripe Tax](https://docs.stripe.com/tax/tax-codes)) | S (Stripe Tax) / C (lodging jurisdictions) | payments, line items | **A** (Stripe Tax wiring) / **C** (lodging-tax specialist layer — integrate Avalara if needed) |
| 15 | Abandoned-booking recovery | experiences, lodging | **True gap** — no abandonment emails (adventure *holds* get swept, not nudged) | S | Inngest + one email | **B** |
| 16 | Post-visit review requests | most | **Near-covered** — post-event follow-up email exists (§0.5); add review deep-link + property review URLs | S | admin content only | **A** (trivial extension) |
| 17 | Gift cards / vouchers | experiences, lodging | **True gap**; Stripe has no native product; in-house = ASC-606 liability + escheatment ([Leapfin](https://www.leapfin.com/blog/how-to-properly-recognize-gift-card-revenue)) | M–L in-house / S via Gift Up | payments, schema | **C** (integrate, don't build) |
| 18 | SMS channel | most | **True gap** — email only (§0.5); `EmailService` seam makes a `MessageService` generalization natural | S–M | notifications | **B** |
| 19 | OTA / channel management | lodging existential, tours growing | **True gap**, deliberately | XL | everything | **C** (defer; per-vertical plugin — do not compete with Campspot/FareHarbor on distribution) |
| 20 | Dynamic/algorithmic pricing | lodging | **True gap** | XL | pricing | **C** (seasonal calendars in #11 are the 80/20) |
| 21 | POS / walk-up / kiosk sales | ranges, campgrounds | **Partial** — waiver kiosk exists (§0.4); no payment kiosk/POS | L | payments, hardware | **C** |
| 22 | Site maps / gap optimization / site-lock / utility metering | campgrounds/RV | **True gap** | XL | vertical-specific | **C** (RV-park-fork territory only) |
| 23 | Photo sharing / facial recognition | overnight camps | **True gap**; FTC biometric rules incoming ([FTC](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)) | XL | compliance-heavy | **C** (buy/integrate: Waldo/Bunk1) |

### 2.2 Rationale for the top items

**#1 Tenant/site config is the gate, not a feature.** Every clone conversation dies at "the
header says Rhythm." The baseline shows the *token* layer is already single-source (§0.7) — what's
missing is the *identity* layer: a `site_config` (name, wordmark, support contacts, email
from-address, social/review URLs, theme overrides) plus killing the slug-keyed copy maps
(`src/constants/public/property-copy.ts`) in favor of DB columns the admin already edits for
properties. Cheap, high-leverage, and it converts the app's existing config-in-DB philosophy
(§0.6) into the cloning mechanism itself.

**#2 The booking-policy abstraction is the template's core refactor.** The research says the same
thing five ways: a "range session," a "camp session," a "cabin night," and a "banquet hold" are
all *a capacity-consuming claim on a resource over a time range with a policy attached*. The
baseline is closer to this than it looks — availability is already `tstzrange` overlap under row
locks, capacity is already a per-property integer, instructor exclusivity is already a GiST
constraint, and pricing is already a strategy enum (§0.2). What's hard-coded is the *policy*:
three enum values whose duration/staffing rules live in CHECK constraints and a TS constants map.
Phase 3 §3.2 specifies the replacement.

**#3 Installments/balance-due is the highest-value *universal* money feature.** Stripe documents
deposits+scheduled balances as the expected travel pattern ([Stripe](https://stripe.com/industries/travel));
venues auto-charge date-based schedules ([HoneyBook](https://www.everbridal.com/blogs/honeybook-for-wedding-venues));
camps run deposit→monthly→balance-minus-30-days ([Camp Jewell](https://campjewell.org/2025/10/18/how-payment-plans-financial-aid-work/)).
Rhythm already saves nothing after the deposit — the balance is settled "with concierge" (§0.4).
A `payment_schedules` table + saved payment method (`setup_future_usage`) + an Inngest charge
runner extends the existing webhook/idempotency machinery rather than replacing it.

**#4 Policy engine before more automation.** The explicit product decision *not* to auto-cancel
(§0.5) is right for a high-touch club but wrong as a hard-coding for a template. A tiny
`cancellation_policies` table (ordered days-out→refund-% rows + weather/operator override flag),
referenced by offering, with the manual refund service (§0.4) as its execution arm, turns
"no auto-cancel" into merely one policy configuration — the strategy-over-branching rule the
codebase already follows.

**#6 Reporting is disproportionately cheap credibility.** Research says operators check ~5
numbers (§1.6), reviews punish reporting gaps in every vertical, and the dashboard migration doc
already plans Tremor charts. Revenue, bookings, utilization vs capacity, conversion
(bid→signed→paid), YoY — all computable from existing tables today.

---

## Phase 3 — Template Architecture Plan

Constraints honored throughout: SOLID as hard constraints (config/strategy over branching),
config-in-DB, RLS selector-function pattern, `app/`–`src/`–`lib/` boundaries, DB-enforced
booking integrity.

### 3.1 Tenancy & cloning model

**Recommendation: one shared codebase (template core + registered vertical modules), one
deployment per client (Vercel project + env), one Supabase project per client, one Stripe account
per client. No per-client repo forks.**

Comparing the three options for a solo/small operator:

| Model | Verdict | Why |
|---|---|---|
| (a) Fork-per-business (repo + DB clone each) | **Reject** | The white-label literature is unanimous that hard forks accumulate "lethal technical debt" ([Developex](https://developex.com/blog/building-scalable-white-label-saas/), [HiringThing](https://blog.hiringthing.com/multi-tenant-ats-architecture-for-white-label-partners)). GitHub templates have **no downstream sync**; the community fix (`actions-template-sync`) means reviewing one merge-PR per client per core change, forever, with conflicts landing on you ([GitHub discussion](https://github.com/orgs/community/discussions/23528), [actions-template-sync](https://github.com/AndreasAugustin/actions-template-sync)) |
| (b) Shared multi-tenant DB (`tenant_id` on every table + RLS) | **Reject for now** | Right answer at hundreds of tenants ([Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices), [AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)), wrong at 2–10: it forces a tenant-aware retrofit of an RLS policy graph that already needed SECURITY DEFINER surgery to avoid recursion (§0.3), couples every client's blast radius, and complicates Stripe/webhooks/backups per client |
| (c) Hybrid: shared base + per-tenant *deployments* (not forks) | **Adopt** | One codebase means upstream improvements propagate by redeploying — no merge step at all. Per-client Supabase projects give isolation, per-client billing, and zero RLS rewrite; the Supabase community explicitly notes project-per-tenant is fine at a handful of tenants ([discussion #1615](https://github.com/orgs/supabase/discussions/1615)). Vercel natively runs N projects off one repo with per-project env/domains and skips unchanged builds ([Vercel monorepos](https://vercel.com/docs/monorepos)) |

Mechanics of the recommended model:

- **Repo shape**: keep a single Next.js app (no premature Turborepo split). Client identity comes
  from env (`TENANT=camp-bravo`) resolving a config module + the client's own DB content. If two
  clients ever need genuinely divergent *pages*, that's the trigger to move to
  `apps/<client>` + `packages/core` in a Turborepo — a mechanical refactor later, not a bet now.
- **Migrations across N Supabase projects**: one `supabase/migrations` history, applied per
  client via a scripted loop (`for p in $(cat clients.txt); do supabase db push --project-ref $p; done`)
  in CI. This matches the existing linked-cloud `db push` workflow (§0.9). Vertical-module
  migrations are still plain migrations — they create tables all clients carry (dormant tables
  are cheap; dormant *code paths* are flag-gated).
- **Stripe**: separate Standard accounts per client (client owns their money relationship; you
  hold a restricted key per account). Move to Connect-with-Standard-accounts only if you later
  want an application fee per booking ([Stripe Connect docs](https://docs.stripe.com/connect/accounts),
  [multi-entity guidance](https://docs.stripe.com/billing/multi-entity-business)).
- **Divergence budget**: a client request that can't be expressed as config, content, theme, or a
  registered module is a signal to either promote the capability into the core (if ≥2 clients
  want it) or decline it — not to fork. This is the discipline that keeps N deployments on one
  codebase honest.
- **Business-model note from the research**: per-booking fees are the single loudest complaint in
  every vertical (§1.1, §1.2). Charging clients flat monthly SaaS/retainer instead of per-booking
  is both simpler for this architecture (no metering) and directly markets against the incumbent
  pain — the wedge Bookeo/RESMARK/Perfect Venue already exploit.

### 3.2 The abstraction layer — one primitive, many policies

**Thesis**: "range session," "camp session," and "cabin night" become one core primitive — a
**booking is a capacity-consuming claim on a resource over a `tstzrange`, validated by a
policy, priced by a strategy, committed through the bid machine**. The baseline already
implements this shape for one vertical; the work is extracting the hard-coded parts into config.

**What generalizes (renames in parentheses):**

- `properties` → the **venue/site** row stays exactly as is (it's already the config anchor).
- `services` → **offerings** (what is sold: a discipline, a tour, a camp session type, a unit
  type). Already carries `pricing_kind` — the pattern extends.
- New: `resources` — the physical/human things claims consume (station, guide, cabin, campsite,
  room, bunk). Instructors become one `resource_kind`; today's property-wide
  `max_concurrent_groups` becomes the degenerate case of one property-level resource pool.
- `bookings` → stays; gains `offering_id` and drops the type-specific CHECK constraints in favor
  of policy-table-driven validation (still trigger-enforced in the DB — see below).
- `bids`/`bid_line_items`/waivers/payments → **unchanged**. The commitment machine is already
  vertical-agnostic; every vertical researched converges on exactly this artifact (§1.3).

**Booking-type config becomes data.** Today's enum + CHECKs + TS map (§0.2) becomes a
`booking_policies` table (one row per offering or booking type), read by the same triggers:

```ts
// src/types/booking-policy.ts — the shape, whether stored as columns or JSONB
interface BookingPolicy {
  key: string;                       // 'plan_a_visit' | 'cabin_stay' | 'camp_session' | ...
  scheduling:
    | { kind: "timeslot"; durationHours: { min: number; max: number; fixed?: number };
        slotSource: "time_slots" }                    // today's model
    | { kind: "date_range"; minNights: number; maxNights: number | null;
        checkinDaysOfWeek?: number[]; turnoverBufferHours?: number }   // glamping/cabins
    | { kind: "session"; sessionId: string };          // camps: dates live on the session row
  capacity:
    | { kind: "pooled"; poolResourceKind: "property_slot" }  // today's max_concurrent_groups
    | { kind: "per_resource"; resourceKind: "cabin" | "site" | "lane"; exclusive: true }
    | { kind: "seats"; max: number; waitlist: boolean };     // sessions/classes/adventures
  staffing?: { requiredResourceKind: "instructor" | "guide"; selection: "guest" | "auto" };
  party: { min: number; max: number; participantProfile: "count_only" | "named" | "full_profile" };
  lifecycle: {
    commitment: "instant" | "quote_first";             // funnel vs bid-review path
    deposit: { kind: "fixed" | "percent"; value: number } | null;
    balance: { dueDaysBefore: number; autoCharge: boolean } | null;   // gap #3
    cancellation: CancellationPolicyRef;                              // gap #4
    expiryDays: number | null;
  };
  pricing: { strategy: PricingStrategyKey; params: Record<string, unknown> };
}
```

**DB enforcement is preserved, not weakened.** The project rule "double-booking prevention is a
database constraint" survives generalization: the GiST exclusion constraint moves from
`(instructor_id, tstzrange)` to `(resource_id, tstzrange)` on a `booking_resources` claim table
(one mechanism now covers instructors, cabins, lanes, and event spaces); the capacity trigger
reads the policy row instead of hard-coding `host_an_occasion`; date-range and timeslot
validation are two branches of one policy-driven trigger. Policies are *data*, but their
enforcement stays in Postgres.

**Pricing strategies formalize what §0.2 started.** The five existing `pricing_kind`s plus the
funnel's flat/tiered/team_quoted become entries in one registry:

```ts
// src/services/pricing/registry.ts
interface PricingStrategy<P = unknown> {
  key: string;                                  // 'flat_hourly' | 'party_tiered' | 'per_target'
                                                // | 'nightly_seasonal' | 'session_tuition' | 'quote'
  compute(ctx: PricingContext, params: P): QuoteLine[];   // pure; returns bid_line_item shapes
}
// PricingContext: { offering, policy, dates, party: {adults, juniors, members}, addOns, audience }
// New verticals add a strategy file + a registry entry — never touch existing strategies (OCP).
```

`nightly_seasonal` (rate calendar + min-stay from the policy) is the only genuinely new strategy
glamping needs; camps' `session_tuition` is a fixed price + sibling-discount modifier. Discounts
and promo codes (gap #5) compose as a post-pass over `QuoteLine[]`, mirroring how
`bid_line_overrides` already applies staff comps (§0.4).

**Participants generalize the waiver seed.** `party.participantProfile: "full_profile"` (camps)
attaches per-attendee `participants` rows (name, DOB, household link via the existing
`people`/`membership_people` pattern) with a `forms` engine — versioned templates exactly like
`waiver_templates`, plus typed fields (allergy list, consents). Signature capture, PDF render,
and the private-bucket vault are reused as-is.

### 3.3 Theming & re-skin per tenant

The token architecture (§0.7) is already the right shape; the work is layering identity on top:

1. **Tokens**: per-tenant `theme.css` — a `:root` override block generated from a
   `tenant.theme.json` (12–15 values: palette ramp, two fonts, radius, shadow tint). Because both
   the Tailwind `@theme inline` bridge and the shadcn semantic bridge read the `:root` vars,
   overriding `:root` re-skins Tailwind utilities, shadcn components, and `lib/ui` primitives in
   one move — zero component changes. Fonts become a config-driven `next/font` map in
   `app/layout.tsx` (the one code file a re-skin touches).
2. **Identity strings**: `site_config` table (or per-tenant config module): business name,
   wordmark text/logo asset, tagline, email from-name/address, support contacts, review/social
   URLs. Header, layout metadata, and all 16 email templates read it — killing the ~46 hard-coded
   references (§0.7). Email templates already render through one layout component, so branding
   them is one seam.
3. **Copy**: promote `PROPERTY_COPY` and per-slug maps into columns on `properties`/`site_config`
   (the admin Properties workspace already edits adjacent fields — §0.6).
4. **Design docs per fork**: re-run `/impeccable document` per tenant to regenerate `DESIGN.md` +
   `.impeccable/design.json` from the new tokens, keeping the design-review tooling honest.
5. **Dashboard sections** vary by the module registry (§3.4), not by theme.

### 3.4 Fork/extension mechanism — modules, not modifications

A vertical fork = **a module directory + config rows + feature flags**, never edits to core:

```ts
// src/modules/<vertical>/module.ts
interface VerticalModule {
  key: string;                                   // 'glamping' | 'camp' | 'venue'
  bookingPolicies: BookingPolicy[];              // seeds for the policies table
  pricingStrategies: PricingStrategy[];          // registered into the pricing registry
  adminSections: AdminSection[];                 // merged into admin-nav's config map
  funnelSteps?: FunnelStepDef[];                 // inserted into the booking-flow step registry
  emailTemplates?: EmailTemplateDef[];           // added to the template registry
  inngestFunctions?: InngestFunction[];          // concatenated into functions/index.ts export
  migrations: string[];                          // plain migrations; tables dormant when flag off
}
```

Extension points, each of which already exists as a config map or registry in the baseline and
just needs module-aware merging: the admin nav map (`admin-nav.tsx`, already mirrored by the
content-guard hook), the funnel's step sequence (the React Context provider — steps become a
registered array), the Inngest function index, the email template registry
(`app/dev/email-templates/registry.tsx`), and the pricing registry (§3.2). Feature flags live in
`site_config.enabled_modules` (config-in-DB, admin-visible). The dashboard-content-guard hook's
table→page map extends per module, keeping the client-contributor guardrails working in every
fork — which is itself a sellable feature of the template ("your staff can safely make changes
with AI assistance").

RLS in modules follows the house pattern: module tables ship policies using the existing role
claims and, where cross-table, new SECURITY DEFINER selectors — the five staff roles + member +
partner + instructor role vocabulary is already generic enough for every vertical researched
(camps: staff/parent≈member; glamping: staff/guest; venues: staff/client).

### 3.5 Base template vs per-fork add-ons (tied to Phase 2 tiers)

**Base (Tier A)**: everything in §0.10's asset list, plus tenant/site config & theming (#1),
booking-policy + resource abstraction with date-range scheduling (#2, #8), payment schedules
(#3), cancellation-policy engine (#4), promo codes (#5), the 5-metric reporting dashboard + CSV
(#6), waitlists on core bookings (#7), Stripe Tax wiring (#14), review-request extension (#16).

**Per-fork modules (Tier B)**: membership dues billing + dunning (clubs — and the current
client's own likely next need), participant/forms engine + custody workflows (camps),
nightly-seasonal pricing UI + damage-deposit holds + turnover tasks (glamping/cabins), BEO/change
orders/F&B minimums + tentative holds (venues), SMS channel, abandoned-booking recovery,
per-unit gear rental inventory.

**Deliberately out (Tier C)**: OTA/channel management, algorithmic pricing, POS hardware, site
maps/grid optimization, utility metering, photo sharing/facial recognition, in-house gift cards.
Each is either a buy-not-build (Gift Up, Waldo, Avalara), a different company's moat (Campspot,
FareHarbor), or a compliance tarpit (biometrics). Saying no to these is what keeps a solo-dev
template maintainable.

---

## Phase 4 — Roadmap

Sequenced so that every step ships value to the *current* client while building the template —
no dark refactoring period.

**Phase T0 — Launch Rhythm (now → cutover).** Finish App 5 verification and the production
cutover (§0.9). The template story is worthless without one live, paying reference client.

**Phase T1 — De-brand the core (small, immediately after launch).** `site_config` + theme
override layer + email-template branding seam + kill slug-keyed copy maps (gaps #1). Exit
criterion: a "Lakeside Retreats" demo deployment — same code, different env/DB — renders with
zero Rhythm references. This is cheap and *proves the cloning mechanics* (second Vercel project,
second Supabase project, migration loop) before any abstraction work.

**Phase T2 — Universal money features (in place, for Rhythm).** Cancellation-policy table (#4),
payment schedules/balance-due (#3), promo codes (#5), reporting dashboard (#6, riding the
in-flight shadcn/Tremor migration), Stripe Tax (#14), review requests (#16). Each lands as a
normal feature for the live client — the template accretes from production-tested parts.

**Phase T3 — The abstraction refactor (booking policies + resources).** Migrate the three
booking types onto `booking_policies` + `booking_resources` with behavior-identical output
(golden-file test: same inputs → same bid line items before/after). Consolidate the two pricing
generations into the strategy registry. This is the riskiest engineering step; do it *after* T2
so policy/schedule features inform the interfaces, and *before* the second vertical so it's
validated by real divergence rather than speculation.

**Phase T4 — Prove it with a second vertical: glamping/cabin rentals.** Build the glamping
module: `date_range` scheduling policy, `nightly_seasonal` pricing strategy, unit/cabin
resources, damage-deposit holds, turnover buffer. **Why glamping over camps as the proof
vertical**: (1) the user's stated candidate is possibly *the same company* — a warm,
low-acquisition-cost pilot; (2) it stretches every abstraction that matters (scheduling kind,
capacity kind, pricing strategy, deposit semantics) without requiring the compliance-heavy
clinical/custody layer camps demand (§1.5); (3) outdoor-stay software is a growing, fragmented
niche whose incumbents are either too simple or too complex (§1.1) — a credible wedge for a
high-touch template business; (4) adventures already proved date-ranged, capacity-limited,
deposit-taking products work in this codebase (§0.2). Exit criterion: a real glamping operator
takes a real multi-night booking with a real deposit through their own branded deployment.

**Phase T5 — Second fork module by demand: camps or clubs.** Camps (participant/forms engine,
installments already built in T2, session rollover) if an enrollment-business client
materializes; membership dues/dunning if the club vertical (or Rhythm itself) pulls first.
The vertical-SaaS evidence says let a signed client force each generalization
([Mindbody's decade-long clock](https://d3.harvard.edu/platform-digit/submission/mindbody-the-playbook-for-saas-enabled-platforms/),
["building a complete platform from day one kills more vertical SaaS companies than
competition"](https://www.saasmag.com/vertical-saas-niche-beats-horizontal-2026/)).

### Riskiest assumptions — and what invalidates the plan

1. **A second client actually shows up.** The whole template bet. Mitigation: T1 is deliberately
   tiny, and everything in T2 pays for itself on Rhythm alone. If no second client by T3, stop —
   you still have a better single-client product. *Invalidated by*: 6+ months of pipeline silence.
2. **The abstraction survives contact with vertical #2.** If glamping needs a parallel booking
   system rather than a policy row, §3.2 was wrong. Mitigation: golden-file parity tests in T3;
   adventures as an existing in-codebase second scheduling shape. *Invalidated by*: the glamping
   module needing edits inside core services rather than additions.
3. **Solo maintenance of N deployments stays sane.** Migration loops, N webhook endpoints, N
   Stripe dashboards. Mitigation: CI scripting from day one (T1's demo deployment is the test);
   cap clients until ops are boring; project-per-tenant is revisitable toward `tenant_id` RLS
   later — but only with the policy graph redesigned for it. *Invalidated by*: routinely >1 day/mo
   per client on undifferentiated ops.
4. **Config-driven policies keep DB-grade integrity.** Moving validation from CHECK constraints
   to policy-reading triggers must not open double-booking races. Mitigation: keep the GiST
   exclusion + `FOR UPDATE` patterns exactly; policy rows only parameterize them; RLS rule 6
   (manual policy tests) extends to booking-policy tests.
5. **Register/brand spread.** Each vertical's guest surface has a different register (camp
   parents ≠ sporting-club members ≠ glamping guests). The token system re-skins colors, not
   voice. Mitigation: `PRODUCT.md`/register re-derivation per fork is part of onboarding
   (§3.3 #4), and copy lives in DB/config, not components.

---

## Executive Summary

**What you have** is further along than "an app for one client": a production bid-to-deposit
machine (quote → e-sign → embedded Stripe payment) that is *precisely the centerpiece artifact*
the events/venues category sells (§1.3), a household membership model that exceeds the
membership-software norm (§1.4), DB-enforced availability that is stronger than the app-level
conflict alerts incumbents ship, a config-in-DB philosophy that is the seed of multi-tenant
cloning, and a guardrailed client-contribution workflow no competitor offers. What you lack is
mostly *identity plumbing* (a tenant layer), *money lifecycle* (schedules, policies, promos), and
*one honest abstraction* (booking policies over a resource+range primitive).

**Top recommendations:**

1. **Clone by deployment, not by fork.** One codebase, registered vertical modules, N Vercel
   projects, one Supabase project per client, one Stripe account per client. Fork-per-client is
   the documented debt trap; `tenant_id` multi-tenancy is the wrong retrofit at 2–10 clients
   given the RLS architecture (§3.1).
2. **Build the universal money spine into the base** — cancellation-policy rules, payment
   schedules/balance-due, promo codes, Stripe Tax, a 5-metric dashboard. Every vertical's
   research demands these; every one also improves Rhythm today (§2).
3. **Make "booking = policy-validated claim on a resource over a time range" the one core
   primitive**, keeping enforcement in Postgres. The bid machine, waiver engine, membership
   model, and notification engine need no redesign — they're already generic (§3.2).
4. **Prove the template with glamping/cabins second** (warm client, maximal abstraction
   stretch, minimal compliance burden), camps third — and let a signed client trigger each
   subsequent module. Don't build OTA sync, algorithmic pricing, POS, gift cards, or photo AI;
   integrate or decline (§3.5).
5. **Price the template business as flat SaaS/retainer, not per-booking fees** — fee resentment
   is the #1 documented switching driver in every vertical you'd enter (§1.1c, §1.2c).

**The single most important next step**: after launch cutover, execute Phase T1 — extract
`site_config` + theme overrides and stand up a second demo deployment (second Vercel project,
second Supabase project, scripted migration push) with zero Rhythm references. It is a week-scale
task that converts the template from a thesis into a demonstrated mechanism, and every
subsequent decision (abstractions, modules, pricing) gets made against a working clone instead
of a slide.

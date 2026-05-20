# App 2 — Public Booking Flow

**Status:** 🔲 Not Started
**Depends on:** App 1 complete (scaffold, Supabase clients, design system, middleware). Database Phases 1–3 complete (`properties`, `services`, `add_ons`, `service_add_ons`, `instructors`, `pricing_rules`, `time_slots`, `bookings` + triggers + exclusion constraint, `bids`).
**Unblocks:** App 6 (Stripe deposit embed lives on the bid page from 2.7), App 7 (Dropbox Sign embed lives on the bid page from 2.7), App 8 (real Resend email replaces the 2.9 shim), App 9 (Inngest workflows fire off the booking-created event from 2.6).

**Epic goal.** Get a public, unauthenticated visitor from `intake.rhythm.co` to a created `bookings` row + `bids` row in Supabase, holding a permanent bid URL they can bookmark. Every database constraint built in Phase 2 (the four ordered BEFORE triggers, the instructor exclusion constraint, the property capacity trigger, the booking_add_ons discipline check) gets exercised here for the first time against real user input — bugs in those constraints surface in this phase or never.

App 2 deliberately stops short of payment, signature, and real email. It renders a bid page in `pending_review` status with placeholder slots where the Stripe embed (App 6), Dropbox Sign embed (App 7), and Resend confirmation (App 8) will plug in. The guest can revisit their bid; the team can see it in the admin queue (App 3); both can wait.

---

## Open questions that affect content but not structure

Build forward with placeholder seed data — the form/route/state shapes don't change when these answers come back.

| Question | Affects | Workaround during App 2 |
|---|---|---|
| Q2 — operating hours per property | `time_slots` seed | Seed a 9 AM / 11 AM / 1 PM placeholder set; rebuild slot picker UI is data-driven so reseeding doesn't touch code |
| Q4 — discipline + add-on catalog | `services`, `add_ons`, `service_add_ons` seed | HSB partial catalog already known; Hog Heaven + Packsaddle seeded with three placeholder disciplines each |
| Q5 — pricing formula | `pricing_rules` schema + live estimate | "Starting from $X" disclaimer; live estimate reads whatever shape `pricing_rules` has and renders a single number with the disclaimer copy |

---

## Sub-phase 2.1 — Public Layout + Property Picker

**Goal.** Stand up the public surface — no auth wall, no portal chrome, a Rhythm-Outdoors-branded shell — and put the guest in front of an explicit property choice (HSB / Hog Heaven / Packsaddle). Hostname-based property pinning (per build proposal §14) is deferred until Q11 lands.

What this builds:

- Route group `app/(public)/` or `app/book/` — separate from `/admin`, `/member`, `/partner`. Middleware (proxy.ts) explicitly **does not** gate it.
- Public root layout that loads brand fonts, exposes the design-system tokens, and renders a public header (logo, no login link — login is portal-specific).
- Property picker page: three brand cards (one per property) reading from the seeded `properties` table. Cards link forward into the booking flow with the property slug in the URL path (`/book/[property]/...`).
- **Booking-funnel state lives in a client-side React Context provider** mounted in the booking layout (`app/(public)/book/[property]/layout.tsx` wraps children in `<BookingFlowProvider>`). The layout stays mounted across step navigation (Next.js App Router behavior), so context state persists when the guest moves between `/type`, `/disciplines`, `/when`, `/details`. Each step's "Back" button is a normal `<Link>` to the prior route — context state is intact when the prior page remounts and reads from it.
- **Refresh resets to step 1.** No cookie, no localStorage, no URL serialization. A `<BookingFlowGuard>` component at each step (after step 1) checks for required prior state in context; if missing — refresh or deep-link — redirects to `/book/[property]` with a "let's start over" toast. This is the deliberate tradeoff: back-navigation is the common case, refresh is the rare case.
- The only state in the URL is the immutable `property` slug. Step identity is captured by the route itself.

---

## Sub-phase 2.2 — Booking-Type Selector

**Goal.** Branch into the three booking flows the database is built around (`plan_a_visit`, `private_lesson`, `host_an_occasion`) before asking the guest anything else. The choice determines duration rules, instructor requirement, and how `capacity_reserved` gets computed by the BEFORE trigger.

What this builds:

- `app/(public)/book/[property]/type/page.tsx` — three branded option cards.
- Cards encode the rules from `plan/supabase/overall-plan.md` "Booking Types": Plan a Visit (2hr fixed, no instructor), Private Lesson (1–3hr, instructor required), Host an Occasion (2–6hr, exclusive use).
- Selected type written to the `BookingFlowProvider` context (2.1).
- "Host an Occasion" warning copy: "exclusive use — your booking blocks all other guests at this property during your window." Sets expectations before the capacity trigger does.
- "Back" button on every subsequent step returns here with the prior selection still highlighted (context state).

Open decision: should "Host an Occasion" instead be a contact-form route (no live calendar — team-quoted)? Build proposal §6 leaves this open. Recommend live-flow with a `team_quoted_price=true` flag — the guest still configures, the team still confirms a custom price.

---

## Sub-phase 2.3 — Discipline + Add-On Picker

**Goal.** Multi-select disciplines from the property's catalog and pick add-ons per discipline. Drives the `booking_disciplines` and `booking_add_ons` rows the create-booking action will insert. Enforces the same `service_add_ons` constraint the deferred constraint trigger checks (so the user can't pick a combination the DB will reject).

What this builds:

- `app/(public)/book/[property]/disciplines/page.tsx`.
- Server-side fetch of `services` filtered by `property_id` + `is_active=true`.
- Discipline chips with multi-select state.
- After each discipline chip is selected, fetch the joined `service_add_ons` → `add_ons` rows for that service, render them as nested optional toggles with quantity (for things like ammunition packages).
- Add-on selection captured per-discipline (matches the `booking_add_ons.service_id` field).
- Skip for `host_an_occasion` if the catalog says so (Q4) — host-an-occasion may not surface discipline selection in the same shape.

Why per-discipline add-ons: a guest who books sporting clays + pistol bays may want ammunition for one but not the other. `booking_add_ons` already models this. The form has to too.

---

## Sub-phase 2.4 — Date + Time-Slot Picker

**Goal.** Pick a date, then a valid start time from the property's `time_slots` for that day-of-week, with **live availability** filtering the slot list against existing bookings and (for Private Lesson) instructor availability. This is the first place where the Phase 2 availability constraints get exercised — the picker mirrors the constraint logic so the guest doesn't submit doomed bookings.

What this builds:

- `app/(public)/book/[property]/when/page.tsx`.
- Calendar control: **shadcn/ui Calendar (Radix-based)** — https://ui.shadcn.com/docs/components/radix/calendar. Lives at `lib/ui/primitives/calendar/calendar.tsx` + `index.ts` (matches the primitive folder pattern). Styled with Tailwind classes that reference our existing CSS-variable tokens (`var(--accent-…)`, `var(--radius-…)`, `var(--text-…)`, etc.) so the calendar inherits brand without duplicating values. This is the first primitive to use Tailwind classes rather than a `.module.css` — that direction matches the recent Phase 3 sweep on portal scaffolding; hand-built primitives keep CSS modules.
- New deps added during 2.4: whatever the shadcn Radix Calendar requires (verify at install time — typically `@radix-ui/react-…` Calendar primitive and a small date lib). Capture exact versions in the commit.
- **Date range bounds read from the DB, not hardcoded.** A new migration (see below) adds `properties.booking_horizon_days INTEGER NOT NULL DEFAULT 30`. The picker queries the property and disables dates earlier than `today` (in the property's timezone) and later than `today + booking_horizon_days`. Same-day booking is allowed — `today` is selectable, no lead-time buffer in App 2.
- Server-side query for the chosen date:
  1. Read `time_slots` for `(property_id, day_of_week)` → candidate `slot_start` values.
  2. For each candidate, compute `start_time` + `end_time` per booking-type duration.
  3. Filter out slots whose `end_time` window already exceeds property capacity (sum of `capacity_reserved` across overlapping active bookings ≥ `properties.max_concurrent_groups`).
  4. For `private_lesson`: assign instructor at picker time? Or just mark "instructor TBD" and let the create-booking action try multiple? **Decision:** assign at picker time. Pick the first instructor with no conflicting `tstzrange` in active bookings. Show "no instructors available" if none. Persist the chosen `instructor_id` into the `BookingFlowProvider` context.
- Slot tiles: available / full / disabled-by-rule.
- Race condition: between picker render and submission, capacity can be claimed by another guest. The DB constraint catches this; 2.6 surfaces the error inline.

`Host an Occasion` simplification: exclusive use means a single capacity unit per slot — picker shows the slot as either fully free or fully taken.

**Migration shipped with this sub-phase.** New file `supabase/migrations/<timestamp>_add_booking_horizon_to_properties.sql`:

```sql
ALTER TABLE properties
  ADD COLUMN booking_horizon_days integer NOT NULL DEFAULT 30
    CHECK (booking_horizon_days BETWEEN 1 AND 365);

COMMENT ON COLUMN properties.booking_horizon_days IS
  'Max days into the future a public guest can book at this property. Admin-editable from App 3 dashboard. Same-day booking is always allowed; lower-bound is now().';
```

The seed values are fine (default 30 applies to all three properties). Admin UI to edit this lands in App 3 — track as a follow-up there. RLS already allows admin update via the existing `properties` policies; no new policy needed.

---

## Sub-phase 2.5 — Guest Info Form + Live Estimate

**Goal.** Collect the contact + party-size fields that populate `bookings.guest_name/guest_email/guest_phone/guest_count/guest_notes`, and render a live "starting from" price estimate that reads from `pricing_rules`. Form-level validation matches the DB-level constraints — so anything the form lets through, the DB accepts.

What this builds:

- `app/(public)/book/[property]/details/page.tsx`.
- Form fields: `guest_name`, `guest_email` (regex), `guest_phone` (loose format), `guest_count` (integer, min 1, max bounded by booking-type rules — `private_lesson` ≤ instructor's max, `plan_a_visit` ≤ a sane upper bound from `pricing_rules`, `host_an_occasion` driven by property capacity), `guest_notes` (free text, capped length).
- Live estimate component (`<EstimatePanel>`): reads booking-session state, calls a `lib/services/pricing/estimate-public.ts` service, renders single price with disclaimer. Pricing service is the **only** place the price formula lives — pure function of (booking_type, property_id, discipline ids, add-on ids + quantities, guest_count). Client never trusts client-side math.
- Disclaimer copy: "Starting from — the team confirms your final price within 24 hours."
- The form is the last step before submit. Submit button → calls the action in 2.6.

`Host an Occasion` variation: estimate panel shows "team-quoted" rather than a number until Q5 sorts out the host-an-occasion pricing model.

---

## Sub-phase 2.6 — Atomic Booking-and-Bid Creation

**Goal.** One Server Action that, in one Postgres transaction, inserts: a `bookings` row → its `booking_disciplines` rows → its `booking_add_ons` rows → a `bids` row with auto-generated slug + access code. Returns the bid URL. Surfaces every DB-side rejection (capacity trigger, instructor exclusion, discipline check) as a friendly form error. This is the centerpiece of App 2.

What this builds:

- `lib/services/bookings/create-public-booking.ts` — service function. Signature: `(input: PublicBookingInput) => Promise<{ bookingId: string; bidSlug: string; bidUrl: string; bidAccessCode: string }>`.
- Input is typed and validated at the service boundary (per CLAUDE.md "Typed interfaces at boundaries"). Zod schema or hand-written type guards — either is fine; pick one and stick to it across all services.
- Uses the **service-role** Supabase client (public guests have no auth session — RLS would otherwise reject the insert). This is one of the very few service-role uses outside `/dev`; document it explicitly in the service file's header comment.
- Transaction:
  1. `INSERT INTO bookings (...) RETURNING id` — Phase 2's four BEFORE triggers fire: `00_compute_end_time` (derives `end_time`), `01_set_capacity_reserved` (1 for visit/lesson, full for occasion), `02_validate_start_time` (matches `time_slots`), `03_check_property_capacity` (refuses if oversold).
  2. Instructor exclusion constraint catches double-bookings on Private Lesson.
  3. `INSERT INTO booking_disciplines` (one per discipline).
  4. `INSERT INTO booking_add_ons` — deferred `booking_add_ons_check_discipline` constraint trigger validates at commit.
  5. `INSERT INTO bids` — `generate_bid_slug()` Postgres function produces the slug; `access_code_hash` set via `validate_bid_access_code()`-paired generator (returns plaintext code for the URL, stores hash).
  6. Commit.
- Error mapping (catch Postgres error codes and re-throw as typed errors the Server Action surfaces inline):
  - `23P01` (exclusion) → "That instructor is no longer available — pick another time."
  - `P0001` from `03_check_property_capacity` → "That slot just filled — pick another time."
  - Custom RAISE from `bookings_validate_start_time` → "That start time isn't valid for this property."
  - `23514` (CHECK) → generic "Booking details don't match our rules" + log for debugging.
- Server Action wrapper at `app/(public)/book/[property]/submit/action.ts` — thin: receive the full `PublicBookingInput` as the action payload (the final step's client component reads everything from `BookingFlowProvider` context and submits it in one go via `useTransition` / `<form action={...}>`), validate, call service, redirect to bid URL. No server-side session state to clear — the context dies when the guest leaves the booking layout.
- Fires an event for App 9 to subscribe to (`booking.created`) — but App 2 only emits, doesn't subscribe.

Why one transaction: a partial booking (booking row but no disciplines, or disciplines but no bid) leaves the DB in an unrecoverable state for the guest. Single transaction or nothing.

---

## Sub-phase 2.7 — Bid Page Skeleton (`/bids/[slug]`)

**Goal.** Render a public, slug-routed bid page the guest can bookmark and return to. Renders the bid's static state — guest name, property, date/time, disciplines, gear list, FAQ, current status — and includes labeled placeholder slots for the Stripe deposit embed (App 6) and Dropbox Sign embed (App 7) so those phases have a clear integration point.

What this builds:

- `app/bids/[slug]/[code]/page.tsx` — server component. The access code is a **path segment**, not a query parameter — keeps it out of the `Referer` header when the bid page links to third-party sites (maps, calendar add-to-cal, etc.).
- Reads the bid by slug via the cookie-aware server client. Access code from the `[code]` route param; verified by calling `validate_bid_access_code()` (Phase 3 helper). Missing/invalid → 404 (not 401 — don't leak existence).
- A bare `/bids/[slug]` route (no code) also resolves to a 404 — the bid is not findable without the code, period.
- Status-aware rendering:
  - `pending_review` → "Your bid is being prepared — we'll email you when it's ready." No embeds. No price.
  - `confirmed` → Full bid: gear list, schedule, FAQ, map, confirmed price. Placeholder slots for sign + pay embeds.
  - `signed` → Same as confirmed, signature slot shows "Signed ✓". Pay slot still active.
  - `paid` → All slots marked done. "We'll see you on <date>" copy.
  - `denied` / `expired` → "This bid is no longer active — contact us to rebook." No embeds.
- Sections: hero (property name + date), guest summary (name, party size), disciplines, gear list (from `bids.gear_list` JSONB), schedule, FAQ accordion (from `bids.faq` JSONB), map embed slot, **signature slot (App 7)**, **deposit slot (App 6)**, contact footer.
- Mobile-first — the build proposal explicitly frames the bid page as a brand moment opened on a phone at a hotel. Hard requirement.
- RLS: anon read on `bids` is gated by `validate_bid_access_code()` per Phase 3 — confirm the policy is in place before merging this phase.

---

## Sub-phase 2.8 — Bid URL Generation + Access-Code Plumbing

**Goal.** Make sure the URL the guest receives is correct, signed, and shareable, but resistant to slug-guessing. The slug alone is not a credential — `?code=...` is. This sub-phase exists separately because it touches the create-booking action, the bid page reader, AND the (later) email template — pulling it into one phase keeps the contract explicit.

What this builds:

- `lib/services/bids/bid-url.ts` — single `buildBidUrl(slug, code)` and `parseBidUrl(req)` pair. Used by 2.6 (to build the URL the action returns), 2.7 (to parse `[slug]` + `[code]` route params), and App 8 later (to embed in the confirmation email).
- Access code: 32 random bytes, base64url-encoded, stored hashed in `bids.access_code_hash`. Never logged.
- URL shape: `https://<single-vercel-domain>/bids/<slug>/<code>` — code as path segment so it doesn't leak via `Referer`. **Single Vercel domain for everything in App 2** (per the Domain Strategy decision); the per-property domains from build proposal §14 (`intake.rhythm.co`, `members.horseshoebaysportingclub.com`, etc.) get wired in a later standalone task, after Q11 resolves.
- Failure modes: slug exists but code is wrong → 404 (treated as not-existent to avoid slug enumeration). Slug doesn't exist → 404. Bare `/bids/[slug]` → 404.

---

## Sub-phase 2.9 — Confirmation Email Shim

**Goal.** After submission, the guest sees a thank-you screen carrying the bid URL **and** a transactional email is "sent" (logged to a `dev_email_outbox` table for now). The real Resend integration lands in App 8 — this phase wires the trigger point and the payload shape so App 8 only swaps the transport.

What this builds:

- `app/(public)/book/[property]/thank-you/page.tsx` — confirmation screen with the bid URL, a "we emailed it to you" line, and a fallback "save this link" button.
- `lib/services/notifications/send-email.ts` — interface-first per CLAUDE.md "Dependency Inversion". Two implementations:
  - `LoggingEmailService` — writes the payload to a `dev_email_outbox` table (new migration, dev-only — drop pre-launch with the rest of `/dev`).
  - `NoopEmailService` — used in unit tests.
- Templates as plain React components in `lib/email/templates/` — props-in, JSX-out. App 8 will render them with React Email when Resend lands; for now they render via `renderToStaticMarkup()` into the `dev_email_outbox.body_html` column for visual review at `/dev/emails`.
- One template now: `<GuestBookingConfirmation>` — guest name, property, date/time, "we're preparing your bid", bid URL, contact line.

Why now and not in App 8: the trigger point is in the create-booking Server Action. Wiring it later means going back into 2.6 — better to set the integration boundary now and let App 8 do a transport swap.

---

## Sub-phase 2.10 — Manual Test Pack + RLS Verification

**Goal.** A repeatable manual test pack that proves App 2 works end-to-end against live Supabase, mirroring the `docs/manual-testing.md` style established in App 1. Every database constraint that Phase 2 added should be hit by at least one scenario.

What this builds in `docs/manual-testing.md` (new "App 2" section):

- **P1** — Happy path Plan a Visit: pick HSB → plan_a_visit → sporting clays + drink cart add-on → tomorrow 9 AM → guest info → submit → land on bid page in `pending_review`.
- **P2** — Happy path Private Lesson: pick property → private_lesson → discipline → tomorrow 11 AM → confirm instructor was assigned → submit → bid page shows instructor name.
- **P3** — Happy path Host an Occasion: confirm exclusive-use copy → confirm capacity trigger reserved full property → submit.
- **P4** — Property capacity rejection: book sporting clays at 9 AM with `max_concurrent_groups=2`, book a second at 9 AM, attempt a third → expect the trigger to RAISE and the form to surface "That slot just filled".
- **P5** — Instructor exclusion rejection: two browsers open on the same instructor + slot, submit nearly simultaneously → expect one to succeed and the other to surface "That instructor is no longer available".
- **P6** — Discipline/add-on mismatch: manually tamper with the request to include an add-on whose `service_add_ons` row doesn't exist → expect the deferred constraint trigger to fire on commit and the form to surface a generic "Booking details don't match our rules" + a structured log line.
- **P7** — Bid URL correctness: confirm `/bids/<slug>/<code>` from the action opens the bid page, `/bids/<slug>` (no code) 404s, and `/bids/<slug>/<wrong-code>` 404s.
- **P8** — RLS — anon cannot read another bid: request `/bids/<A-slug>/<B-code>` → expect 404.
- **P9** — RLS — anon cannot list bids: query the `bids` table directly with the anon key → expect zero rows.
- **P10** — Email shim wrote payload: check the `dev_email_outbox` row exists with the right slug and access code.
- **P11** — Back navigation preserves state: complete steps 1–4 → click Back twice → verify prior selections (booking type, disciplines, date/slot) are still populated → click Forward through to the final step → verify nothing was reset.
- **P12** — Refresh resets to step 1: complete steps 1–3 → refresh the browser → expect redirect to `/book/[property]` with a "start over" toast, not a half-populated step 3.

Verification log appended to `docs/manual-testing.md` once executed. Re-run protocol: any change to the create-booking action, the bid page reader, the `BookingFlowProvider`, or any Phase 2/3 trigger or constraint re-runs P1–P12.

---

## Sub-phase 2.11 — Vercel Preview Smoke + Client Walkthrough

**Goal.** Deploy App 2 to a Vercel preview URL, walk the client through the full public flow, capture feedback. This is the first time the client sees a real working booking flow — feedback here re-shapes Apps 3–8.

What this builds:

- A preview deploy on the `app-2-public-booking` branch.
- Preview env vars confirmed against the production Supabase project (or a dedicated staging project if we've split — see Deferred Improvements).
- A walk-through script (~6 minutes of click-throughs) the client can do without our hand-holding.
- A feedback log file at `docs/app-2-client-feedback.md` capturing every comment + whether it's a fix-now, fix-in-App-3, or defer.

Exit criteria for App 2:

1. All 10 manual scenarios in 2.10 pass against the preview URL.
2. The client has done a walkthrough and signed off on the flow (verbally or in writing).
3. Every Q2 / Q4 / Q5 placeholder is documented as "swap me out when answered" with the exact file paths.
4. TRACKER.md flipped from 🔄 to ✅ for App 2.

---

## Cross-cutting decisions captured by this phase

These bind App 3+ once App 2 ships:

1. **Public writes go through service-role Server Actions.** No anon-key insert path exists for `bookings` / `bids` — `lib/services/bookings/create-public-booking.ts` is the only door, and it's audited for input validation.
2. **One service per business operation.** "Create a booking" is one service; "send a confirmation email" is another; "render a bid page" is another. No service does two things.
3. **DB rejections are first-class errors in the UI.** The capacity trigger, exclusion constraint, and check constraints are user-visible failure modes — they get friendly error copy and structured logs, not "something went wrong".
4. **The bid URL is the deliverable.** Every code path that creates a booking returns a bid URL. Every code path that contacts the guest contains the bid URL. App 6, 7, 8 all attach to bids by slug.
5. **Placeholder slots are explicit.** Where App 6 / 7 / 8 plug in, the bid page renders a labeled placeholder div with a comment pointing at the App that owns it. No `TODO` comments — labeled placeholders only.
6. **Funnel state is client-only and route-stable.** `BookingFlowProvider` in the booking layout holds in-progress form state. Back-navigation is the common case and works transparently via Next.js client-side routing (the layout never remounts); refresh dumps state and redirects to step 1 — accepted tradeoff. No cookies, no localStorage, no URL-serialized state beyond the property slug.

---

## Risk register

| Risk | Mitigation |
|---|---|
| The seed catalogs (Q4) change shape after build → discipline picker breaks | Build the picker purely data-driven from `services` / `add_ons` / `service_add_ons` — schema changes that don't change the table shape won't touch the UI. |
| Q5 pricing formula needs a new column on `pricing_rules` | Estimate service is the only consumer — schema additions land in one file. |
| Capacity-trigger error message is opaque | 2.6 explicitly maps Postgres error codes to user copy; manual scenario P4 in 2.10 verifies it. |
| Bid URL access code visible in server logs / analytics | Code is a path segment (per Bid URL decision). Path segments appear in Vercel access logs and any client-side analytics that capture `pathname`. Mitigation: filter `/bids/*` from analytics; if Vercel logs are a concern long-term, swap to a server-set httpOnly cookie scheme post-launch. Out of scope for App 2. |
| Race between picker availability check and submission | The DB constraint is the source of truth — the picker is a UX hint. 2.6 surfaces the rejection inline; 2.10 P5 verifies. |
| Service-role client used in 2.6 expands beyond bookings | Add an explicit allowlist comment in `lib/supabase/service.ts` listing every caller. Reviewed in App 3 + App 4. |

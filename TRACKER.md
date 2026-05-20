# Rhythm Outdoors — Project Tracker

Status key: ✅ Done · 🔄 In Progress · ⏸ Blocked · 🔲 Not Started

---

## Session Handoff (last updated 2026-05-18)

**Where we are.** Foundation, auth gate, Phase 7 RLS reference doc, and the production `/login` surface (magic-link + Google OAuth) are all landed and partially verified against live Supabase. The JWT-refresh path in the callback was hardened during testing — Google sign-in for both admin and member is now confirmed working end-to-end.

- **Database** — All 9 migrations applied to project `vgmlordqsigalrpmuwap` (Phases 1, 2, 3, 4, 5, 6 + Phase 4 hotfix + split-into-people-memberships refactor + household visibility). Phase 7 is documentation-only and regenerated at `plan/supabase/phase-7-rls.md` — canonical RLS reference matching the live schema.
- **Schema model** — `people` + `memberships` + `membership_people` junction (supports cross-property + household sharing). RLS uses six SECURITY DEFINER helper functions (`current_person_id`, `current_member_membership_ids`, `current_member_active_membership_ids`, `current_member_active_property_ids`, `current_household_person_ids`, `staff_visible_person_ids`) to break cross-table policy cycles — see CLAUDE.md "RLS Rules" and Phase 7 doc for the patterns.
- **Auth gate** — All 5 scenarios in `docs/manual-testing.md` (A, B, B2, C, D, E) passed end-to-end on 2026-05-18 against live Supabase. Scenario F (production `/login`) added the same day; partially verified live (Google OAuth admin + member sign-in confirmed working after a JWT-refresh fix, see below) — full systematic Scenario F run still pending.
- **`/login` surface** — Real production page at `/login`, styled per the HSB members portal reference (umbrella Rhythm Outdoors brand). Server component with `?next=` open-redirect guard + already-signed-in redirect. Client `<LoginForm>` offers magic-link (`signInWithOtp({ shouldCreateUser: false })`) AND Continue-with-Google (`signInWithOAuth({ provider: 'google' })`). `<CyclingProperty>` beneath the wordmark fades through Horseshoe Bay / Hog Heaven / Packsaddle. `portalHomeForRole()` extracted to `lib/auth/portal.ts` and shared with `/auth/callback`. Failed sign-ins (no pending invite / expired invite) now render as a dismissible inline `<LoginAlert>` at the top of the card via `/login?error=invite-not-found&email=...`; the standalone `/invite-not-found` route was removed.
- **Design system** — `app/globals.css` now carries a full token system, not just the brand palette: semantic accents (error/warn/info/success), elevation shadows (soft/lift), serif + sans family aliases, a full type scale (`--text-eyebrow` 11px → `--text-display` clamp(48,8vw,72)), tracking + leading scales, 4px-base spacing (`--space-1`…`--space-24`), radius scale (sharp/card/pill), motion timings (fast/base/slow), layout widths (max/narrow/prose), AND a global `prefers-reduced-motion: reduce` baseline that clamps animations to 0.01ms. Cormorant Garamond + Inter loaded via `next/font/google` in `app/layout.tsx`.
- **Callback hardening** — `/auth/callback` now calls `supabase.auth.refreshSession()` unconditionally before redirecting (previously only in the first-time-link branch). Fixes a real bug where Google OAuth landed users on `/unauthorized` even though their `auth.users.app_metadata.role` was correct — the post-exchange JWT was missing the role claim, and the role check in middleware bounced them.
- **Supabase dashboard config** — Google OAuth provider is configured (Google Cloud OAuth client + Supabase Auth → Providers → Google enabled). Account linking is on, so duplicate auth users from email + Google identity collisions should no longer happen.
- **Application** — Next.js 16 + TypeScript scaffold; three Supabase clients (browser publishable, cookie-aware server, secret-key service role); auth middleware with strict role-per-portal allowlist; `/auth/callback` with PKCE + token_hash dual-flow support and unconditional JWT refresh; `/member` stub with household-member visibility; production `/login` (per above); `/admin`, `/partner`, `/unauthorized`, `/auth/auth-code-error` stubs; `/dev` test dashboard. `tsc --noEmit` clean.
- **Vercel deploy** — not yet connected. Effectively the only operational gap left on App 1.
- **Open client questions** — Q2 / Q4 / Q5 / Q9 / Q14 / Q16 still block seed data for `time_slots`, `services`, `add_ons`, `instructors`, `pricing_rules`, and the membership tier vocabulary. None block schema or auth work — all that is done.

**How to resume in a fresh session:**

1. `git pull` to get to the latest main.
2. Read `CLAUDE.md`, then this file, then the plan doc for whichever phase you're touching next (in `plan/supabase/phase-*.md`).
3. Verify the DB hasn't drifted: `./node_modules/.bin/supabase migration list` should show 9 matched rows.
4. Verify local dev: `npm run dev` should boot and list 3 properties at `/`.
5. Pick one of the next moves below and go.

**Dev tool — `/dev`.** A temporary password-gated dashboard at `http://localhost:3000/dev` for testing the auth flow: create person + membership(s) (multi-property checkbox-select), add authorized person to existing membership (household scenario), send invite, generate magic-link URL (no email — bypasses rate limit + template config), force-expire invite, stamp `app_metadata.role` on any user, reset a test user (deletes person + memberships where primary + auth user). Gate uses the `DEV_DASHBOARD_PASSWORD` env var (server-only — not `NEXT_PUBLIC_*`). Set it in `.env.local` before first use. Cookie is `httpOnly`, scoped to `/dev`, 24-hour TTL; rotates automatically when the env var changes. **Remove the entire `/dev` tree before launch.**

**Manual test plans live in `docs/manual-testing.md`.** Seven scenarios for the auth gate: A (single-property), B (cross-property), B2 (household sharing), C (wrong-role bounce), D (expired invite), E (property-manager scope), F (real `/login` page — 10 steps including magic-link and Google OAuth paths). A–E all passed end-to-end on 2026-05-18 — see Verification log in the testing doc. F is partially verified live (Google OAuth admin + member confirmed working after the JWT-refresh fix; invite-not-found alert verified). Re-run A–F before any change touching `/auth/callback`, `middleware.ts`, the people/memberships/junction schema, the `/login` page, or any RLS policy on those tables.

**Next moves — pick one based on what the user wants:**

- **A. Continue App 4 — my bookings + adventures listing on `/member`** *(recommended)*. Replace the household-visibility stub with the real member dashboard. Lists the member's bookings (via `bookings.member_user_id = auth.uid()` — RLS already in place) and adventures available at any of their active properties (via `current_member_active_property_ids()` — already in place). RSVP UX comes after.
- **B. Configure custom SMTP (Resend) for Supabase Auth** — replaces the built-in mailer's ~3–4/hour rate limit and unblocks the magic-link email path on `/login` for production deliverability. ~30 min in the Supabase dashboard. Resend is already in the project stack. After this, Scenario F steps 2 + 3 + 5 can be run with real email instead of the `/dev` substitute.
- **C. Wire Vercel deploy** — Connect the GitHub repo in the Vercel dashboard, add the same env vars from `.env.local` (publishable key, secret key, `BID_COOKIE_SECRET`, `DEV_DASHBOARD_PASSWORD`), trigger the first deploy. ~30–60 min, no code. Worth doing soon so preview URLs work for client review.
- **D. Finish the formal Scenario F pass** — most of the scenario was hit during live testing this session (Google OAuth admin + member, invite-not-found alert) and exposed + fixed the JWT-refresh bug. A clean re-run against the current code is still worth doing — particularly steps 2/3/5 (magic-link email round-trip, `?next=` passthrough) if Path B (SMTP) is done first, otherwise via `/dev` magic-link substitute. ~15 min.
- **E. Start App 2 (Public Booking Flow)** — property selection → service → time → guest info → checkout → bid page. All DB tables it touches exist, though `services`/`time_slots`/`pricing_rules` rows are blocked on client questions. Could be built against placeholder seed data.
- **F. Get the six open client questions in front of the client.** Q2 + Q4 are the lowest-cost asks ("send us your operating hours" + "send us your catalogs") and unblock the most seed data. Pure project management — no code work for us.

**Recommendation:** **A (member dashboard)** is the natural next build now that login is in. **B (Resend SMTP)** is the lightest dashboard-only task and unblocks real magic-link delivery — do it in parallel if you can. **C (Vercel)** is the same shape — dashboard config, no code — and lets the client see preview URLs.

---

## Database Phases (Supabase)

| # | Epic | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| Phase 1 | Foundation Tables | ✅ Done | 2026-05-17 | properties (3 seeded), time_slots, services, add_ons, service_add_ons, instructors, pricing_rules |
| Phase 2 | Booking System | ✅ Done | 2026-05-17 | bookings, booking_disciplines, booking_add_ons. Four ordered BEFORE triggers (00_compute_end_time, 01_set_capacity_reserved, 02_validate_start_time, 03_check_property_capacity) + updated_at + deferred booking_add_ons_check_discipline constraint trigger. Instructor exclusion constraint using tstzrange. UNIQUE partial indexes on both Stripe payment intent columns. Post-review fixes (trigger ordering, discipline check, payment intent uniqueness) folded directly into the Phase 2 migration. RLS perf wrapping `auth.jwt()` / `auth.uid()` in `(SELECT …)` already in place. |
| Phase 3 | Bids | ✅ Done | 2026-05-18 | `bids` (with `access_code_hash`), slug generation, `validate_bid_access_code()` SECURITY DEFINER function, bid↔booking sync trigger that RAISEs on unexpected source states, polling-based status updates (Realtime intentionally not used — anon clients can't receive RLS-gated events), `UNIQUE` partial indexes on `dropbox_sign_envelope_id` and `refund_payment_intent_id`. Requires `pgcrypto` extension. |
| Phase 4 | Auth & Users | ✅ Done | 2026-05-18 | `partner_organizations` (split admin insert/update/delete policies); `people` + `memberships` + `membership_people` junction (after the 2026-05-18 split — see refactor row below); `membership_status_enum`. Five JWT helper functions: `auth_role`, `auth_property_id`, `auth_partner_org_id`, `is_admin`, `is_staff` — all `SECURITY INVOKER`, all wrap `auth.jwt()` in `(SELECT …)`. Application-side pieces (`/auth/callback` person link + invite expiry enforcement, Inngest seed-people-invites) are App-phase work, not DB. Hotfix `20260518230913_phase_4_fix_user_id_unique.sql` dropped accidental UNIQUE on the old `members.user_id` (since superseded by the split). |
| Phase 4 refactor | members → people + memberships | ✅ Done | 2026-05-18 | Migration `20260518232029_split_members_into_people_memberships.sql`. Splits the old `members` table into `people` (the human — email, name, phone, auth link), `memberships` (the account — member_number, tier, dues, status, property), and `membership_people` (junction with role: primary/spouse/dependent/authorized). Partial unique index enforces exactly one active primary per membership. Triggers `ON DELETE CASCADE` from memberships to junction, and from people to junction. RSVPs recreated against `memberships.id` (with `created_by_person_id` for audit) — UNIQUE (adventure_id, membership_id) means one RSVP per membership per adventure, regardless of which spouse made it. `member_adventures` member-read RLS updated to traverse people → membership_people → memberships. Resolves the "two emails sharing a membership" product question. |
| Phase 5 | Member Adventures | ✅ Done | 2026-05-18 | `member_adventures`, `member_adventure_rsvps`. Capacity trigger with `FOR UPDATE` row lock enforces total capacity + per-RSVP `max_guests_per_rsvp` cap + staff-set `is_manually_sold_out` block (3rd-party operator says full). Pricing: solo `price` + nullable `guest_price` add-on per extra guest. Auto-sync `sold_out` triggers skip when `is_manually_sold_out=true` so a single cancellation can't re-open booking. Member RLS joins `members` on `user_id = auth.uid()` for cross-property reads; member writes route through Server Actions (no `FOR UPDATE` policy). Waitlist via Inngest (depends on Phase 6 webhook layer); Inngest waitlist promoter re-reads the manual flag and aborts if set. |
| Phase 6 | Webhook Idempotency | ✅ Done | 2026-05-18 | `processed_webhooks` with `(id, source, event_type, payload)`, PK `(id, source, event_type)` for multi-event-per-object providers. Claim-first idempotency pattern via `INSERT … ON CONFLICT DO NOTHING`. RLS enabled with no policies (defends against Supabase's default GRANTs to anon). `pg_cron` weekly cleanup at 30 days. |
| Phase 7 | RLS Architecture | ✅ Done | 2026-05-18 | **Documentation only — no migration.** Canonical RLS reference regenerated to match the live schema: people/memberships/junction model, six SECURITY DEFINER helper functions, three RLS cycles encountered and how each was fixed, complete policy reference per table, strict portal allowlist + preview-as-member design, testing protocol (refs `docs/manual-testing.md`), common pitfalls, and a changelog of every policy-level change since Phase 4 cut. Maintenance rule: update in the same commit as any RLS or helper change in Phases 1–6. See `plan/supabase/phase-7-rls.md`. |

### Pending Seeds (blocked by client confirmation)

| Table | Blocked By |
|-------|-----------|
| `time_slots` | Q2 — operating hours per property |
| `services` | Q4 — full discipline catalog (HSB partial ready) |
| `add_ons` | Q4 |
| `service_add_ons` | Q4 |
| `instructors` | Q2 — headcount per property |
| `pricing_rules` | Q5 — pricing formula confirmed ($200/hr private lesson done; group tiers TBD) |

---

## Application Phases (Next.js)

| # | Epic | Status | Notes |
|---|------|--------|-------|
| App 1 | Project Scaffold | ✅ Done | Completed 2026-05-19. Eleven sub-phases (scaffold → Supabase clients → design tokens → UI primitives → auth middleware → callback → `/login` → portal stubs → `/dev` dashboard → manual test pack → Vercel deploy). Full breakdown + goals per sub-phase in `plan/app/app-1-scaffold.md`. Auth gate verified live (Scenarios A–E passed 2026-05-18, Scenario F Google-OAuth path verified during JWT-refresh-fix testing). Vercel deploy connected with env vars mirrored from `.env.local`. App 2 unblocked. |
| App 2 | Public Booking Flow | 🔄 In Progress | Sub-phase 2.1 landed 2026-05-19: public route group at `app/(public)/` (proxy.ts does not gate it), minimal public header (logo only), property picker at `/book` reading the `properties` table via `src/services/public/properties.ts`, per-property layout at `/book/[property]` mounting `<BookingFlowProvider>` (client-side React Context — funnel state survives back-nav, refresh resets), `<BookingFlowGuard>` for steps 2+ that redirects to `/book/[property]?reset=1` and renders a "let's start over" alert. No cookies / localStorage / URL state beyond the `[property]` slug. **Post-land review passes (same day):** `/simplify` (three parallel agents — reuse / quality / efficiency) and a manual walkthrough of `.agents/skills/vercel-react-best-practices` produced cleanups in-place — dropped a duplicate property fetch in the layout, dropped `propertySlug` from the provider (read from `useParams()`), dropped a no-op `useMemo`, hoisted `?reset=1` into a `BOOKING_RESET_PARAM` / `buildBookingResetUrl()` contract, derived `BookingFlowGuard.hasAll` during render instead of via `useState` + effect, promoted `propertyOrdinal()` + `getPublicProperties()` so `app/page.tsx` consumes the new shared helpers, and slashed WHAT-comments across the new files. Editorial-distinct taglines on the home page were kept (reviewer over-claimed identity). **Remaining:** 2.2 booking-type selector → 2.11 client preview walkthrough. Plan in `plan/app/app-2-public-booking.md`. |
| App 3 | Admin Portal | 🔲 Not Started | Booking review, bid editor, status management. Includes **"preview as <member>"** — reuses `/member` components with member-id-driven data fetching via admin's RLS scope. Strict portal allowlist means admins never enter `/member` directly; member visibility lives inside `/admin`. See CLAUDE.md "Architecture Decisions" for rationale. |
| App 4 | Member Portal | 🔄 In Progress | Production `/login` surface landed 2026-05-18 — server component with `?next=` open-redirect guard + already-signed-in redirect, client `<LoginForm>` offering both **magic-link** (`signInWithOtp({ shouldCreateUser: false })`) and **Continue with Google** (`signInWithOAuth({ provider: 'google' })`). Styled per HSB members portal reference (umbrella Rhythm Outdoors brand) with a `<CyclingProperty>` component beneath the wordmark and dismissible `<LoginAlert>` for callback-emitted errors (`?error=invite-not-found&email=...` replaces the standalone `/invite-not-found` route). Brand design system landed in `app/globals.css`: palette, semantic accents (error/warn/info/success), elevation shadows, full type scale (`--text-eyebrow` → `--text-display`), tracking + leading scales, spacing scale (4px base), radius scale, motion timings, layout widths, plus a global reduced-motion baseline. Cormorant Garamond + Inter wired via `next/font/google` in `app/layout.tsx`. `portalHomeForRole()` extracted to `lib/auth/portal.ts` and shared with `/auth/callback`. `/auth/callback` now calls `refreshSession()` unconditionally before redirecting (fixes a real bug where Google OAuth bounced authorized users to `/unauthorized` because the post-exchange JWT was missing `app_metadata.role`). Google OAuth confirmed working live for both admin and member sign-in. Scenario F (10 steps) added to `docs/manual-testing.md`; partially verified during dev. **Remaining App 4 work**: my bookings, adventures listing, RSVP UI. |
| App 5 | Partner Portal | 🔲 Not Started | Concierge login, book on behalf of guest |
| App 6 | Payments | 🔲 Not Started | Stripe deposit embed on bid page, webhook handler |
| App 7 | E-Sign | 🔲 Not Started | Dropbox Sign envelope creation, signed webhook |
| App 8 | Notifications | 🔲 Not Started | Resend transactional emails (confirmation, bid link, reminders) |
| App 9 | Workflows | 🔲 Not Started | Inngest — expiry, waitlist promotion, HubSpot sync |
| App 10 | Observability | 🔲 Not Started | Sentry error tracking, Axiom logs |

---

## Open Questions (blocking seed data or design decisions)

| ID | Question | Blocking |
|----|----------|---------|
| Q2 | Operating hours and instructor headcount per property | time_slots seed, instructors seed |
| Q4 | Full discipline + add-on catalog for Hog Heaven and Packsaddle | services seed, add_ons seed |
| Q5 | Group pricing tiers for plan_a_visit (per-person rates by group size) | pricing_rules seed |
| Q9 | Membership tier names and definitions | members.membership_tier, adventures access gating |
| Q14 | Adventures: deposit upfront or full payment at RSVP? | Phase 5 payment flow |
| Q16 | Annual dues model (affects membership lapse logic) | membership_status_enum |

---

## Deferred Improvements

Items identified during review as worth doing eventually but explicitly deferred — not blocking, not bugs. Promote to active work when the listed condition becomes true.

| Phase | Item | Reason Deferred | Promote When |
|-------|------|----------------|--------------|
| Phase 3 | `generate_bid_slug` retry-on-conflict inside the function | Slug collisions resolve via UNIQUE constraint + app-layer retry; expected volume is tiny | Logs show serialization errors at bid creation |
| Phase 3 | `bids_status_history` audit trail (who confirmed/denied/regenerated, when) | Single-staff operation today; cheap to add later but adds a table + trigger | More than one staff member regularly edits bids, or a dispute requires reconstructing a bid's history |
| Phase 3, 5 | `CHECK (jsonb_typeof(...))` on `bids.gear_list`, `bids.faq`, and `member_adventures.details` | App layer validates shape today; small trusted authoring team | Before public launch, or after any bug from malformed JSON |
| Phase 5 | `created_by_user_id` audit on `member_adventures` and `member_adventure_rsvps` | Same audit-trail family as Phase 3 bids — single-staff operation today | Dispute resolution requires "who created/edited this adventure or RSVP" or more than one staff member regularly touches adventures |
| Phase 5 | Belt-and-braces "RSVP's member.property_id matches adventure.property_id" trigger | RLS already enforces this on the member path; service-role mis-writes would be the only way to violate it | A bug or incident shows a service-role path could create a mismatched RSVP |
| Phase 5 → 6 | Waitlist promotion via Supabase Database Webhook → Inngest depends on the Phase 6 webhook/idempotency layer | Configurable in dashboard (no SQL), but the receiving Inngest endpoint must use `processed_webhooks` for dedupe | When Phase 6 is built — wire the `rsvp.cancelled` webhook through Phase 6's idempotent receiver |
| Phase 6 → 10 | Structured logging on the duplicate-claim path (`23505` conflict) for idempotency observability | Belongs in Phase 10 (Sentry / Axiom integration), not the webhook handler itself | Phase 10 is in progress — emit a `webhook.duplicate_claim` structured event with `{ source, event_type, id }` so Axiom can chart it |

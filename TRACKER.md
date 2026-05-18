# Rhythm Outdoors — Project Tracker

Status key: ✅ Done · 🔄 In Progress · ⏸ Blocked · 🔲 Not Started

---

## Session Handoff (last updated 2026-05-18)

**Where we are.** All foundational DB work and the Next.js scaffold are in place:

- **Database** — Phases 1, 2, 3, 4, 6 applied to project `vgmlordqsigalrpmuwap`. Phase 5 (Member Adventures) is the only remaining DB migration. Phase 7 is documentation-only (no migration). Both Phase 5 and Phase 7 plan docs have been reviewed and tightened — they are ready to apply / use as-is.
- **Application** — Next.js 16 + TypeScript scaffold landed; three Supabase clients (browser publishable, cookie-aware server, secret-key service role) + auth middleware + smoke-test landing page wired. Local `npm run dev` confirmed working against the live Supabase. Vercel deploy is not yet connected.
- **Open client questions** — Q2 / Q4 / Q5 / Q9 / Q14 / Q16 still block seed data for `time_slots`, `services`, `add_ons`, `instructors`, `pricing_rules`, and the membership tier vocabulary. None block more schema work.

**How to resume in a fresh session:**

1. `git pull` to get to the latest main.
2. Read `CLAUDE.md`, then this file, then the plan doc for whichever phase you're touching next (in `plan/supabase/phase-*.md`).
3. Verify the DB hasn't drifted: `./node_modules/.bin/supabase migration list` should show 5 matched rows.
4. Verify local dev: `npm run dev` should boot and list 3 properties at `/`.
5. Pick one of the next moves below and go.

**Next moves — pick one based on what the user wants:**

- **A. Apply Phase 5 (Member Adventures)** — the last DB migration. Plan is ready at `plan/supabase/phase-5-adventures.md`. Unblocks App 4 (Member Portal).
- **B. Build `/auth/callback` route handler + portal middleware guards** — exercises Phase 4 auth. The `/auth/callback` flow needs to link every pending `members` row for the signed-in user's email and enforce `invite_expires_at`. The middleware needs `/admin`, `/member`, `/partner` allowlists based on `app_metadata.role`. See `plan/supabase/phase-4-auth-users.md` Steps 4 and "Middleware Route Guards" for the exact shape.
- **C. Wire Vercel deploy** — Connect the GitHub repo in the Vercel dashboard, add the same env vars from `.env.local` (publishable key, secret key, BID_COOKIE_SECRET), trigger the first deploy.
- **D. Get the six open client questions in front of the client.** Q2 + Q4 are the lowest-cost asks ("send us your operating hours" + "send us your catalogs") and unblock the most seed data. Pure project-management work — no code from us required.

If unsure, **B** is the most leveraged code path — every portal phase depends on it, and it's tangible progress against a working scaffold.

---

## Database Phases (Supabase)

| # | Epic | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| Phase 1 | Foundation Tables | ✅ Done | 2026-05-17 | properties (3 seeded), time_slots, services, add_ons, service_add_ons, instructors, pricing_rules |
| Phase 2 | Booking System | ✅ Done | 2026-05-17 | bookings, booking_disciplines, booking_add_ons. Four ordered BEFORE triggers (00_compute_end_time, 01_set_capacity_reserved, 02_validate_start_time, 03_check_property_capacity) + updated_at + deferred booking_add_ons_check_discipline constraint trigger. Instructor exclusion constraint using tstzrange. UNIQUE partial indexes on both Stripe payment intent columns. Post-review fixes (trigger ordering, discipline check, payment intent uniqueness) folded directly into the Phase 2 migration. RLS perf wrapping `auth.jwt()` / `auth.uid()` in `(SELECT …)` already in place. |
| Phase 3 | Bids | ✅ Done | 2026-05-18 | `bids` (with `access_code_hash`), slug generation, `validate_bid_access_code()` SECURITY DEFINER function, bid↔booking sync trigger that RAISEs on unexpected source states, polling-based status updates (Realtime intentionally not used — anon clients can't receive RLS-gated events), `UNIQUE` partial indexes on `dropbox_sign_envelope_id` and `refund_payment_intent_id`. Requires `pgcrypto` extension. |
| Phase 4 | Auth & Users | ✅ Done | 2026-05-18 | `partner_organizations` (split admin insert/update/delete policies), `members` (cross-property — one email may map to N rows with shared `user_id`), `membership_status_enum`. Five JWT helper functions: `auth_role`, `auth_property_id`, `auth_partner_org_id`, `is_admin`, `is_staff` — all `SECURITY INVOKER`, all wrap `auth.jwt()` in `(SELECT …)`. No `auth_member_id` — cross-property members have no single property in `app_metadata`. Application-side pieces (`/auth/callback` multi-row linking + invite expiry enforcement, Inngest `seed-member-invites`) are App-phase work, not DB. |
| Phase 5 | Member Adventures | 🔲 Not Started | — | `member_adventures`, `member_adventure_rsvps`. Capacity trigger with `FOR UPDATE` row lock; max_capacity resync trigger; sold_out auto-sync. Member RLS joins `members` on `user_id = auth.uid()` for cross-property reads; member writes route through Server Actions (no `FOR UPDATE` policy). Waitlist via Inngest (depends on Phase 6 webhook layer). |
| Phase 6 | Webhook Idempotency | ✅ Done | 2026-05-18 | `processed_webhooks` with `(id, source, event_type, payload)`, PK `(id, source, event_type)` for multi-event-per-object providers. Claim-first idempotency pattern via `INSERT … ON CONFLICT DO NOTHING`. RLS enabled with no policies (defends against Supabase's default GRANTs to anon). `pg_cron` weekly cleanup at 30 days. |
| Phase 7 | RLS Architecture | 🔲 Not Started | — | **Documentation only — no migration.** Regenerated cross-cutting reference: role capability matrix, complete policy reference, testing protocol (including a cross-property member recipe), common pitfalls. Must be kept in sync with Phases 1–6 whenever an RLS policy or helper changes. |

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
| App 1 | Project Scaffold | 🔄 In Progress | Next.js 16 App Router + TypeScript scaffold landed (2026-05-18). Three Supabase clients (browser publishable, cookie-aware server, secret-key service role), auth middleware, smoke-test page. Env vars filled in `.env.local`; Node upgraded; `npm run dev` confirmed working against live Supabase (lists the 3 properties). **Remaining**: connect the GitHub repo in the Vercel dashboard, add the same env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY), trigger the first deploy. |
| App 2 | Public Booking Flow | 🔲 Not Started | Property selection → service → time → guest info → checkout → bid page |
| App 3 | Admin Portal | 🔲 Not Started | Booking review, bid editor, status management |
| App 4 | Member Portal | 🔲 Not Started | Login, my bookings, adventures, RSVP |
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

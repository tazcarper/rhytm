# Rhythm Outdoors — Project Tracker

Status key: ✅ Done · 🔄 In Progress · ⏸ Blocked · 🔲 Not Started

---

## Database Phases (Supabase)

| # | Epic | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| Phase 1 | Foundation Tables | ✅ Done | 2026-05-17 | properties (3 seeded), time_slots, services, add_ons, service_add_ons, instructors, pricing_rules |
| Phase 2 | Booking System | ✅ Done | 2026-05-17 | bookings, booking_disciplines, booking_add_ons. Four ordered BEFORE triggers (00_compute_end_time, 01_set_capacity_reserved, 02_validate_start_time, 03_check_property_capacity) + updated_at + deferred booking_add_ons_check_discipline constraint trigger. Instructor exclusion constraint using tstzrange. UNIQUE partial indexes on both Stripe payment intent columns. Post-review fixes (trigger ordering, discipline check, payment intent uniqueness) folded directly into the Phase 2 migration. RLS perf wrapping `auth.jwt()` / `auth.uid()` in `(SELECT …)` already in place. |
| Phase 3 | Bids | 🔲 Not Started | — | bids, slug generation, bid↔booking sync triggers, Realtime publication |
| Phase 4 | Auth & Users | 🔲 Not Started | — | partner_organizations, members, JWT helpers, invite flow |
| Phase 5 | Member Adventures | 🔲 Not Started | — | member_adventures, member_adventure_rsvps, capacity trigger, waitlist via Inngest |
| Phase 6 | Webhook Idempotency | 🔲 Not Started | — | processed_webhooks, pg_cron cleanup |
| Phase 7 | RLS Architecture | 🔲 Not Started | — | Full policy audit, testing protocol, and refactor of inline JWT parsing to use Phase 4 helper functions (`auth_role()`, `is_admin()`, `auth_property_id()`, etc.). The `(SELECT …)` perf wrap is already in place. |

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
| App 1 | Project Scaffold | 🔲 Not Started | Next.js app router setup, Supabase client, env vars, Vercel deploy |
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

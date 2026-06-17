# Rhythm Outdoors — Claude Code Project Guide

## Project Overview

A single Next.js web application serving three properties — Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, and Packsaddle Precision — from one codebase. Three portals (public, member, partner), one backend, one database.

**Core outcome:** Every inquiry ends as a signed bid page with embedded deposit — no phone calls, no five-tab lookups.

**Project tracker:** See `TRACKER.md` for phase status (what's done, in progress, blocked, and next). Update it whenever a phase completes.

## Stack

| Layer | Tool |
|---|---|
| Frontend + API | Next.js 16 (App Router) on Vercel |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Email | Resend |
| E-sign | Dropbox Sign |
| File storage | Vercel Blob |
| CRM | HubSpot (fed by app, not source of truth) |
| Workflows | Inngest |
| Observability | Sentry + Axiom |

## Agents

Custom agents live in `./agents/`. Use them with `/agents/<name>` or via the agent picker.

| Agent | File | When to use |
|---|---|---|
| Supabase Auth & Access Architect | `./agents/supabase_auth_rls_agent.md` | JWT claim design, RLS policy architecture, multi-portal auth flows (member/partner/admin), middleware route guards, `app_metadata` role setup |

## Skills

Installed skills are tracked in `skills-lock.json`. Use them with `/skill <name>`.

| Skill | Source | When to use |
|---|---|---|
| `supabase` | `supabase/agent-skills` | Supabase client setup, RLS policies, auth helpers, realtime, storage |
| `supabase-postgres-best-practices` | `supabase/agent-skills` | Postgres schema conventions, RLS design patterns, type safety |
| `resend` | `resend/resend-skills` | Resend email API integration, transactional email, React Email templates |
| `email-best-practices` | `resend/resend-skills` | Deliverability, compliance, and UX rules for outbound email |
| `deploy-to-vercel` | `vercel-labs/agent-skills` | Vercel deployment, environment variables, preview URLs |
| `react-best-practices` | `vercel-labs/agent-skills` | 40+ React/Next.js performance rules — waterfalls, bundle size, SSR, re-renders |
| `sentry-nextjs-sdk` | `getsentry/sentry-for-ai` | Add Sentry to Next.js, configure error boundaries, source maps |
| `sentry-fix-issues` | `getsentry/sentry-for-ai` | Query Sentry, triage errors, fix production issues in place |
| `stripe-best-practices` | `stripe/ai` | Stripe payment integration, webhooks, deposit flows, Restricted API Keys |
| `sre` | `axiomhq/skills` | Hypothesis-driven incident investigation with Axiom logs |
| `query-metrics` | `axiomhq/skills` | Run metrics queries against Axiom, discover available metrics and tags |

## Next.js Documentation

The full Next.js 16 docs are bundled locally in `node_modules/next/dist/docs/`. Reference them directly when making any Next.js / React updates — no web lookup needed.

```
node_modules/next/dist/docs/
├── 01-app/
│   ├── 01-getting-started/   # Installation, project structure, layouts, routing, data fetching, caching
│   ├── 02-guides/            # Auth, testing, deployment, migrations
│   ├── 03-api-reference/     # Directives, components, file conventions, functions, next.config.js, CLI
│   └── 04-glossary.md
├── 02-pages/                 # Pages Router (not used in this project)
├── 03-architecture/          # Fast refresh, compiler, accessibility
└── 04-community/
```

This project uses the **App Router** exclusively. Focus on `01-app/` docs. Ignore `02-pages/`.

Key docs to reach for:
- Routing & layouts: `01-app/01-getting-started/03-layouts-and-pages.md`
- Server vs Client components: `01-app/01-getting-started/05-server-and-client-components.md`
- Data fetching: `01-app/01-getting-started/06-fetching-data.md`
- Mutations (Server Actions): `01-app/01-getting-started/07-mutating-data.md`
- Caching: `01-app/01-getting-started/08-caching.md`
- Route Handlers (API routes): `01-app/01-getting-started/15-route-handlers.md`
- `next.config.js` reference: `01-app/03-api-reference/05-config/01-next-config-js/`

## Design Principles — SOLID

All code in this project — components, server actions, route handlers, services, utilities — must follow SOLID principles. These are not style preferences; they are hard constraints on every implementation decision.

**S — Single Responsibility**
Every module, component, function, and class does one thing. A Server Action that saves a booking does not also send an email — it saves the booking and returns. The email is triggered separately. If you can describe what a unit does and the description includes "and", split it.

**O — Open/Closed**
Extend behavior by adding new code, not by modifying existing code. New experience types, new portal rules, new pricing tiers — these should slot in without touching existing logic. Favor configuration objects, strategy patterns, and composition over branching into existing functions.

**L — Liskov Substitution**
Any implementation of an interface must be fully substitutable for it. If `EmailService` sends transactional email, a `MockEmailService` used in tests must satisfy the same contract — not silently skip behavior. Don't build abstractions that only work for the current concrete case.

**I — Interface Segregation**
Don't force a module to depend on things it doesn't use. Keep interfaces narrow and specific. A booking confirmation handler should not import the full Stripe SDK — it should receive what it needs (a payment intent ID, an amount) and nothing else.

**D — Dependency Inversion**
High-level modules depend on abstractions, not on concrete implementations. Services receive their dependencies (database client, email client, storage client) as parameters or through a clear injection point — they don't reach out and instantiate them internally. This makes testing, swapping, and reasoning about side effects straightforward.

### Practical patterns that follow from SOLID

- **Services over fat components.** Business logic lives in service functions (`/lib/services/`), not inside components or route handlers directly.
- **One action, one purpose.** Server Actions are thin — they validate input, call a service, return a result.
- **Typed interfaces at boundaries.** Define TypeScript interfaces for anything that crosses a module boundary (service inputs/outputs, API payloads, database row types).
- **No hidden side effects.** A function that queries the database should not also write to it unless that is its stated, singular job.
- **Strategy for variation.** When behavior varies by portal type (public / member / partner) or property (HBSC / Hog Heaven / Packsaddle), reach for a strategy or configuration map — not `if (portal === 'member')` chains scattered through shared code.

## Project Structure

Two top-level trees own application code, with a clear boundary between them. `app/` is reserved for Next.js routing artifacts — nothing else.

```
app/<route>/                Routing artifacts ONLY — page.tsx, route.ts, layout.tsx.
                            No components, no business logic, no services.
                            Pages are orchestrators: fetch via service, compose
                            from src/components, render. Thin.

src/                        Domain code.
├── components/
│   ├── <scope>/            Route- or feature-scoped components (e.g. members, admin).
│   └── shared/             Cross-cutting components used by multiple scopes.
├── services/
│   └── <scope>/            Domain logic: queries, mutations, business rules.
│                           Takes injected clients (SupabaseClient, etc.).
│                           Returns clean domain types — never raw PostgREST shapes.
├── hooks/<scope>/          React hooks (when needed).
├── constants/<scope>/      Constants / enums / config maps (when needed).
└── types/                  Shared TS types (when not co-located with their owner).

lib/                        Framework / infrastructure adapters.
├── supabase/               Supabase client factories (browser, server, service).
├── auth/                   Generic auth glue (server actions like signOut).
├── ui/                     Design system primitives (Button, Card, Alert, …).
└── dev/                    Internal dev tooling.
```

### Where does this code go? — heuristic

- **It renders JSX:** `src/components/<scope>/`. Route-specific or feature-specific scope, never `shared/` unless it's actually reused across routes.
- **It does a query, mutation, or business calculation:** `src/services/<scope>/`. Always takes its dependencies as parameters (Dependency Inversion).
- **It's a Supabase client, an auth helper, a CSS primitive, or some framework adapter the rest of the app depends on:** `lib/`. The boundary is "I'm part of the infrastructure," not "I am the product."
- **It's a Next.js routing primitive** (`page.tsx`, `route.ts`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `middleware.ts`): `app/<route>/`. These are routing artifacts, not domain code — keep them thin.

### Path aliases

`tsconfig.json` defines `@/* → ./*`. Use absolute imports everywhere outside of same-directory files:

```ts
import { MemberHeader } from "@/src/components/members/member-header";
import { getMyMemberships } from "@/src/services/members/memberships";
import { Button } from "@/lib/ui";
import { createServerSupabaseClient } from "@/lib/supabase/server";
```

Avoid `../../../` relative paths — they break refactors silently.

## Key Rules

- **Database is the source of truth.** Bookings, members, pricing, and bids live in Supabase. HubSpot is downstream.
- **App Router only.** No pages directory. Use Server Components by default; add `"use client"` only when needed.
- **RLS on every table.** No public reads/writes without a policy.
- **Double-booking prevention is a database constraint**, not application logic.
- **Never open connections per request** — use Supabase's transaction pooler (port 6543) in serverless.

## Client State Rules

These are constraints on how React Context / form / funnel state is shaped. They exist because each one cost us a real bug.

### Display defaults must be persisted to state, not applied at the read site

If a UI component renders a default value for a state field — e.g., a stepper that shows "1 guest" before the user taps it — that default belongs in the state's **initial value** (provider `useState`, Zustand `create`, etc.), not in a `state.x ?? default` fallback at the read site.

**The rule:** `state.x ?? default` is a code smell unless `x` is **genuinely sometimes absent** (e.g., an `instructorId` that only applies to one booking type). If a field always has a sensible default, set it in the state's initial value and read directly.

**Why this matters:** when two consumers reach for `?? default` versus checking `!== undefined`, they disagree about whether the field is "set." The disagreement surfaces as a redirect loop or a missing-data crash far from either consumer.

**Concrete past bug:** `<BookingBuilder>` rendered "1 guest" via `state.guestCount ?? 1` while the `/details` `<BookingFlowGuard requires={["guestCount"]}>` checked `!== undefined`. Users who accepted the default were silently bounced back to the property picker on every funnel pass. Fix: provider's `INITIAL_STATE` now contains `{ guestCount: 1, disciplineSelections: [] }`; readers use `state.guestCount` and `state.disciplineSelections` directly.

### Funnel state shape: mark always-defaulted fields as required

The corollary to the rule above. In a state interface where some fields have provider-set defaults and others are progressively populated, mark the defaulted fields as **required** (non-optional) and the rest optional:

```ts
interface BookingFlowState {
  // ---- always defaulted (set in provider INITIAL_STATE) ----
  guestCount: number;
  disciplineSelections: ReadonlyArray<DisciplineSelection>;

  // ---- progressively set ----
  bookingType?: BookingType;
  date?: string;
  // ...
}
```

The compiler then refuses `state.guestCount ?? 1`. Drift between "display says default" and "state says undefined" becomes structurally impossible.

### Submit / commit boundaries narrow via a type guard, not non-null assertions

When a piece of state is "ready to submit" (all required fields present), express that as a separate type plus a guard function:

```ts
interface SubmittableBookingState extends BookingFlowState {
  bookingType: BookingType;
  date: string;
  slotStart: string;
  durationHours: number;
  guest: GuestInfo;
}

function isSubmittable(state: BookingFlowState): state is SubmittableBookingState { ... }
```

Submit handlers narrow once with `isSubmittable(nextState)` and then read fields without `!` assertions. The check lives in one place; one update covers every consumer.

## Architecture Decisions

Deliberate, non-obvious choices. Each one captures *why* it's the way it is so future readers — including future Claude sessions — don't undo it by accident.

### Strict portal allowlists; admins do not enter `/member` or `/partner`

The middleware allowlist is one-role-per-portal:

- `/admin` → all five staff roles
- `/member` → `member` only
- `/partner` → `partner` only

Admins are NOT in the `/member` or `/partner` allowlists. This is intentional.

**Why:** Each portal queries data scoped to `auth.uid()`. An admin landing on `/member` would render "no memberships" because they don't have a `people` row — useful only as confusion. Making the page detect role and branch into "admin preview" mode mixes two UIs in one component (separation-of-concerns smell). The role-per-portal model keeps each portal a clean, single-purpose surface that's easy to RLS-audit and reason about.

**How admins WILL see member-side data** (App 3 — Admin Portal):

A read-only **Members index + membership detail** *inside* `/admin` (`/admin/members`, `/admin/members/[id]`) — an admin-facing directory of memberships (households) and their people, bookings, and RSVPs, fetched via the admin's broader RLS scope. Admin stays signed in as themselves; no impersonation, no token-swap.

**"Preview as <member>" (re-rendering the `/member` portal UI for a member) was dropped (2026-06-01).** Two reasons: the guest-facing surface that staff actually need to inspect — the bid page — is already a shareable public link (`/bids/<slug>/<code>`), so there's no preview to build there; and re-rendering the logged-in member portal as an admin added a whole parallel data-fetch path for little launch-scale value. Admins get the facts they need from the read-only membership detail instead. Member-side **write** actions on behalf of a member still go through admin-portal write paths that explicitly attribute (e.g. `created_by_admin_id` on bookings) rather than masquerading as the member.

Full impersonation (admin signs in literally as the member) remains deferred indefinitely. Revisit the dropped portal-preview only if a concrete need (bug-repro, interaction-debug) shows up that the read-only membership detail can't serve.

## RLS Rules (read this before writing any policy)

These rules exist because we hit every one of them as a real bug during Phase 4. They are not theoretical.

1. **Use the Supabase Auth & Access Architect agent for any non-trivial RLS work.** Located at `./agents/supabase_auth_rls_agent.md`. Especially for policies that span multiple tables or introduce new helper functions.

2. **For cross-table member access, use `SECURITY DEFINER` selector functions — never inline EXISTS / IN subqueries in policy USING clauses.** Inline cross-table subqueries create policy dependency cycles. PostgreSQL detects these structurally at plan time (not runtime) and fails the query with "infinite recursion detected in policy for relation X." This fires even when the cyclic branch would short-circuit on `auth_role()` for the actual user. The canonical Supabase pattern is a `SECURITY DEFINER STABLE` function that returns the set of IDs the caller can see; the policy then does `id IN (SELECT my_helper())`. The function is opaque to the planner, the cycle dependency arrow disappears, and RLS evaluation completes cleanly. Examples in `supabase/migrations/20260518235335_rls_helpers_for_member_access.sql`.

3. **Wrap `auth.uid()` and `auth.jwt()` in `(SELECT …)` inside every policy.** This forces an InitPlan — the function is evaluated once per query instead of once per row. The Phase 4 helpers already do this; new policies must follow the pattern.

4. **`SECURITY DEFINER` functions always `SET search_path = public`** and have a clear comment about what they bypass and why. They're powerful and easy to misuse.

5. **Before applying any new migration that touches RLS, audit the policy dependency graph.** For each policy USING clause, list which other tables it references. For each of those tables, list which policies they have and what they reference. If any policy on table A references table B AND any policy on table B references table A (directly or transitively), you have a cycle — fix with SECURITY DEFINER selector functions.

6. **Every new RLS policy needs an explicit manual test** — run the actual query as the actual role against the live DB. Migration apply succeeding is not proof the policy works; RLS errors only surface at SELECT/INSERT/UPDATE time.

7. **`FORCE ROW LEVEL SECURITY` is not applied to any project table.** This means service-role and SECURITY DEFINER functions bypass RLS as expected. If you ever add `FORCE`, every existing SECURITY DEFINER helper needs review.

## Client Contribution Mode

This repo can be driven by a **non-technical client** making layout / CSS / copy /
front-end changes on their own machine. When you are in that mode, every change is
delivered as a feature branch + pull request that a developer reviews — the client
never edits `main`, never touches a live database, and never deploys.

**How to tell which mode you're in:** if `.claude/.developer-mode` exists, you are on
the developer's machine — work normally (this section does not apply). If it does
**not** exist, you are in client-contributor mode: follow the workflow below.

**In client-contributor mode:**
- **First, before writing any code or SQL: is the thing already editable in `/admin`?**
  Most of the app's content and settings — FAQ & gear, property info/hours, experiences
  & add-ons, pricing, adventures, waiver wording, instructors, team, plus the live
  bids/bookings/members records — are editable by the client themselves in the admin
  dashboard, and they usually don't know it. If the request is to *change existing
  content like that*, use the **`dashboard-first` skill**
  (`.claude/skills/dashboard-first/SKILL.md`): point them to the right admin page instead
  of writing code/SQL. A migration that edits managed content is the wrong tool — the
  `dashboard-content-guard` hook blocks it.
- Follow the **`safe-change` skill** (`.claude/skills/safe-change/SKILL.md`) for the
  mechanics of every change: branch off latest `origin/main` → edit → `npm run
  typecheck` → `npm run dev` for the client to see → commit → push → `gh pr create`.
  The **Client Change Driver** agent (`agents/client_change_driver.md`) captures the
  tone and judgment.
- **Stay in the front-end lane.** The foundation (packages, build config, auth, data
  layer, schema, backend services) is already built and fixed. Client work is
  presentation — layout, styling, copy, rearranging existing components. Don't add or
  remove npm packages, and don't edit foundational files (`package.json`,
  `next.config.*`, `tsconfig.json`, `middleware.ts`, `lib/supabase/*`, `lib/auth/*`,
  `supabase/config.toml`); route those to the developer. The hook hard-blocks them too.
- **Database changes never hit a live DB.** A schema change becomes a migration file
  in the branch (`npx supabase migration new`, applied locally with `npx supabase db
  reset`) plus a "Database changes" note in the PR for the developer to apply. Never
  `supabase db push` / `link` / `--linked`, and never the Supabase MCP write tools.
- The client works against a **local Supabase stack in Docker** — no production
  credentials exist on their machine. See `docs/CLIENT_SETUP.md` for onboarding.

**Enforcement is not optional.** Two PreToolUse hooks, both on by default and both
disabled only by the `.claude/.developer-mode` marker:
- `.claude/hooks/client-guardrails.mjs` hard-blocks remote DB writes, Stripe writes,
  pushes/commits to `main`, force-pushes, direct deploys, committing `.env` files, and
  edits to the guardrails themselves.
- `.claude/hooks/dashboard-content-guard.mjs` blocks migrations/SQL that edit content
  the admin dashboard manages (INSERT/UPDATE/DELETE on FAQ, gear, properties, catalog,
  pricing, adventures, waivers, instructors, team, bids, bookings, members), and points
  at the admin page to use instead. It allows DDL (CREATE/ALTER) — new structure for a
  real feature is fine. Its table→page map mirrors `src/components/admin/admin-nav.tsx`.

Don't try to route around either — if a hook blocks something, that action belongs in
the dashboard or with the developer, as its message explains.

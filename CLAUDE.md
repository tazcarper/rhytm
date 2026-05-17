# Rhythm Outdoors — Claude Code Project Guide

## Project Overview

A single Next.js web application serving three properties — Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, and Packsaddle Precision — from one codebase. Three portals (public, member, partner), one backend, one database.

**Core outcome:** Every inquiry ends as a signed bid page with embedded deposit — no phone calls, no five-tab lookups.

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

The full Next.js 16 docs are bundled locally in `node_modules/next/dist/docs/`. Reference them directly — no web lookup needed.

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

## Key Rules

- **Database is the source of truth.** Bookings, members, pricing, and bids live in Supabase. HubSpot is downstream.
- **App Router only.** No pages directory. Use Server Components by default; add `"use client"` only when needed.
- **RLS on every table.** No public reads/writes without a policy.
- **Double-booking prevention is a database constraint**, not application logic.
- **Never open connections per request** — use Supabase's transaction pooler (port 6543) in serverless.

# Rhythm Outdoors

> **In one sentence (for everyone):** Rhythm Outdoors is one website that runs three outdoor sporting clubs — Horseshoe Bay, Hog Heaven, and Packsaddle Precision — letting guests book a visit, sign a waiver, and pay a deposit on a single page, while staff manage every booking from one admin dashboard.

---

## Summary (non-technical)

A guest picks a club, builds a booking (date, time, activities), and submits it. Staff review it, set the final price, and send back a **bid** — a private web page that holds the schedule, a liability **waiver** to sign, and a **deposit** to pay. Once the guest signs and pays, the booking is locked and the bid page becomes their confirmation. The goal: **every inquiry ends as a signed, paid bid page — no phone tag, no spreadsheets, no five open tabs.**

The same app has three "front doors" (portals): the **public** site for guests, a **member** portal for club members, and a **partner** portal for concierge partners — all backed by one database and one admin portal for staff.

---

## For engineers

A single **Next.js 16 (App Router)** application on Vercel, backed by **Supabase (Postgres + RLS)**. One codebase, three portals, one database.

### Stack

| Layer | Tool |
|---|---|
| Frontend + API | Next.js 16 (App Router) on Vercel |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Email | Resend |
| E-signature | **In-house** (pdf-lib + Supabase Storage) — see [Waiver signing](#waiver-signing-app-7) |
| File storage | Supabase Storage |
| CRM | HubSpot (fed by the app, not the source of truth) |
| Workflows | Inngest |
| Observability | Sentry + Axiom (deferred to pre-1.0) |

### Architecture at a glance

- **App Router only.** No `pages/` directory. Server Components by default; `"use client"` only where needed.
- **Two code trees with a hard boundary:**
  - `app/<route>/` — Next.js routing artifacts ONLY (`page.tsx`, `route.ts`, `layout.tsx`). Pages are thin orchestrators: fetch via a service, compose from `src/components`, render.
  - `src/` — domain code: `components/`, `services/` (queries, mutations, business rules — take injected clients), `hooks/`, `constants/`, `types/`.
  - `lib/` — framework/infrastructure adapters: `supabase/` clients, `storage/`, `auth/`, `waiver/`, `ui/` (design system), `inngest/`.
- **SOLID is a hard constraint**, not a preference. Business logic lives in `src/services/*`; Server Actions are thin (validate → call service → return); services receive their dependencies (DB/storage/email clients) as parameters.
- **Database is the source of truth.** RLS is on **every** table. HubSpot is downstream. Double-booking prevention is a DB constraint, not app logic.

See [`CLAUDE.md`](./CLAUDE.md) for the full project guide (structure, SOLID details, client-state rules, RLS rules, architecture decisions). See [`TRACKER.md`](./TRACKER.md) for per-feature status.

### Project structure

```
app/<route>/          Routing artifacts only — thin pages/route handlers/layouts.
src/
├── components/<scope>/  Route- or feature-scoped React components (+ shared/).
├── services/<scope>/    Domain logic; takes injected SupabaseClient etc.; returns clean types.
├── hooks/  constants/  types/
lib/
├── supabase/   Browser / server (cookie) / service-role client factories.
├── storage/    Supabase Storage adapters (e.g. the private waiver bucket).
├── waiver/     Waiver provider switch.
├── auth/  ui/  inngest/  dev/
supabase/migrations/  Ordered SQL migrations (the schema source of truth).
public/guide.html     End-user + staff guide (rendered docs).
```

**Path aliases:** `tsconfig.json` maps `@/* → ./*`. Use absolute imports everywhere except same-directory files (`@/src/services/...`, `@/lib/ui`). Avoid `../../../`.

### Getting started

Prerequisites: Node 18+, npm, and access to the Supabase project (and the Supabase CLI for migrations).

```bash
npm install
cp .env.example .env.local      # fill in the values (all vars documented there)
npm run dev                     # http://localhost:3000
npm run typecheck               # tsc --noEmit  (run before every commit)
```

### Environment variables

All variables are documented inline in [`.env.example`](./.env.example). Groups:

- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser, RLS-gated), `SUPABASE_SECRET_KEY` (server-only, bypasses RLS).
- **Bid cookie** — `BID_COOKIE_SECRET` (bid-page access-code session).
- **Stripe** — `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Waiver** — `WAIVER_PROVIDER` (optional; see below). The deprecated `DROPBOX_SIGN_*` vars are only needed if you flip the provider.
- **Inngest** — `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (prod) / `INNGEST_DEV=1` (local).

### Database & migrations

Schema lives in `supabase/migrations/` as ordered SQL files; apply with `supabase db push`. **RLS is enabled on every table** — read the **RLS Rules** section of [`CLAUDE.md`](./CLAUDE.md) before writing or changing a policy. Key rules:

- Cross-table member access uses `SECURITY DEFINER` selector functions, never inline cross-table `EXISTS` (avoids policy-dependency cycles).
- Wrap `auth.uid()` / `auth.jwt()` in `(SELECT …)` inside every policy (forces an InitPlan).
- `SECURITY DEFINER` functions always `SET search_path = public`.
- Every new policy gets an explicit manual test against the live DB as the actual role.

For non-trivial RLS work, use the **Supabase Auth & Access Architect** agent (`./agents/supabase_auth_rls_agent.md`).

### Key subsystems

- **Public booking funnel** (`app/(public)/`) — property → booking type → builder → guest details → creates a booking + bid atomically. In-layout React Context holds funnel state (refresh resets to step 1; no cookie/localStorage/URL state).
- **Bids** — the core object. A bid is a private page (`/bids/<slug>/<code>`, access-code gated) holding schedule, gear list, FAQ, the waiver, and the deposit. `bids.signed_at` and the bid status enum drive the lifecycle; a trigger keeps the parent booking's status in sync.
- **Payments** (App 6) — Stripe deposit collection on the bid page; webhook idempotency via a `processed_webhooks` claim-first pattern.
- **Waiver signing** (App 7) — see below.
- **Notifications** (Resend) and **Workflows** (Inngest) — transactional email and lifecycle automation (`bid/signed`, `booking/confirmed`, reminders).

### Waiver signing (App 7)

Waivers are signed with the **homegrown "native" flow by default**: a mobile-first `<dialog>` modal collects a typed legal name + consent, then a Server Action renders a PDF (`pdf-lib`), stores it in a **private Supabase Storage bucket (`waivers`)**, and records the signature atomically via the `record_bid_signature` RPC. It is **synchronous — no webhook, no polling.** Tamper-evidence is a SHA-256 of the stored bytes; the legal audit trail (typed name, timestamp, IP, signer) lives in `waiver_documents`.

**Why in-house instead of DocuSign / Dropbox Sign?** A single-signer, few-field liability waiver isn't complex enough to justify a vendor, and a paid e-sign subscription would cost more for no added benefit. The typed signature + consent + audit trail + retained PDF meets the ESIGN/UETA bar for a waiver.

**Both signing backends ship in the codebase** — the app **defaults to the homegrown native flow**, with the Dropbox Sign vendor path retained as a deprecated, switchable fallback.

**No env var is required to use the native flow** — `WAIVER_PROVIDER` defaults to `native`, and the path reuses the existing Supabase env vars plus the `waivers` bucket (migration `20260531140000`). The switch:

| `WAIVER_PROVIDER` | Effect |
|---|---|
| _unset_ or `native` | Homegrown waiver (default). Nothing to configure in Vercel. |
| `dropbox_sign` | Reverts to the **deprecated** Dropbox Sign vendor path; also needs the `DROPBOX_SIGN_*` env vars. |

The Dropbox Sign integration is kept intact as a revivable fallback — see [`src/services/dropbox-sign/DEPRECATED.md`](./src/services/dropbox-sign/DEPRECATED.md). Admins edit each property's waiver text at `/admin/settings/waivers`; saving creates a new version, and previously signed PDFs keep the exact version their guest agreed to.

### Conventions

- **Naming:** intent-revealing names required. Banned in new TS/TSX: `raw`, `q` (var), `qs`, `v`, `obj`, `fmt`, single-letter map vars. Idioms kept (`i`, `e`, `err`, `ctx`, `s` for CSS-module imports). See the `naming` skill / `CLAUDE.md`.
- **Strategy over branching:** when behavior varies by portal (public/member/partner) or property, reach for a config map or strategy, not scattered `if` chains.
- **Client state:** display defaults belong in the state's initial value, not `state.x ?? default` at read sites. See "Client State Rules" in `CLAUDE.md`.

### Verification

- `npm run typecheck` — `tsc --noEmit`, run before every commit.
- New RLS policies and DB functions are tested live as the actual role (RLS errors only surface at query time).

### Deployment

Hosted on **Vercel**. Set the same environment variables from `.env.local` in the Vercel project. A fresh/production Supabase project needs the migrations applied (`supabase db push`) so its schema — including the `waivers` storage bucket — matches.

### Further reading

- [`CLAUDE.md`](./CLAUDE.md) — full project guide: structure, SOLID, RLS rules, client-state rules, architecture decisions.
- [`TRACKER.md`](./TRACKER.md) — phase/feature status (what's done, in progress, next).
- [`public/guide.html`](./public/guide.html) — end-user + staff walkthrough.
- [`src/services/dropbox-sign/DEPRECATED.md`](./src/services/dropbox-sign/DEPRECATED.md) — reviving the vendor e-sign path.
- `./agents/` and the installed skills (`skills-lock.json`) — specialized tooling.

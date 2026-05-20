# App 1 — Project Scaffold

**Status:** ✅ Done (2026-05-19)

**Epic goal.** Stand up a single Next.js 16 codebase that can host all three portals (public, member, partner) plus an admin surface, wired to live Supabase with strict role-per-portal auth, a brand-aligned design system, and a deployable Vercel pipeline. Everything App 2 — App 10 will lean on this foundation; nothing in this phase ships customer-visible product yet beyond a real `/login`.

The work was executed as eleven sequential sub-phases. Each has its own narrow goal so future apps can reuse the pattern: scaffold → clients → design tokens → primitives → middleware → callback → login → stubs → dev tools → manual verification → deploy.

---

## Sub-phase 1.1 — Next.js + Tooling Scaffold

**Goal.** A clean Next.js 16 App-Router + TypeScript + Tailwind v4 app that boots locally on a locked Node version, with the build/typecheck scripts every later phase will use.

What landed:

- `next@^16.2.6`, `react@^19`, `react-dom@^19`
- `tailwindcss@^4.3`, `@tailwindcss/postcss@^4.3`, `prettier-plugin-tailwindcss`
- TypeScript 5.6 strict, `tsconfig.tsbuildinfo` checked out
- `package.json` scripts: `dev`, `build`, `start`, `typecheck`
- `engines.node >=24.0.0` (locked via `node 24` commit so Windows + WSL + Vercel agree)
- `next.config.ts` with `reactStrictMode: true`
- Pages-router directory deliberately absent — App Router only, per CLAUDE.md

---

## Sub-phase 1.2 — Supabase Clients

**Goal.** Provide the three RLS-aware Supabase clients every server component, route handler, and Server Action will reach for, so no later code needs to hand-roll cookie wiring or pick the wrong key.

What landed:

- `lib/supabase/client.ts` — browser client (publishable key)
- `lib/supabase/server.ts` — cookie-aware server client via `@supabase/ssr` (used by Server Components + Server Actions + Route Handlers; reads/writes the auth cookie)
- `lib/supabase/service.ts` — service-role client (secret key, server-only, bypasses RLS — used only by trusted server code like `/auth/callback` invite linking and `/dev` admin actions)
- Env vars in `.env.local`: publishable key, secret key, `BID_COOKIE_SECRET`, `DEV_DASHBOARD_PASSWORD`
- Smoke test on `/` lists the three seeded properties — proves the browser client + the live DB are wired before any auth work begins

Note: clients are created per-request, not module-singletons. The transaction pooler (port 6543) is intended for serverless usage per CLAUDE.md "Never open connections per request."

---

## Sub-phase 1.3 — Design Tokens + Font Loading

**Goal.** Establish the brand layer in `app/globals.css` once, so every subsequent page renders on-brand without ad-hoc CSS, and load typography in a way that survives SSR.

What landed in `app/globals.css`:

- Brand palette + semantic accents: `--accent-error`, `--accent-warn`, `--accent-info`, `--accent-success`
- Elevation shadows: `--shadow-soft`, `--shadow-lift`
- Serif + sans family aliases
- Type scale: `--text-eyebrow` 11px → `--text-display` `clamp(48, 8vw, 72)`
- Tracking + leading scales
- 4px-base spacing scale: `--space-1` … `--space-24`
- Radius scale: `--radius-sharp`, `--radius-card`, `--radius-pill`
- Motion timings: `--ease-fast`, `--ease-base`, `--ease-slow`
- Layout widths: `--w-max`, `--w-narrow`, `--w-prose`
- Global `@media (prefers-reduced-motion: reduce)` baseline that clamps all transitions/animations to 0.01ms

Fonts via `next/font/google` in `app/layout.tsx`:

- Cormorant Garamond (serif)
- Inter (sans)

Tokens are the contract; primitives in 1.4 consume them. See `plan/design-system/overview.md` for the design-system thinking.

---

## Sub-phase 1.4 — UI Primitives Library

**Goal.** A primitive set (`lib/ui/primitives/`) the three portals all import from, so no portal grows its own one-off button/card/input divergence.

What landed under `lib/ui/primitives/`:

- `alert`, `badge`, `button`, `card`, `divider`, `eyebrow`, `form-field`, `heading`, `input`, `page-shell`, `text`, `textarea`
- Each primitive is its own folder with `<name>.tsx` + `<name>.module.css` + `index.ts`
- `lib/ui/utils/cn.ts` classname helper
- `lib/ui/index.ts` barrel export
- A live primitive showcase at `/dev/ui/` (`app/dev/ui/page.tsx`) for visual regression checks

Convention: primitives are CSS-Module-scoped, not inline-styled (the Phase 3 inline-style sweep removed remaining one-offs).

---

## Sub-phase 1.5 — Auth Middleware + Portal Allowlists

**Goal.** Enforce strict role-per-portal allowlists at the edge so admins cannot accidentally enter `/member` or `/partner` (per the "Strict portal allowlists" decision in CLAUDE.md).

What landed in `proxy.ts`:

- `/admin` allowlist: `super_admin`, `admin`, `property_manager`, `concierge`, `membership_coordinator`
- `/member` allowlist: `member` only
- `/partner` allowlist: `partner` only
- Reads role from `app_metadata.role` on the Supabase session JWT
- Unauthenticated visitors → `/login?next=<original>` (open-redirect guarded in 1.7)
- Authenticated wrong-role visitors → `/unauthorized`
- Matcher avoids static assets + `_next/*`

This is the single source of portal access control. RLS in the database is the second layer; the middleware is the first.

---

## Sub-phase 1.6 — Auth Callback Route

**Goal.** Bridge Supabase Auth (magic link, Google OAuth, invite-acceptance) into the app, so a successful login lands the user on the correct portal with a JWT that actually carries `app_metadata.role`.

What landed at `app/auth/callback/route.ts`:

- Supports both PKCE (`code=…`) and `token_hash` (older email-link) flows
- Multi-row member link: an email matching multiple pending invites (cross-property household) links all of them via the `people` + `memberships` + `membership_people` model
- Expired-invite path redirects to `/login?error=invite-not-found&email=...` — the dismissible `<LoginAlert>` in 1.7 renders it inline
- **Unconditional `supabase.auth.refreshSession()` before redirecting.** Fixes a real bug where Google OAuth users landed on `/unauthorized` because the post-exchange JWT was missing the role claim. Previously the refresh only ran on the first-time-link branch; now it runs in every branch.
- Shares `portalHomeForRole()` with `/login` via `lib/auth/portal.ts` — one place decides which portal a given role goes to

---

## Sub-phase 1.7 — Production `/login` Surface

**Goal.** Ship a single real, branded `/login` page that serves all three user types (admin, member, partner), offering magic-link AND Continue-with-Google, with safe `?next=` handling.

What landed:

- `app/login/page.tsx` — server component. `?next=` parser rejects external URLs (open-redirect guard). If session is already present, redirects straight to the role's portal home.
- `app/login/login-form.tsx` — client component. Two paths:
  - Magic link: `signInWithOtp({ email, options: { shouldCreateUser: false } })` — `shouldCreateUser:false` is critical; uninvited emails get the invite-not-found alert rather than a phantom signup
  - Continue with Google: `signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } })`
- `app/login/cycling-property.tsx` — small client component, fades through "Horseshoe Bay" / "Hog Heaven" / "Packsaddle" beneath the wordmark
- `app/login/login-alert.tsx` — dismissible inline alert reading `?error=...&email=...` from the URL. Replaces the previously standalone `/invite-not-found` route (deleted).
- Visual reference: HSB members portal style under the umbrella Rhythm Outdoors brand

Side-effect: Supabase dashboard now has Google OAuth provider configured with account-linking on, so an email-then-Google sign-in doesn't create two `auth.users` rows.

---

## Sub-phase 1.8 — Portal Stubs

**Goal.** Place holder routes for every portal + every error path the middleware and callback can redirect to, so navigation never dead-ends before Apps 2–5 fill them in.

What landed:

- `app/admin/page.tsx`
- `app/member/page.tsx` — surfaces household-member visibility via `current_household_person_ids()` (proves RLS works end-to-end). To be replaced in App 4.
- `app/member/_components/member-header.tsx`, `app/member/_components/membership-card.tsx` — early member UI shapes
- `app/partner/page.tsx`
- `app/unauthorized/page.tsx`
- `app/auth/auth-code-error/page.tsx`
- `app/page.tsx` — public landing, lists the three properties (also the 1.2 smoke test)
- `app/not-found.tsx` + `app/not-found.module.css`

Each portal stub renders the current session's JWT claims so manual testing in 1.10 can verify role + property + partner-org assignments live.

---

## Sub-phase 1.9 — `/dev` Test Dashboard

**Goal.** A password-gated developer-only surface that creates test people + memberships + invites without going through email, so the auth gate is testable against live Supabase without manual SQL seeding or hitting magic-link rate limits.

What landed under `app/dev/`:

- Password gate using `DEV_DASHBOARD_PASSWORD` env var (server-only — **never `NEXT_PUBLIC_*`**)
- Cookie is `httpOnly`, scoped to `/dev`, 24-hour TTL, rotates automatically when the env var changes
- `app/dev/login/page.tsx` — entry gate
- `app/dev/page.tsx` — dashboard
- `app/dev/membership-picker.tsx` — multi-property checkbox selector
- `app/dev/actions.ts` — Server Actions: create person + memberships, add authorized person to existing membership (household), send invite, generate magic-link URL (bypasses email), force-expire invite, stamp `app_metadata.role`, reset test user
- `lib/dev/auth.ts` — gate helpers
- `lib/services/memberships.ts` — service layer the dev actions call (follows the SOLID "services over fat actions" rule in CLAUDE.md)

**Hard exit criterion (deferred to launch readiness):** The entire `/dev` tree (`app/dev/`, `lib/dev/`, and the `DEV_DASHBOARD_PASSWORD` env var) must be removed before public launch.

---

## Sub-phase 1.10 — Manual Test Scenarios + Live Verification

**Goal.** A documented manual test pack covering every auth path, plus a live verification pass against the production Supabase project, gating App 2+ work on the auth gate actually working end-to-end.

What landed at `docs/manual-testing.md`:

- **Scenario A** — single-property member sign-in
- **Scenario B** — cross-property member (sees memberships at multiple properties)
- **Scenario B2** — household sharing (two people, one membership)
- **Scenario C** — wrong-role bounce (admin trying to enter `/member` → `/unauthorized`)
- **Scenario D** — expired invite (`?error=invite-not-found` round trip)
- **Scenario E** — property-manager scope
- **Scenario F** — production `/login` (10 steps: magic-link path, Google OAuth path, `?next=` passthrough, invite-not-found alert, already-signed-in redirect)

Verification status: A–E passed end-to-end 2026-05-18 against live Supabase. F was partially verified the same day during dev — Google OAuth admin + member sign-in confirmed working after the JWT-refresh fix in 1.6, invite-not-found alert verified. A clean systematic Scenario F run remains nice-to-have but does not block App 2.

Re-run protocol: re-run A–F before any change touching `/auth/callback`, `proxy.ts`, the people/memberships/junction schema, the `/login` page, or any RLS policy on those tables.

---

## Sub-phase 1.11 — Vercel Deploy

**Goal.** Connect the GitHub repo to Vercel, mirror `.env.local` into Vercel env vars, and trigger the first deploy so client review can happen on preview URLs and OAuth callback URLs work in production.

What landed:

- GitHub repo connected via the Vercel dashboard
- Env vars mirrored from `.env.local`: publishable key, secret key, `BID_COOKIE_SECRET`, `DEV_DASHBOARD_PASSWORD`
- Vercel region matched to Supabase region (minimizes cross-region latency, per `plan/supabase/overall-plan.md` Sequencing #2)
- First production deploy succeeded
- Supabase Auth → URL Configuration updated with the production + preview callback URLs so OAuth + magic-link redirects land on the Vercel domain

App 1 done. App 2 (Public Booking Flow) is unblocked.

---

## Cross-cutting decisions captured by this phase

These were settled during 1.1–1.11 and now bind every future App phase:

1. **App Router only.** No `pages/`. Server Components default; `"use client"` only when interactivity demands it.
2. **Three Supabase clients, never more.** Code that needs the DB picks the right one from `lib/supabase/` — never instantiates ad-hoc.
3. **Services over fat components.** Business logic lives in `lib/services/`. Server Actions and route handlers are thin: validate → call service → return. (See CLAUDE.md SOLID section.)
4. **Tokens + primitives are the design system.** Pages compose primitives; primitives consume tokens. No inline styles in new code (the inline-style sweep made that explicit).
5. **Middleware is the first layer of access control.** RLS is the second. They must agree — never weaken one trusting the other.
6. **`/dev` is a quarantine zone.** It uses service-role + admin auth APIs and must never ship to production.

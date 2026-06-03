# App 4 — Optional password login (member portal)

> **Status:** 🔄 Building 2026-06-03
> **Owner surface:** `/login` (shared entrance) + `/member/profile` (set password)

## Goal

Let an invited member who normally signs in by magic link **set a password** so they can sign in directly next time — without waiting for an email. Magic link stays the default and the recovery path; the password is a pure convenience layer on top.

## Why this is low-risk here

- The auth user already exists (seeded via `inviteUserByEmail`), so setting a password is just `supabase.auth.updateUser({ password })` on the authenticated session — no migration, no new auth user, no email re-confirmation.
- Magic link already works for everyone, so it doubles as "forgot password": there is **no separate reset flow** to build.

## Pieces

### 1. Set a password — `/member/profile`

- New client component `src/components/members/password-form.tsx` (sibling of `profile-form.tsx`): new-password + confirm fields, client-side match + min-length check, success/error alerts.
- New server action `updatePassword(password)` in `lib/auth/actions.ts` (next to `updateDisplayName`): validates length (8–72), calls `supabase.auth.updateUser({ password })` via the cookie-aware server client, returns `{ ok, error? }`.
- `app/member/profile/page.tsx` renders `<PasswordForm />` below the display-name form under a "Password" heading.
- Neutral copy ("Set a password") — works whether or not one already exists, since there's no reliable client signal for "has a password set" (a magic-link user has an `email` identity but no password).

### 2. Password sign-in — `/login`

- `app/login/login-form.tsx` gains an optional password field. The single submit is **smart**:
  - password filled → `signInWithPassword({ email, password })`
  - password blank → existing `signInWithOtp` magic-link flow (unchanged)
  - button label reflects which will happen ("Sign in" vs "Email me a sign-in link").
- On password success, redirect client-side to `next ?? portalHomeForRole(role)` (read role from the returned user; `portalHomeForRole` is a pure helper). Password sign-in does **not** pass through `/auth/callback`, which is fine — the role claim is already on the user from first login (see gotchas).
- Map `invalid login credentials` to friendly copy that points to the magic link.
- Google button unchanged.

### 3. Recovery

No reset page. "Forgot password" = use the magic link, sign in, re-set the password in profile. Documented in the login foot copy.

## Gotchas (codebase-specific)

1. **First login must stay magic link / OAuth.** Role-stamping + `people`-row linking happen in `/auth/callback`, only on the magic-link/OAuth redirect. `signInWithPassword` is client-side and skips it, so passwords only work for **already-onboarded** members. Self-enforcing: a never-onboarded user has no password.
2. **Password login bypasses `/auth/callback`** — fine, because `app_metadata.role` persists on the auth user and rides in the JWT on any new session, so `proxy.ts` / middleware gate correctly. Just redirect client-side after success.
3. **`shouldCreateUser: false`** stays on the magic-link path. Password sign-in has no equivalent flag; an unknown email gets a generic invalid-credentials error (good — no account-existence leak).

## Dashboard config (one-time, client/ops)

- Supabase → Authentication → Policies: set a sensible **minimum password length** (≥ 8) and, on Pro, enable **leaked-password protection** (HaveIBeenPwned).

## Out of scope (v1)

- One-time "set a password?" prompt after first magic-link login — quiet entry in profile settings only for now.
- Partner/admin password set-UI (login form already accepts passwords for any role; only the member profile has the set-password surface this round).
- Re-authentication nonce for password changes on stale sessions (`reauthenticate()`) — not needed for set-right-after-login.

## Test plan

- Member with no password: magic link still works; password field blank → link sent.
- Set a password in `/member/profile`; sign out; sign in with email + password → lands on `/member`.
- Wrong password → friendly error + magic-link nudge.
- `?next=` is honored after password sign-in.
- Non-member email + password → generic invalid-credentials (no leak).

# Manual Testing

Re-runnable manual test plans. Source of truth for "did we actually verify the auth flow / portal gate / etc. end-to-end against live Supabase." Update this file when scenarios change or new ones are added.

Every scenario assumes the **`/dev` dashboard** at `http://localhost:3000/dev` is the operating console. The dashboard's panels (create test member, send invite, force-expire, stamp role, reset user, recent members table) are what you click — no Supabase Studio required for the standard scenarios.

## Verification log

| Date | Scenarios run | Result | Notes |
|---|---|---|---|
| 2026-05-18 | A, B, B2, C, D, E | ✅ All passed | First full end-to-end verification against live Supabase after Phase 4 schema refactor (split `members` → `people` + `memberships` + `membership_people`) and RLS cycle hotfixes. Auth gate is now considered production-ready for member sign-in. |
| 2026-05-18 | F | ⏳ Pending | New scenario for the production `/login` page (App 4 first slice). To be run once the Supabase email template fix is confirmed; until then, exercise via the `/dev` magic-link generator as documented in the scenario prereq. |

Re-run all scenarios before any future change that touches: `/auth/callback`, `middleware.ts`, the people / memberships / membership_people / member_adventure_rsvps schema, or any RLS policy on those tables.

---

## Prerequisites (do once per machine)

- [ ] `DEV_DASHBOARD_PASSWORD` is set in `.env.local`. The dashboard at `/dev` is password-gated against this value; if the env var isn't set, `isDevAuthorized()` always returns false and the password form rejects every input.
- [ ] Supabase dashboard → Authentication → URL Configuration → **Redirect URLs** allowlist includes `http://localhost:3000/auth/callback`. Without this, `redirectTo` is silently ignored and magic links go to the project's default Site URL.
- [ ] Supabase dashboard → Authentication → Email Templates → **Invite user**: the link in the HTML body uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite`, NOT the default `{{ .ConfirmationURL }}`. The default template routes through Supabase's `/auth/v1/verify` endpoint and returns the session as a URL hash fragment — hash fragments are browser-only and never reach the server, so the SSR callback handler can never see them. The `token_hash` template skips the verify endpoint and lets the route handler validate via `verifyOtp` server-side. Same fix applies to the **Magic Link** template when sign-in pages land.
- [ ] `npm run dev` is running.
- [ ] You have an email inbox you can receive at. Plus-aliases (`you+a@gmail.com`, `you+b@gmail.com`) keep all test addresses in one inbox.
- [ ] Supabase Auth email rate limits — free tier caps outbound invite emails (≈3/hour). If a `sendInvite` fails with a rate-limit error, that's why; wait or configure custom SMTP in the Supabase dashboard.
- [ ] **For Google sign-in on `/login`**: a Google Cloud OAuth 2.0 Client ID must exist (Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application) with authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. The Client ID and Secret are then pasted into Supabase dashboard → Authentication → Providers → Google (enabled toggle on). Until both are done, the Google button renders but clicking it returns "Google sign-in isn't enabled yet" inline; magic-link still works.

---

## Design intent: people, memberships, junction

(Schema as of 2026-05-18, after the people/memberships split.)

Three tables:
- `people` — the human (email, name, phone, auth link). One auth user = one people row.
- `memberships` — the account at a property (member_number, tier, dues, status). One row per (property × account).
- `membership_people` — junction. Binds a person to a membership with a `role` (`primary` / `spouse` / `dependent` / `authorized`).

Two real-world scenarios this supports:
1. **Cross-property**: one person on N memberships at different properties. They have one `people` row and N junction rows.
2. **Household sharing**: N people on one membership (Sarah and John both authorized on member #HSB-0001). They have separate `people` rows and separate auth accounts but share one `memberships` row via N junction rows.

The `/member` page query traverses `membership_people → memberships → properties` and shows every membership the signed-in person is on. The auth callback links one `people` row to the auth user; cross-property visibility comes from the junction.

See [`plan/supabase/phase-4-auth-users.md`](../plan/supabase/phase-4-auth-users.md) and the `project-membership-model` memory entry for the full reasoning.

---

## Scenario A — Single-property member, happy path

Confirms the basic `/auth/callback` flow: link one person, stamp role, route to `/member`.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/dev` → Create person + membership(s): email `you+a@…`, check **one** property, member number `TEST-A`, submit | Green "created person + 1 membership(s)"; junction row in Recent table with `Linked? = —`, `Invited = —`, `Expires` ~7d out, `Role = primary` |
| 2 | Generate magic-link URL for `you+a@…` | Green "invite link generated"; link banner shown at top; person row's `Invited` populated |
| 3 | Click the generated link | Browser lands on `/member` |
| 4 | Inspect `/member` page | Shows `Signed in as you+a@…` and `role: member`; "Your memberships" lists the one property with `role: primary` |
| 5 | Back to `/dev`, check Current session panel | `app_metadata: { "role": "member" }`. Junction row now has `Linked? = yes` and `Accepted` filled |
| 6 | Hit `/admin` | Redirected to `/unauthorized` |

**Pass criteria:** every row above matches. Failure of any single row is a bug.

---

## Scenario B — Cross-property member

One person on N memberships at different properties (e.g., same email is a member at HSB AND Packsaddle).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/dev` → Reset test user for `you+a@…` | Junction table no longer shows rows for this email |
| 2 | Create person + membership(s): same email, **check all three properties**, member number `TEST-A` | Green "created person + 3 membership(s)"; three junction rows in Recent (one per property), all sharing the same email, all `Linked? = —`, all `Role = primary` |
| 3 | Generate magic-link URL → click | Lands on `/member` |
| 4 | Inspect `/member` "Your memberships" | **Three** entries — one per property, all with `role: primary` |
| 5 | Back to `/dev` Recent table | All three junction rows show `Linked? = yes` with the same `Accepted` timestamp |

**Pass criteria:** `/member` lists three memberships. The single person row has three junction entries.

---

## Scenario B2 — Household sharing (two people, one membership)

The reason the schema was split. Sarah and John share one membership; each has their own email and their own login.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Reset both `you+a@…` and `you+b@…` if either exists | Junction table clean for both emails |
| 2 | Create person + membership(s) with email `you+a@…`, check **one** property (Hog Heaven), member number `HH-100` | One junction row, `role = primary` for `you+a@…` |
| 3 | Copy the membership UUID from the dropdown of the "Add authorized person" panel — it shows `Hog Heaven · #HH-100` | (Identifies the target membership) |
| 4 | Add authorized person: email `you+b@…`, select the HH-100 membership, role = `spouse` | Green "authorized person added"; new junction row in Recent for `you+b@…` on the same property/member#, `Role = spouse` |
| 5 | Generate magic-link URL for `you+a@…` → click | Lands on `/member`; "Your memberships" shows Hog Heaven, member #HH-100, your role: `primary` |
| 6 | Sign out of Supabase on `/dev` | Current session goes empty |
| 7 | Generate magic-link URL for `you+b@…` → click | Lands on `/member`; "Your memberships" shows Hog Heaven, member #HH-100, your role: `spouse`. **Same membership the primary saw, different role.** |

**Pass criteria:** both signed-in views show the same membership row with different roles. The junction table on `/dev` has two rows for one membership — one primary, one spouse.

This is the household-sharing scenario the schema split was designed to support. If it works, the refactor was correct.

---

## Scenario C — Wrong-role bounce (admin)

Confirms the middleware portal allowlist.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Starting from Scenario B's state (signed in as `member`), stamp role: email `you+a@…`, role `admin`, leave property_id and partner_org_id blank | Green "role stamped" |
| 2 | Current session panel | Still shows `role: member` — JWTs are not refreshed in-place |
| 3 | "Sign out of Supabase" → send new invite → click new magic link | `/auth/callback` should **not** overwrite the existing `admin` role. New session lands on `/admin` (or `/`); Current session now shows `role: admin` |
| 4 | Hit `/member` | Redirected to `/unauthorized` |
| 5 | Hit `/admin` | Lands on admin stub showing your email + `role: admin` |

**Pass criteria:** the post-stamp JWT shows `role: admin` and the middleware bounces `/member` to `/unauthorized`. If `/auth/callback` overwrote `admin` back to `member`, that's a bug in the callback's first-time-link guard.

---

## Scenario D — Expired invite

Confirms the expiry guard in `/auth/callback`.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Reset test user for `you+a@…` | Recent table cleared for that email |
| 2 | Create person + membership(s) (one property), then Generate magic-link URL | Junction row created, link banner shown — **don't click it yet** |
| 3 | Force-expire invite for `you+a@…` | Recent table row's `Expires` column shows `2000-01-01…` |
| 4 | Now click the previously-generated link | Browser lands on `/invite-not-found` (NOT `/member`); URL has `?email=you+a@…` |
| 5 | Open `/dev` in another tab, check Current session | "No Supabase session" — the callback signed the user out |
| 6 | Check the Recent table row | `Accepted` still empty (callback did not link the person) |

**Pass criteria:** lands on `/invite-not-found` AND the session is cleared AND `people.user_id` was not set. A successful link here would indicate the expiry filter on the callback's `people` query is broken.

---

## Scenario F — Real `/login` sign-in (App 4)

Confirms the production `/login` magic-link flow — the surface a real member uses outside of `/dev`. Builds on the schema and callback already exercised in scenarios A–E.

**Prereq:** the Supabase email template fix (`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite`) must be in place — see Prerequisites. Without it, the magic link returns tokens in a URL hash that the SSR callback cannot see, and step 3 fails on `/auth/auth-code-error`. If the template fix is still pending, substitute step 2's "click the email" with `/dev → Generate magic-link URL → click` to exercise the same callback path.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Reset test user for `you+a@…`, create person + 1 membership via `/dev` (don't send the dev invite). Navigate to `http://localhost:3000/login` while signed out | Login card renders centered on the dark olive ground, "Rhythm / Outdoors" wordmark, "Identify yourself" eyebrow, single Email field |
| 2 | Enter `you+a@…` → click **Enter** | Form replaces with "We sent a sign-in link to you+a@…" panel and "Use a different email" button |
| 3 | Open the email → click the magic link | Browser lands on `/member`; "Your memberships" shows the property created in step 1 |
| 4 | While signed in, navigate back to `/login` | Server-side redirect to `/member` — no flash of the form, URL ends at `/member` |
| 5 | `/dev → Sign out of Supabase`. Navigate to `/login?next=/member/adventures` (the adventures path doesn't exist yet — that's fine for the assertion). Submit `you+a@…` → click the magic link | Lands on `/member/adventures` (which will 404 today), NOT on `/member`. Confirms the `?next=` passthrough |
| 6 | While signed out, navigate to `/login`, submit an unknown email like `nobody@example.com` → **Enter** | Form shakes once; inline italic error message appears: "We don't see an account for that email. Reach your property's membership coordinator to be invited." |
| 7 | Visual sanity check | No console errors. Card has soft drop shadow. Hover the submit button → background darkens to `--olive-deep`. Focus the email field → border darkens to tan and background brightens to paper. The cycling property name beneath the wordmark fades through Horseshoe Bay → Hog Heaven → Packsaddle on a ~3.6s cycle |
| 8 | (Google) Reset test user for `you+a@…` and re-create as a member with the email associated with a Google account you control. Sign out of Supabase. Visit `/login`, click **Continue with Google** | Browser navigates to Google consent. After granting, lands on `/member` with that property's membership visible. Requires the Google OAuth prereq in §Prerequisites |
| 9 | (Google) Sign out, click **Continue with Google** using a Google account whose email does NOT match any seeded `people.email` | Lands back on `/login` with `?error=invite-not-found&email=<that-google-email>`. A red-accented alert renders at the top of the card ("We couldn't find an invitation"). Auth session is cleared. Dismissing the alert (× button) removes the query params and clears the banner without a page reload |
| 10 | (Pre-config sanity) Before the Google provider is enabled in Supabase, click **Continue with Google** | No browser navigation. Inline italic error appears: "Google sign-in isn't enabled yet. Please use your email instead." The magic-link form is still fully functional. Confirms the page degrades gracefully before the OAuth dashboard work is done |

**Pass criteria:** every row matches. Step 4 (already-signed-in redirect) is the most regression-prone since it depends on `getUser()` working server-side; if it flashes the form before redirecting, the server-side guard isn't running. Step 5 (`?next=` passthrough) is the most likely to silently break if the callback or the form's URL construction is refactored. Steps 8–10 are skippable until Google OAuth is configured per the Prerequisites; step 10 specifically can (and should) be run BEFORE configuration to confirm graceful degradation.

**Open-redirect guard sanity (optional, no UI):**
- `/login?next=//evil.com` — after sign-in, must redirect to the member's default portal, NOT to `evil.com`.
- `/login?next=https://evil.com/x` — same behavior, must ignore the absolute URL.
- `/login?next=/member` — must redirect to `/member` (the legitimate same-origin case).

---

## Scenario E — Property-manager scope (optional)

Verifies the `property_id` claim propagates from `app_metadata` to the admin portal.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Have a signed-in user with `role: member` (run Scenario A through step 4 if starting cold) | Confirmed via Current session panel |
| 2 | Stamp role: same email, role `property_manager`, property_id `<HSB-uuid>` | Green "role stamped" |
| 3 | Force-refresh JWT: sign out → new invite → click link | New JWT picks up the stamped claims |
| 4 | Hit `/admin` | Stub shows `role: property_manager` and `property_id: <HSB-uuid>` |

**Pass criteria:** the admin stub displays both claim values. Missing `property_id` indicates the role-stamp action didn't write the metadata correctly.

---

## Cleanup

After a testing session, for every plus-aliased email used:

- [ ] `/dev` → Reset test user

Verify Recent member rows is back to whatever it was before the session started (or empty).

---

## Known issues / quirks

- **JWT refresh is not in-place.** After stamping a role on an already-signed-in user via the `/dev` "Stamp role" panel, the Current session panel keeps showing the old role until the next sign-in. The easiest force-refresh is `signOutUser` + new invite + click. This is fine for testing — staff/partner JWTs get their claims set at invite time, not after.
- **`people.user_id` IS unique; junction rows are how one person reaches N memberships.** This is a deliberate change from the pre-split design. One auth user = one `people` row = many junction rows = many memberships. If you see `duplicate key value violates unique constraint "people_user_id_key"`, something is trying to create two people rows linked to the same auth user — likely an idempotency bug in the link path.
- **The `/auth/callback` route refreshes the session after stamping `role`.** When a member accepts an invite, the callback verifies the OTP (issuing a JWT with no role claim), links the `people` row, stamps `app_metadata.role = 'member'` via the admin API, then calls `supabase.auth.refreshSession()` before redirecting. Without that refresh, the JWT in cookies would still be the pre-stamp one with no role, and every RLS policy that checks `auth_role() = 'member'` would block — `/member` would render an empty memberships list even though the person is linked correctly. Symptom if this regresses: the member portal says "Signed in as you@example.com (role: member)" (correct, because `getUser()` is a live API call) but "No memberships are linked to this account yet" (wrong, because the RLS-gated read reads from the stale JWT).
- **Email rate limits.** Free-tier Supabase caps outbound emails to ≈3-4/hour. Symptom: `sendInvite` returns `error=email+rate+limit+exceeded`. Workarounds: use the **"Generate magic-link URL (no email sent)"** panel on `/dev` for fast iteration (skips email entirely — recommended for local testing), configure custom SMTP in Supabase (point at Resend or similar — see Session Handoff in TRACKER.md), or just wait an hour.
- **`x-forwarded-proto` is not present in pure localhost.** The `sendInvite` host derivation defaults to `http` when this header is missing, which is correct for `http://localhost:3000`. If you ever expose dev via HTTPS tunneling, the magic link would land on http and could fail; configure a proxy that injects `x-forwarded-proto: https`.
- **Hash-fragment ("implicit flow") sign-in URLs.** Symptom: clicking a magic link redirects to `/auth/auth-code-error#access_token=…&type=invite`. Cause: the email template is using the default `{{ .ConfirmationURL }}` which routes through Supabase's verify endpoint and returns tokens in a URL hash. Fix: update the email template to use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite` (see Prereqs). The route handler in `app/auth/callback/route.ts` supports both `?code=` (PKCE) and `?token_hash=&type=` (OTP verification) shapes — but not hash fragments, by design (SSR can't see them).

---

## Adding new scenarios

When new auth/portal behavior lands (e.g., partner concierge flow in App 5, member self-cancellation in App 4), add a new section here with the same `# | Action | Expected outcome` table shape. Keep them sequential and idempotent — each scenario should start with a clean state via `Reset test user`, not depend on the previous one's residue.

# Manual Testing

Re-runnable manual test plans. Source of truth for "did we actually verify the auth flow / portal gate / etc. end-to-end against live Supabase." Update this file when scenarios change or new ones are added.

Every scenario assumes the **`/dev` dashboard** at `http://localhost:3000/dev` is the operating console. The dashboard's panels (create test member, send invite, force-expire, stamp role, reset user, recent members table) are what you click — no Supabase Studio required for the standard scenarios.

## Verification log

| Date | Scenarios run | Result | Notes |
|---|---|---|---|
| 2026-05-18 | A, B, B2, C, D, E | ✅ All passed | First full end-to-end verification against live Supabase after Phase 4 schema refactor (split `members` → `people` + `memberships` + `membership_people`) and RLS cycle hotfixes. Auth gate is now considered production-ready for member sign-in. |
| 2026-05-18 | F | ⏳ Pending | New scenario for the production `/login` page (App 4 first slice). To be run once the Supabase email template fix is confirmed; until then, exercise via the `/dev` magic-link generator as documented in the scenario prereq. |
| 2026-05-21 | P1, P2, P3, P4, P5, P7, P8, P9, P10, P11, P12, P-status | ✅ All passed | Executed 2026-05-21 against live Supabase + local dev server. P6 skipped (DB-layer constraint coverage). P10b deferred to pre-launch polish gate (real-inbox preview belongs with App 8's Resend transport work). P4 surfaced a known UX gap (live availability filter on the slot picker — already tracked in TRACKER's Deferred Improvements under "promote service-role public reads to SECURITY DEFINER RPCs"; not a bug, planned pre-launch). P-status workflow-guard trigger re-enabled cleanly (`tgenabled = 'O'`). |
| 2026-05-23 | S1, S2, S3, S4, S5, S11, S14 | ✅ All passed | First end-to-end verification of the App 6 Stripe deposit flow against `stripe listen` locally AND the production webhook endpoint on `rhytm-one.vercel.app`. Surfaced one Vercel-only issue during setup (env var `STRIPE_WEBHOOK_SECRET` mismatch — the dashboard endpoint's signing secret differs from the `stripe listen` ephemeral one; once synced + redeployed, S1 + S11 passed against prod). S6, S7, S8, S9, S10, S12, S13, S15 not yet formally re-run in this session — covered by dev-time validation during the build, formal re-run recommended before any change touching `app/api/webhooks/stripe/` or `src/services/stripe/`. |
| 2026-05-23 | W1, W2, W9 | ✅ Passed | First end-to-end verification of App 7 Dropbox Sign waiver flow on `rhytm-one.vercel.app`. Surfaced three setup issues + one code bug worth recording: (1) Initial 404 on the webhook route because the App 7 scaffolding wasn't pushed yet — once deployed, route became reachable. (2) Webhook 400 because Vercel env var `DROPBOX_SIGN_WEBHOOK_SECRET` was set to the API App's Client ID, not the account API key (different 32-char hex strings, easy to confuse). Fixed by re-pasting the actual API key. (3) Webhook firing pattern: TEST callback worked, but real `signature_request_all_signed` events weren't reaching us because the callback URL wasn't actually SAVED on the API app (had to click UPDATE APPLICATION). After save, real signing events flow end-to-end. (4) SSR error on the bid page: `hellosign-embedded` SDK touches `window` at import time; switched to a dynamic import inside the click handler. Also shipped during the session: modal-popup signing surface (was inline, now full-screen overlay) and admin-only state-preview toolbar. W3–W8 (pay-then-sign / sign-then-pay / decline / webhook replay / signature forge / URL expiry) deferred to a follow-up session — covered by code-path inspection but not formally re-run live. |

Re-run **A–F** before any future change that touches: `/auth/callback`, `middleware.ts`, the people / memberships / membership_people / member_adventure_rsvps schema, or any RLS policy on those tables.

Re-run **P1–P12 + P-status** before any future change that touches: `create_public_booking()` PL/pgSQL function, `src/services/bookings/create-public-booking.ts`, the booking-flow components (`<BookingTypePicker>`, `<BookingBuilder>`, `<BookingSummary>`, `<DetailsForm>`), the bid page (`app/(public)/bids/[slug]/[code]/page.tsx`), `src/services/bids/get-bid.ts`, `src/services/bids/bid-url.ts`, the booking-flow provider/guard, the email shim (`src/services/notifications/send-email.ts`), any RLS policy on `bookings` / `booking_disciplines` / `booking_add_ons` / `bids`, or any of Phase 2's BEFORE triggers / exclusion constraint.

Re-run **S1–S15** before any future change that touches: `app/api/webhooks/stripe/route.ts`, anything under `src/services/stripe/`, `src/services/admin/refund-deposit.ts`, `src/components/public/deposit-payment-form.tsx`, `src/components/admin/refund-deposit-button.tsx`, `src/components/admin/payment-status-badge.tsx`, `lib/stripe/*`, the `sync_booking_from_bid` trigger function, or any of the App 6 migrations (`20260523120000`, `20260523120100`, `20260523130000`, `20260524120000`).

Re-run **W1–W9** before any future change that touches: `app/api/webhooks/dropbox-sign/route.ts`, anything under `src/services/dropbox-sign/`, `src/components/public/signature-form.tsx`, `lib/dropbox-sign/*`, the `confirmBid` Server Action's envelope-creation hook in `src/services/admin/transition-bid.ts`, or the `bids.dropbox_sign_envelope_id` / `bids.signed_at` schema.

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

## App 4 — Member Portal (post-login surfaces)

The "G/H/I" series. Covers what a signed-in member sees on `/member/bookings`, `/member/adventures`, and the RSVP flow. Scenarios A–F (above) already cover login and the household-visibility stub on `/member`; this section picks up where those leave off.

**App 4 sub-phase 4.1** landed `/member/bookings` plus household-visible bookings (one new SECURITY DEFINER helper + a replaced bookings RLS policy — see `supabase/migrations/20260530120000_household_visible_bookings.sql`). Scenarios G1–G5 below verify the household visibility actually works at the policy level + renders correctly in the UI.

### App 4 prerequisites

- `/dev` dashboard available and signed in as dev (DEV_DASHBOARD_PASSWORD set).
- At least two seeded auth users (`you+a@…` and `you+b@…`) who can both be made `member` role.
- At least one booking row in the DB attributed to each test member. Easiest path: run any Scenario P-* (public booking flow) once with a `member_user_id` stamped — or run via `/dev → Stamp role` then create the booking through the public funnel using their email.

### Scenario G — My bookings (sub-phase 4.1)

Verifies the household-scoped bookings list, the new RLS policy, and the bid status display.

| # | Action | Expected outcome |
|---|--------|-----------------|
| G1 | Sign in as `you+a@…` (single-property member, owns 1 booking). Navigate to `/member/bookings` | One card renders: date/time in the property timezone, property name, booking type, status badge, price summary. No "Booked by" attribution (it's their own booking). No empty-state alert. |
| G2 | Same user with active memberships at HBSC + Hog Heaven, 1 booking at each. Navigate to `/member/bookings` | Both cards render, most-recent first by `start_time`. Each card's property name disambiguates. |
| G3 | **Household visibility.** Two people on shared HBSC membership: spouse A (`you+a@…`, primary) and spouse B (`you+b@…`, spouse). A creates a private lesson booking. Sign in as B → `/member/bookings` | B sees A's booking. Card shows the italic "Booked by Alex Foo" attribution line beneath the booking-type strip. No "Bid: ..." status line (only visible on `isMine=true` rows). |
| G4 | **Cross-household RLS still rejects.** Sign in as `you+c@…` (member at the same property as A but on a DIFFERENT membership) → `/member/bookings` | C does NOT see A's or B's bookings. Only C's own bookings (or empty state if none). Verify via Supabase SQL editor with claim impersonation: `SET role authenticated; SET request.jwt.claim.sub = '<C-user-id>'; SET request.jwt.claim.app_metadata.role = 'member'; SELECT id, member_user_id FROM bookings;` returns only C's rows. |
| G5 | **Bid status visibility.** A creates a booking; bid sits at `status='pending_review'`. Both A and B view `/member/bookings`. | A's card shows "Bid: Awaiting staff review." Once staff confirm → bid `status='confirmed'` → A's card label flips to "Quoted — ready to sign + pay." After 4.1b landed, B (spouse) ALSO sees the bid line on their household-visible row (bids RLS expanded to household). The card itself is now a link to the detail page (G6 covers). |
| G6 | **Click-through to detail page (sub-phase 4.1b).** Click any booking card on `/member/bookings`. | Navigates to `/member/bookings/<id>`. BookingDetailView renders: summary card (date/property/instructor/guests/status), schedule notes (if any), disciplines + add-ons, gear list (if any), FAQ (if any), pricing summary. "← All bookings" back link at top; MemberNav "bookings" tab stays active. |
| G7 | **Spouse sees household detail page.** As B, click into A's booking from G3. | Detail page renders. Summary card shows "Booked by A". Schedule notes / gear list / FAQ all visible (bid RLS expanded to household by migration `20260530160000`). No "Sign & Pay" surface (read-only — sign + pay stay on the public bid page reached via email link). |
| G8 | **Cross-household detail RLS.** As member C (different household), navigate directly to `/member/bookings/<A's-booking-id>`. | 404 — booking is RLS-hidden for C. Verify also via SQL editor with claim impersonation: `SELECT id FROM bids WHERE booking_id = '<A's-booking-id>';` as C returns zero rows. |
| G9 | **Stamping + backfill (migration `20260530140000`).** Push the migration. Refresh `/member/bookings` as a member who previously made a public-funnel booking with their own email. | Backfill stamped `member_user_id` on prior matching bookings; they now appear. New public-funnel bookings made while signed in as member auto-attribute going forward. |
| G10 | **Funnel prefill for signed-in member.** Sign in as a member, navigate to `/book/<property>` → walk to the Details step. | Name + email fields prefilled from the member's `people` row. Phone field blank, labeled "(optional)"; submitting without phone succeeds. Fields are editable — typing a friend's email overwrites the value but the submitted booking still attributes to the auth user's `member_user_id` (auth-session-based stamping, not email-based). |

**Pass criteria:** every row matches. G3 and G4 are the policy-level proof — failing G4 means the new SECURITY DEFINER helper is leaking. If G3 shows only your own bookings, the helper isn't traversing `current_household_person_ids()` correctly; check the migration applied (`./node_modules/.bin/supabase migration list` should show `20260530120000_household_visible_bookings` matched).

**Quick SQL sanity checks (run as `postgres` in Supabase Studio):**

```sql
-- 1. Helper exists and returns the right shape:
SELECT * FROM current_household_user_ids();  -- expects rows for an authenticated session, error otherwise
\df+ current_household_user_ids               -- should be SECURITY DEFINER, STABLE, language sql

-- 2. Policy is in place on bookings:
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename = 'bookings' AND policyname = 'bookings: member household read';
```

---

## App 2 — Public Booking Flow

The "P" series. Covers the public funnel (`/book` → property picker → `/book/[property]` → `/book/[property]/disciplines` → `/book/[property]/details` → `/bids/[slug]/[code]`), Phase 2's BEFORE triggers + instructor exclusion constraint, Phase 3's bid page + access-code gate, and the App 2.9 confirmation-email shim. Every constraint Phase 2 added gets hit by at least one scenario.

The funnel is anonymous — no `/dev` sign-in required for the happy paths. Supabase Studio (or `psql`) is required for the verification queries and for the SQL UPDATEs in P-status.

### App 2 prerequisites (do once per test session)

- [ ] `npm run dev` is running and the homepage at `http://localhost:3000/` lists three properties.
- [ ] `NEXT_PUBLIC_SITE_URL` is set in `.env.local` (or absent — defaults to `http://localhost:3000`). The confirmation email's `bidUrl` is built from this.
- [ ] Placeholder seeds are present: `services` + `add_ons` + `service_add_ons` (migration `20260520120000_*`), `time_slots` + `instructors` (migration `20260520130100_*`), `pricing_rules` (migration `20260520140000_*`). Confirm with:
  ```sql
  SELECT COUNT(*) FROM services WHERE description LIKE 'PLACEHOLDER%';   -- expect ≥10
  SELECT COUNT(*) FROM time_slots;                                       -- expect 84 (3 properties × 7 days × 4 slots)
  SELECT COUNT(*) FROM instructors WHERE name LIKE 'PLACEHOLDER%';       -- expect 7
  ```
- [ ] `dev_email_outbox` table exists (migration `20260521080000_*`):
  ```sql
  SELECT to_regclass('public.dev_email_outbox');   -- expect 'dev_email_outbox', not NULL
  ```
- [ ] Two browser profiles (or a regular window + an incognito) available for P5 (race condition).

### App 2 cleanup helper

Bookings can't be reset via `/dev` today — that admin surface lands in App 3. For now, use a fresh plus-aliased email per scenario (e.g. `you+p1@example.com`, `you+p2@example.com`) and clean up at the end of the session:

```sql
-- Sweep test bookings + their cascaded bids + booking_disciplines + booking_add_ons.
-- `bookings` cascades to all child rows in Phase 2's schema.
DELETE FROM bookings
WHERE guest_email LIKE 'you+%@example.com';

-- Sweep test email-shim rows.
DELETE FROM dev_email_outbox
WHERE to_email LIKE 'you+%@example.com';
```

`properties.max_concurrent_groups` is seeded at `1` for all three properties (Q2 will tune). That means **any** second concurrent booking at the same property + date + slot trips the capacity trigger — P4 needs only two attempts at the same slot, not three.

---

### P1 — Happy path: Plan a Visit

Confirms the most common funnel: anon guest, multi-discipline + add-on, plan_a_visit duration defaults, booking + bid + email shim row all created in one transaction.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Open `http://localhost:3000/` | Property picker lists Horseshoe Bay, Hog Heaven, Packsaddle with brand cards |
| 2 | Click **Horseshoe Bay Sporting Club** | Lands on `/book/horseshoe-bay`. Three booking-type cards visible. URL has no query params |
| 3 | Click **Plan a Visit** | Routes to `/book/horseshoe-bay/disciplines`. The `<BookingBuilder>` renders: discipline list, guest stepper (showing 1), calendar + slot grid, sticky "Estimate Total" footer |
| 4 | Click **Sporting Clays** card. Toggle **Drink Cart** add-on with quantity 2 | Card expands; add-on toggles on with `+`/`−` stepper at 2; Estimate Total updates |
| 5 | Step guest count to 4 | "4 guests". Estimate Total recomputes (tier hit: `1–4` rate × 4 = $600) |
| 6 | Click tomorrow's date on the calendar | Slot grid populates with 9 AM / 11 AM / 1 PM / 3 PM |
| 7 | Click **9 AM** | Slot tile highlights. Continue button enables |
| 8 | Click **Continue** | Routes to `/book/horseshoe-bay/details`. Right-rail summary shows: Plan a Visit, Sporting Clays, Drink Cart × 2, 4 guests, tomorrow's date, 9 AM CT, Estimate Total |
| 9 | Fill name `Test P1`, email `you+p1@example.com`, phone `5125550100`, leave notes empty. Click **Submit booking →** | Button shows "Submitting…"; ~1s later browser redirects to `/bids/<slug>/<code>` |
| 10 | Inspect the bid page | Hero shows "Horseshoe Bay Sporting Club" + tomorrow's date long form + "9 AM CT". Status banner reads "Your bid is being prepared." Body is hidden (pending_review). Footer renders |
| 11 | In Supabase Studio, run: `SELECT b.guest_name, b.guest_count, b.start_time, b.capacity_reserved, bd.service_id, COUNT(*) FROM bookings b JOIN booking_disciplines bd ON bd.booking_id = b.id WHERE b.guest_email = 'you+p1@example.com' GROUP BY b.id, bd.service_id;` | One row: guest_name `Test P1`, guest_count `4`, start_time tomorrow 9 AM Chicago, capacity_reserved `1`, one booking_disciplines row for Sporting Clays |
| 12 | Run: `SELECT add_on_id, quantity, unit_price_at_booking FROM booking_add_ons ba JOIN bookings b ON b.id = ba.booking_id WHERE b.guest_email = 'you+p1@example.com';` | One row: quantity `2`, unit_price_at_booking matches the seeded add-on price ($50.00 for Drink Cart) — NOT zero, NOT NULL, NOT a tampered payload value |
| 13 | Run: `SELECT slug, status, access_code_hash IS NOT NULL FROM bids WHERE booking_id IN (SELECT id FROM bookings WHERE guest_email = 'you+p1@example.com');` | One row: slug matches the URL segment, status `pending_review`, hash is NOT NULL |
| 14 | Run: `SELECT to_email, subject, template_name, payload->>'bidUrl', length(body_html), length(body_text) FROM dev_email_outbox WHERE to_email = 'you+p1@example.com' ORDER BY created_at DESC LIMIT 1;` | One row: subject "We're preparing your bid for Horseshoe Bay Sporting Club", template_name `guest_booking_confirmation`, bidUrl is an **absolute** URL beginning with `http://localhost:3000/bids/...`, body_html length > 1000, body_text length > 100 |

**Pass criteria:** every row above matches. The "absolute URL in payload bidUrl" check is load-bearing — App 8 emails depend on it; a relative URL would silently break links sent over real email.

---

### P2 — Happy path: Private Lesson

Confirms the private_lesson branch: instructor auto-assignment, 1-hour default duration, the bid page surfaces the assigned instructor.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/book` → **Packsaddle Precision** → **Private Lesson** | `<BookingBuilder>` renders. Single-select on disciplines (clicking a second one replaces the first, not adds) |
| 2 | Click **Precision Rifle**. Guest count 1. Pick tomorrow 11 AM. Continue | Estimate Total shows $200 (private_lesson seeded rate × 1 hour) |
| 3 | Submit with name `Test P2`, email `you+p2@example.com`, phone `5125550101` | Redirects to `/bids/<slug>/<code>` |
| 4 | `SELECT instructor_id, duration_hours FROM bookings WHERE guest_email = 'you+p2@example.com';` | instructor_id is NOT NULL (auto-assigned — should be `PLACEHOLDER Jordan Vance` at Packsaddle), duration_hours `1` |
| 5 | `SELECT name FROM instructors WHERE id = <instructor_id from step 4>;` | Returns one of the seeded Packsaddle instructor names. |
| 6 | Re-inspect the bid page (still `pending_review` so the body is hidden — that's fine). Force `confirmed` for the visual check: `UPDATE bids SET status = 'confirmed' WHERE booking_id = (SELECT id FROM bookings WHERE guest_email = 'you+p2@example.com');` | (See P-status for the safer ALTER TABLE DISABLE TRIGGER workflow if the workflow-guard trigger blocks the UPDATE — at `pending_review → confirmed` it doesn't, so this should succeed directly) |
| 7 | Reload the bid page | Body section is now visible. Instructor row reads "Instructor: PLACEHOLDER [name]" |

**Pass criteria:** instructor auto-assignment writes a real `instructor_id` (not NULL); the bid page surfaces it after `confirmed`.

---

### P3 — Happy path: Host an Occasion

Confirms exclusive-use copy + the capacity trigger reserves the full property (`capacity_reserved` = `max_concurrent_groups`).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/book` → **Hog Heaven Sporting Club** → **Host an Occasion** | Notice on the type card: "exclusive use — your booking blocks all other guests at this property during your window." |
| 2 | Builder renders. **Disciplines section is hidden** (host bookings don't surface guest-driven discipline selection). Guest count 12. Pick tomorrow 1 PM. Continue | Estimate Total shows "Team-quoted" (the team_quoted pricing model — no number; copy explicitly says quote will follow) |
| 3 | Submit with name `Test P3`, email `you+p3@example.com`, phone `5125550102` | Redirects to bid page |
| 4 | `SELECT capacity_reserved, booking_type FROM bookings WHERE guest_email = 'you+p3@example.com';` | capacity_reserved `1` (matches Hog Heaven's `max_concurrent_groups`), booking_type `host_an_occasion` |
| 5 | `SELECT COUNT(*) FROM booking_disciplines WHERE booking_id = (SELECT id FROM bookings WHERE guest_email = 'you+p3@example.com');` | `0` rows (host bookings don't carry disciplines) |

**Pass criteria:** capacity_reserved equals the property's `max_concurrent_groups`, no discipline rows.

---

### P4 — Property capacity rejection

Two Plan-a-Visit bookings at the same property + date + slot — second submission must surface the friendly capacity error, not a 500.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Run P1 happy path through step 9 (booking + bid created at HSB tomorrow 9 AM with `you+p4a@example.com`) | First booking succeeds, bid page renders |
| 2 | New browser tab. Walk the funnel again: HSB → Plan a Visit → any discipline → 1 guest → **tomorrow 9 AM** (the slot that's now full) → details → submit with `you+p4b@example.com` | Submit button shows "Submitting…", then the form re-renders with a red `<Alert>` above the fields: "That slot just filled — pick another time." Form fields stay populated; bid page does NOT load |
| 3 | `SELECT COUNT(*) FROM bookings WHERE start_time = (SELECT start_time FROM bookings WHERE guest_email = 'you+p4a@example.com');` | `1` row — the second attempt was rejected at the DB layer (Phase 2's `bookings_03_check_property_capacity` trigger) |
| 4 | `SELECT COUNT(*) FROM dev_email_outbox WHERE to_email = 'you+p4b@example.com';` | `0` rows — `after()` only fires when the RPC returns successfully, so no outbox row was written for the rejected attempt |

**Pass criteria:** form shows the friendly capacity copy (NOT a Sentry-style stack trace or generic "Something went wrong"); the DB has only one booking; no spurious email row.

---

### P5 — Instructor exclusion rejection (race condition)

Two private_lesson submissions for the same property + date + slot — Phase 2's tstzrange exclusion constraint ensures only one wins. The other must surface the friendly instructor-unavailable error.

This scenario requires two browser profiles or two devices submitting near-simultaneously. The exclusion constraint catches the race regardless of timing; the test is whether the UI surfaces the right error.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Browser A: walk to `/book/packsaddle/details` with private_lesson + Precision Rifle + tomorrow 11 AM. Fill `Test P5a` / `you+p5a@example.com`. **Don't submit yet.** | Submit button enabled |
| 2 | Browser B (incognito): repeat with `Test P5b` / `you+p5b@example.com`. Same property + slot. **Don't submit yet.** | Submit button enabled |
| 3 | Click **Submit booking →** in both browsers within ~1 second of each other | One browser lands on `/bids/<slug>/<code>`. The other re-renders the form with an `<Alert>`: "That instructor is no longer available — pick another time." |
| 4 | `SELECT guest_email, instructor_id FROM bookings WHERE start_time = (the slot's timestamptz) AND booking_type = 'private_lesson';` | Exactly **one** row — only one of the two attempts wrote to the DB. The other was rejected by Phase 2's exclusion constraint (errcode `23P01`) |

**Pass criteria:** the loser sees the friendly "instructor not available" copy (not "slot just filled" — that's P4's copy; the error mapping is `23P01 → instructor_unavailable`, which is what `create-public-booking.ts` translates).

If both browsers land on bid pages, the exclusion constraint isn't firing — that's a real bug, file it.

---

### P6 — Discipline/add-on mismatch (tampered request)

The form prevents picking a mismatched combo, so this scenario uses a `curl` POST against the Server Action endpoint to confirm the **server-side** Phase 2 trigger (`booking_add_ons_check_discipline`, deferred-constraint) catches a tampered submission.

Server Actions in Next.js 16 are POST endpoints reachable at the route they're declared in. Since the action is wired through React's RPC layer, hitting it via raw curl requires the action ID + the React Server Action protocol — too brittle to script in this doc.

**Practical alternative:** patch a single value in `details-form.tsx` temporarily to force a known-bad payload. Or skip this scenario in the manual pack and rely on Phase 2's migration tests (which already exercise the trigger) for coverage.

Recommend: skip in manual; confirm via the migration's existing unit test when the next admin tool surfaces a way to construct cross-property add-on payloads.

If you do run it: 
- Edit `src/components/public/booking-flow/details-form.tsx` `handleSubmit` to swap one `addOnId` for an add-on UUID that's seeded to a DIFFERENT property (e.g. a Packsaddle Target Package while booking HSB).
- Submit.
- Expect the form to show `<Alert>`: "Booking details don't match our rules. Please review and try again." (error code `23503` FK or `23514` CHECK in `create-public-booking.ts`'s `mapPgError`).
- Revert the test patch.

**Pass criteria:** the alert shows; no booking row is created. Skipping is acceptable for routine re-runs.

---

### P7 — Bid URL correctness

Confirms `buildBidUrl()` / `parseBidUrlParams()` / `validate_bid_access_code()` round-trip correctly and 404s without leaking slug existence.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | From P1's success, copy the bid URL: `http://localhost:3000/bids/<slug>/<code>` | URL captured |
| 2 | Open `http://localhost:3000/bids/<slug>/<code>` in a fresh incognito tab | Bid page renders (same as P1 step 10) |
| 3 | Open `http://localhost:3000/bids/<slug>` (no code segment) | 404 page (not 401, not "Bid not found", not an error stack) |
| 4 | Open `http://localhost:3000/bids/<slug>/xxxx` (wrong code) | 404 page |
| 5 | Open `http://localhost:3000/bids/this-slug-does-not-exist/<code>` (unknown slug, real code) | 404 page |

**Pass criteria:** rows 3–5 all 404. Any non-404 response leaks slug existence (the design intent is "without the code, the bid is not findable, period").

---

### P8 — RLS: anon cannot read another bid

A cross-bid attempt. Verifies the access-code gate is doing real work (not just URL pattern-matching).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | From P1 (you+p1@…), capture slug A + code A | URLs captured |
| 2 | From P2 (you+p2@…), capture slug B + code B | URLs captured |
| 3 | Open `http://localhost:3000/bids/<slug-A>/<code-B>` | 404 page — slug A exists, code B doesn't validate against slug A's `access_code_hash` |
| 4 | Open `http://localhost:3000/bids/<slug-B>/<code-A>` | 404 page — symmetric check |

**Pass criteria:** both 404. If either bid page renders, the bcrypt hash compare in `validate_bid_access_code()` is broken (or there's a hash-key collision — extraordinarily unlikely with bcrypt + 32-byte codes, file an incident).

---

### P9 — RLS: anon cannot list bids

Direct API smoke — confirms that `bids` has no anon SELECT policy. The bid page reads via service-role for this reason.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `curl 'https://<project-ref>.supabase.co/rest/v1/bids?select=*' -H "apikey: <NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>"` | Returns `[]` (empty array). No rows leak through |
| 2 | Same with `bookings`, `booking_disciplines`, `booking_add_ons`: replace `bids` in the URL | `[]` for every table |
| 3 | `curl 'https://<project-ref>.supabase.co/rest/v1/dev_email_outbox?select=*' -H "apikey: <NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>"` | `[]` (the email-shim table is RLS-enabled with no policies — same defense pattern as `processed_webhooks`) |

**Pass criteria:** every query returns an empty array. If `bookings` ever leaks rows here, anon clients could enumerate guest_email + phone — that's a PII breach, drop everything and patch immediately.

---

### P10 — Email shim wrote payload

Already partially covered in P1 step 14. Promoting to a standalone scenario so the visual review is explicit.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Run P1 through completion if not already done | `dev_email_outbox` has the row |
| 2 | Visit `/dev/emails`. Enter `DEV_DASHBOARD_PASSWORD` if prompted | Outbox lists P1's row at the top of the list. The right panel shows metadata (Subject, To, From, Template, Source, Sent) + the rendered HTML in a sandboxed iframe + the raw template props |
| 3 | Inspect the iframe content visually | Email title "We're preparing your bid." renders in serif. Guest name + property name + "tomorrow's date · 9 AM CT" line displays. Button "View your bid" is clickable and points at the bid URL. Bare-URL fallback paragraph below the button shows the same URL |
| 4 | Click the "View your bid" button inside the iframe | Browser navigates to the bid URL (opens in a new tab if the iframe sandbox blocks navigation in the current frame — that's expected) |
| 5 | Resize the browser to <980px wide | Layout stacks: list on top, detail panel below. List is page-scrollable (no nested 360px scroll trap). Iframe stays visible |

**Pass criteria:** every row matches. Step 4 specifically — the bidUrl in the email must navigate to the SAME bid URL the funnel redirected to. If clicking the button 404s, the email's URL construction (`buildAbsoluteBidUrl(getSiteOrigin(), slug, code)`) is broken.

### P10b — Real-inbox preview (optional polish gate)

Pre-launch sanity check before App 8 swaps the transport to Resend. Skip on routine re-runs; run before flipping App 2 to ✅.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | On `/dev/emails`, right-click the iframe → "View frame source" (Chrome) or copy `body_html` from `SELECT body_html FROM dev_email_outbox ORDER BY created_at DESC LIMIT 1;` | HTML captured |
| 2 | Paste into Gmail compose body. Send to yourself | Email arrives |
| 3 | Open on Gmail web, Gmail iOS, Apple Mail iOS, Outlook web, Outlook desktop if available | Layout holds. Button is tappable on mobile. Apple Mail dark mode renders sensibly (this is the highest-risk failure mode) |
| 4 | (Optional) Paste into Litmus or Email on Acid for a multi-client preview | No critical layout breaks across Gmail / Outlook 2016+ / Apple Mail / Yahoo |

**Pass criteria:** the email is readable in every major client. If Outlook desktop strips the button or Apple Mail dark mode inverts text into invisibility, the inline styles need a hardening pass before App 8 (or App 8 picks up the fixes). Document findings — don't block 2.10 sign-off unless a client is catastrophically broken.

---

### P11 — Back navigation preserves state

Confirms the `<BookingFlowProvider>` keeps in-progress funnel state across client-side route changes (the layout never remounts between funnel steps).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/book` → Hog Heaven → Plan a Visit → pick Wing Shooting + Drink Cart at quantity 3, guests 6, tomorrow 3 PM → Continue | Lands on `/book/hog-heaven/details` with the summary rail showing all selections |
| 2 | Click the browser's **Back** button once | Returns to `/book/hog-heaven/disciplines`. Wing Shooting is still expanded + selected. Drink Cart is still on at quantity 3. Guest count still shows 6. Calendar still shows tomorrow selected. 3 PM slot still highlighted |
| 3 | Click **Back** again | Returns to `/book/hog-heaven`. The Plan a Visit card has the highlighted/selected state (via `data-selected`) — visible as a thicker border or accent color |
| 4 | Click **Plan a Visit** again | Routes forward to `/book/hog-heaven/disciplines`. **All prior selections still present.** Continue button enabled |
| 5 | Click **Continue** → fill the form → submit | Booking succeeds end-to-end |

**Pass criteria:** zero state loss across back-and-forward. If guests resets to 1 or disciplines un-select on back-nav, the provider has remounted (the layout was force-rendered or React's identity changed). That's a regression in `<BookingFlowProvider>` or in how `app/(public)/book/[property]/layout.tsx` mounts it.

---

### P12 — Refresh resets to step 1

Confirms the deliberate-tradeoff state model: back-nav preserves, refresh resets. Anon guests don't get cookie/localStorage persistence (per `plan/app/app-2-public-booking.md` decision 6).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | `/book` → Horseshoe Bay → Plan a Visit → pick anything → reach `/book/horseshoe-bay/disciplines` mid-funnel | Funnel state populated |
| 2 | Press F5 / Cmd-R (refresh) | Browser redirects to `/book/horseshoe-bay?reset=1`. The property page renders with an `<Alert>` banner: "Let's start over — your prior selections cleared on refresh." (or similar; check the exact copy in `<BookingFlowGuard>`) |
| 3 | Click any booking type | Funnel begins fresh — no prior selections leaked through |
| 4 | Navigate directly to `/book/horseshoe-bay/details` from a new browser tab (no funnel history) | Same redirect to `/book/horseshoe-bay?reset=1` — the guard requires `bookingType + date + slotStart + guest` and none are set in a fresh tab |

**Pass criteria:** every row matches. If refresh keeps state, someone added cookie/localStorage persistence — revert that change, it was an explicit no.

---

### P-status — Bid status branch coverage

Walks the bid page through every status. Already exercised during 2.7/2.8 dev; formalize as a re-runnable scenario.

The `bids_sync_booking_status` trigger enforces a **forward-only** status workflow: `pending_review → confirmed → signed → paid`, plus the `denied`/`expired` terminal branches. Manual SQL UPDATEs from a later state to an earlier state (e.g. `paid → denied`) RAISE — that's correct application behavior, not a bug. To walk all branches in one session, disable the trigger first:

```sql
-- Temporarily skip the workflow guard for testing
ALTER TABLE bids DISABLE TRIGGER bids_sync_booking_status;
```

**Re-enable when done:**
```sql
ALTER TABLE bids ENABLE TRIGGER bids_sync_booking_status;
```

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Run P1 to create a bid. Note the slug | Bid page at `pending_review` — hero + status banner; body hidden |
| 2 | `ALTER TABLE bids DISABLE TRIGGER bids_sync_booking_status;` | Trigger off |
| 3 | `UPDATE bids SET status = 'confirmed' WHERE slug = '<slug>';`. Reload bid page | Body renders: guest summary, disciplines + add-ons, gear list (or empty state), schedule, FAQ (or empty), map placeholder, signature slot (active), deposit slot (active). Confirmed price line if `confirmed_price` is set; "—" otherwise |
| 4 | `UPDATE bids SET status = 'signed' WHERE slug = '<slug>';`. Reload | Signature slot now shows "Signed ✓" with the timestamp; deposit slot still active |
| 5 | `UPDATE bids SET status = 'paid' WHERE slug = '<slug>';`. Reload | Both slots show "done" / completed copy. Hero adds "We'll see you on <date>" |
| 6 | `UPDATE bids SET status = 'denied' WHERE slug = '<slug>';`. Reload | Body hidden. Status banner: "This bid is no longer active — contact us to rebook." No embeds |
| 7 | `UPDATE bids SET status = 'expired' WHERE slug = '<slug>';`. Reload | Same shape as `denied` (terminal-inactive branch) |
| 8 | `ALTER TABLE bids ENABLE TRIGGER bids_sync_booking_status;` | Trigger back on. Forgetting this leaves the workflow guard off — re-enable before any other test session |

**Pass criteria:** each status renders the right shape per `app/(public)/bids/[slug]/[code]/page.tsx`'s `isActiveBid(status)` predicate. If `signed` doesn't show the "Signed ✓" affordance, the signature slot's status branch is broken.

---

## App 6 — Stripe Deposit Collection

The "S" series. Covers the entire Stripe deposit flow: PaymentIntent creation (App 6.3), `<PaymentElement>` UI + AmountPicker (6.4 + Path A), webhook handler (6.5), admin manual refund (6.6), and the workflow finalization rules + status color/badge taxonomy that depend on them.

The pattern is: pick (or create) a `confirmed` bid → pay → verify bid + booking + receipt → optionally refund. Most scenarios assume the previous P-series happy path (P1/P2) has already been run to create test bids.

Re-run **S1–S15** before any future change that touches: `app/api/webhooks/stripe/route.ts`, anything under `src/services/stripe/`, `src/components/public/deposit-payment-form.tsx`, `src/components/admin/refund-deposit-button.tsx`, `src/components/admin/payment-status-badge.tsx`, the `sync_booking_from_bid` trigger, or any of the App 6 migrations (`20260523120000`, `20260523120100`, `20260523130000`, `20260524120000`).

### App 6 prerequisites (do once per test session)

- [ ] All four App 6 migrations applied to whichever Supabase project your dev server is pointed at. Verify with:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'bookings'
    AND column_name IN ('amount_paid', 'deposit_payment_intent_id');
  -- expect 2 rows.

  SELECT unnest(enum_range(NULL::bid_status_enum));
  -- expect 7 values including 'refunded'.
  ```
- [ ] Env vars in `.env.local`:
  - `STRIPE_SECRET_KEY` (test-mode `sk_test_…` or restricted `rk_test_…`)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test-mode `pk_test_…`)
  - `STRIPE_WEBHOOK_SECRET` — see next item
- [ ] **Webhook forwarding:** in a second terminal, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. The first line of output prints a `whsec_…` value — that's your `STRIPE_WEBHOOK_SECRET` for `.env.local`. Restart `npm run dev` after pasting. Keep `stripe listen` running for the entire session — without it, webhooks queue server-side but never reach localhost.
- [ ] **For production (Vercel) tests:** an endpoint is configured in Stripe Dashboard → Developers → Webhooks pointing at `https://<your-domain>/api/webhooks/stripe`, subscribed to at least `payment_intent.succeeded`. Its signing secret is set as `STRIPE_WEBHOOK_SECRET` in the Vercel project's Production env, and the project has been redeployed since that env var was last changed.
- [ ] A handful of test bids in `confirmed` status. Quickest way: run P1 (Plan a Visit) → in `/admin/bids/[id]/edit` set Confirmed quote (e.g. `400.00`) + Deposit (e.g. `100.00`) → save → click Confirm. Path A's AmountPicker only renders when the effective quote (`confirmed_price ?? estimated_price`) is meaningfully greater than the deposit. Repeat for `you+s1@example.com`, `you+s2@example.com`, … so each scenario uses a fresh bid.

### App 6 cleanup helper

There's no admin "un-pay" flow. To reset a paid bid for re-testing the flow on it, briefly disable the workflow guard and rewrite manually:

```sql
ALTER TABLE bids DISABLE TRIGGER bids_sync_booking_status;

UPDATE bookings SET
  status = 'pending_review',
  amount_paid = 0,
  deposit_payment_intent_id = NULL,
  updated_at = now()
WHERE guest_email = 'you+s1@example.com';

UPDATE bids SET
  status = 'pending_review',
  paid_at = NULL,
  refund_payment_intent_id = NULL,
  refund_amount = NULL
WHERE booking_id IN (SELECT id FROM bookings WHERE guest_email = 'you+s1@example.com');

ALTER TABLE bids ENABLE TRIGGER bids_sync_booking_status;
```

**Re-enable the trigger before the next scenario.** Leaving it disabled silently breaks the forward-only workflow guard.

For full session cleanup (delete the bid/booking entirely), use the App 2 cleanup helper above — it cascades through `booking_disciplines`, `booking_add_ons`, `bids`, and `dev_email_outbox`. `processed_webhooks` rows survive (acceptable — they're keyed by Stripe event id, not booking).

### Stripe test cards used below

- `4242 4242 4242 4242` — always succeeds. Use for happy paths.
- `4000 0000 0000 9995` — insufficient funds (declined at confirm). Use for failure paths.
- `4000 0027 6000 3184` — requires 3DS challenge. Use to verify the in-browser modal.

Any future expiry (e.g. `12 / 30`), any CVC (e.g. `123`), any ZIP (e.g. `12345`).

---

### S1 — Pay the deposit (variable amount, default)

Confirms the basic Path A happy path on a confirmed bid with deposit + larger quote: AmountPicker visible, default to deposit, pay deposit only, webhook updates bid.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Open the customer-facing bid URL for a fresh `confirmed` bid (deposit `$100`, quote `$400`) | Hero shows property name + date. Deposit slot renders the AmountPicker: input pre-filled `100.00`, **Deposit $100.00** button highlighted, **Full $400.00** button secondary. Below: PaymentElement loads with multiple payment-method options |
| 2 | Without changing the amount, type `4242 4242 4242 4242`, `12/30`, `123`, ZIP `12345`. Click **Pay $100.00** | Button shows "Processing…" then "Payment received — finalizing your bid…". Within 30s the page auto-refreshes to the Paid ✓ state. Status banner reads "Deposit received — one more step: sign your waiver…" (signed_at is null) |
| 3 | In `stripe listen` terminal | Logs `payment_intent.succeeded` then `200 OK` for `localhost:3000/api/webhooks/stripe` |
| 4 | `SELECT b.status AS bid_status, b.paid_at, bk.status AS booking_status, bk.amount_paid, bk.deposit_payment_intent_id FROM bids b JOIN bookings bk ON bk.id = b.booking_id WHERE bk.guest_email = 'you+s1@example.com';` | `bid_status=paid`, `paid_at` populated, `booking_status=deposit_paid`, `amount_paid=100.00`, `deposit_payment_intent_id` starts with `pi_` and matches the Stripe Dashboard |
| 5 | `SELECT id, event_type, processed_at FROM processed_webhooks WHERE source='stripe' ORDER BY processed_at DESC LIMIT 1;` | One row, `event_type=payment_intent.succeeded`, processed_at within seconds of step 2 |
| 6 | `SELECT subject, template_name FROM dev_email_outbox WHERE template_name='deposit_receipt' ORDER BY created_at DESC LIMIT 1;` | Subject: **"Deposit received — one more step"** |
| 7 | Open `/admin/bids/[id]` for this bid | Status badge shows **Paid** (green) and the **Deposit paid** payment badge (amber) next to it. Pricing card: Amount paid `$100.00 · ✓ Deposit paid`. "Balance due at property: $300.00" row appears. Refund button is visible in the actions area |

**Pass criteria:** bid + booking flip atomically, amount_paid reflects what was sent to Stripe, receipt subject matches the "deposit only" branch, admin Pricing card shows balance-due.

---

### S2 — Pay the full quote

Confirms Path A's "Full" quick-fill path: amount = effective quote, "Paid in full" branding throughout.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid for `you+s2@example.com` (deposit `$100`, quote `$400`). Open bid URL | AmountPicker visible |
| 2 | Click **Full $400.00**. Wait for the loading overlay ("Updating to $400.00…") to clear | "Deposit · $400.00" header line updates. Pay button label updates to **Pay $400.00**. PaymentElement remounts (card field is empty — expected) |
| 3 | Pay with `4242…`, future expiry, any CVC/ZIP. Submit | Auto-refresh to Paid ✓ within 30s. Bid page: **"$400.00 received"** (no "of $Y" suffix). Body: **"Thanks — your booking is paid in full. We'll see you at the property."** |
| 4 | SQL: `bid_status=paid`, `amount_paid=400.00`, `booking.status=deposit_paid` | Confirmed |
| 5 | `dev_email_outbox` top row subject | **"Payment received — one more step"** (waiver still unsigned, but full payment — different subject from S1) |
| 6 | `/admin/bids/[id]` for this bid | Status badges: **Paid** (green) + **Paid in full** (purple). Pricing card: Amount paid `$400.00 · ✓ Paid in full`. **No "Balance due at property" row** (none owed). |

**Pass criteria:** AmountPicker quick-fill works, full-payment subject branches correctly, "Paid in full" badge appears (purple), balance-due row hidden.

---

### S3 — Pay a partial amount (between deposit and quote)

Confirms the typed-amount path + partial payment classification.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid for `you+s3@example.com` (deposit `$100`, quote `$400`). Open bid URL | AmountPicker visible |
| 2 | Click in the AmountPicker input → clear → type `250` → Tab out (or click elsewhere). Wait for overlay to clear | Input reads `250.00`. Both quick-fill buttons go secondary (neither matches). Pay button: **Pay $250.00** |
| 3 | Pay with `4242…`. Submit | Auto-refresh. Bid page: **"$250.00 received of $400.00"**. Body: "Thanks — the remaining $150.00 settles at the property." |
| 4 | SQL: `amount_paid=250.00` | Confirmed |
| 5 | `dev_email_outbox` top row subject | **"Deposit received — one more step"** (not "Payment received" — only the *full quote* triggers that subject) |
| 6 | `/admin/bids/[id]` for this bid | Badges: **Paid** + **Partial payment** (amber). Pricing card: Amount paid `$250.00 · ✓ Partial payment`. Balance due at property: `$150.00` |

**Pass criteria:** typed amount commits, partial classification renders correctly, balance-due math matches.

---

### S4 — AmountPicker locks once card data is entered

Regression guard against the "PaymentElement.onChange fires on mount" bug (fixed by checking `event.empty`).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid (`you+s4@…`), deposit + quote like above. Open bid URL | AmountPicker visible, editable. PaymentElement loads |
| 2 | Click Deposit → Full → type `200` → blur — all without entering any card data | AmountPicker stays editable through every change. No lock. Hint reads "Pay at least the $100 deposit, up to the $400 quote…" |
| 3 | Click in the PaymentElement card-number field but **don't type** | AmountPicker still editable |
| 4 | Type a single digit (e.g. `4`) in the card-number field | **AmountPicker input + both quick-fill buttons become disabled (greyed).** Hint changes to: **"Amount is locked once you start entering card details. Refresh the page to change it."** |
| 5 | Backspace the card field back to empty | AmountPicker stays locked (one-way; refresh-to-change is the documented escape) |
| 6 | Refresh the page | AmountPicker editable again; PaymentElement empty |

**Pass criteria:** AmountPicker does not lock prematurely on mount; it locks only after actual card input.

---

### S5 — Idempotent re-click reuses the same PaymentIntent

Confirms the Server Action checks `bookings.deposit_payment_intent_id` and reuses a reusable PI with matching amount.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid (`you+s5@…`). Open bid URL | AmountPicker visible. PaymentElement loads → `bookings.deposit_payment_intent_id` is now set to a `pi_…` |
| 2 | `SELECT deposit_payment_intent_id FROM bookings WHERE guest_email = 'you+s5@example.com';` | Returns a `pi_…` value; note it |
| 3 | Refresh the bid page in the same browser. Don't change the amount | Same PaymentElement loads; the PI ID in DB is **unchanged** (verified by re-running the SQL from step 2) |
| 4 | In the Stripe Dashboard → Payments | Only **one** PaymentIntent exists for this booking, in `requires_payment_method` state |
| 5 | Click **Full $400.00** in the AmountPicker | Loading overlay shown. New PI created for $400. SQL in step 2 now returns a **different** `pi_…` (overwrite). The old $100 PI is still in Stripe (it will auto-cancel in 24h) |

**Pass criteria:** same-amount reload reuses the existing PI; amount change creates a fresh PI and overwrites the column.

---

### S6 — Bid not yet confirmed → form rejects payment

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Run P1 to create a `pending_review` bid for `you+s6@example.com`. **Do not confirm** | Bid status is `pending_review` |
| 2 | Open the bid URL | Body is hidden (`isActiveBid` predicate returns false for `pending_review`). No DepositSlot rendered. Banner: "Your bid is being prepared" |
| 3 | (Optional defensive check) Open browser dev tools → Network → call `createDepositSessionAction` directly via the React DevTools "Components" tab if you want to simulate a bypass | Returns `{ ok: false, reason: 'bid_not_payable', message: 'This bid is still being reviewed…' }` |

**Pass criteria:** page-level gate prevents form mount; Server Action defends with a clear error reason even if reached directly.

---

### S7 — Bid already paid → form not re-renderable

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Reuse the S1 bid (now `paid`). Open its bid URL again | DepositSlot renders the **Paid ✓** state, not the AmountPicker. No re-payment path |
| 2 | (Optional) Try calling `createDepositSessionAction` directly | Returns `{ ok: false, reason: 'already_paid', message: 'This bid has already been paid.' }` |

**Pass criteria:** UI doesn't offer to re-pay; Server Action defends if called.

---

### S8 — Webhook signature verification failure (security guard)

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Send a forged POST to the webhook (or omit the signature header): `curl -X POST http://localhost:3000/api/webhooks/stripe -H 'Content-Type: application/json' -d '{}'` | HTTP **400** response, body `"missing signature"` |
| 2 | Same but with a bogus signature header: `-H 'stripe-signature: t=1,v1=bogus'` | HTTP **400**, body `"invalid signature"` |
| 3 | `SELECT COUNT(*) FROM processed_webhooks WHERE id LIKE 'evt_forged%';` | `0` rows (no claim row created — signature verification gates the claim) |
| 4 | `npm run dev` terminal | Logs `[stripe webhook] signature verification failed { message: '...' }` |

**Pass criteria:** unsigned/forged requests are rejected before any DB write.

---

### S9 — Webhook replay is idempotent

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | After S1's successful payment, `SELECT * FROM processed_webhooks WHERE source='stripe' ORDER BY processed_at DESC LIMIT 1;` — note the event id | One row with `event_type='payment_intent.succeeded'` |
| 2 | Stripe Dashboard → Developers → Events → click the same event → click **Resend** (top right) | `stripe listen` terminal: logs `200 OK` |
| 3 | Re-run the SQL from step 1 | Still **one** row (no duplicate; the PK collision on `(id, source, event_type)` short-circuited) |
| 4 | SQL: `SELECT paid_at FROM bids WHERE booking_id = (SELECT id FROM bookings WHERE guest_email='you+s1@example.com');` | `paid_at` unchanged from the original payment timestamp (the UPDATE in the handler has a `status IN ('confirmed', 'signed')` filter — re-running it against a `paid` bid is a 0-row no-op) |
| 5 | `SELECT created_at FROM dev_email_outbox WHERE template_name='deposit_receipt' AND to_email='you+s1@example.com' ORDER BY created_at DESC;` | Still one row (no duplicate receipt). The handler bails before queuing the email when the bid UPDATE matched 0 rows |

**Pass criteria:** replays return 200 quickly, no duplicate state mutations, no duplicate emails.

---

### S10 — Receipt subject branches correctly

This is a meta-scenario consolidating receipt-copy outputs from S1, S2, S3:

| Payment | `signed_at` | Expected subject |
|---|---|---|
| Deposit only ($100 of $400) | `null` (S1) | "Deposit received — one more step" |
| Full quote ($400 of $400) | `null` (S2) | "Payment received — one more step" |
| Partial ($250 of $400) | `null` (S3) | "Deposit received — one more step" |
| Deposit only | not null (would need App 7 to set, or manual SQL) | "Deposit received — see you on `<date>`" |
| Full quote | not null | "Payment received — see you on `<date>`" |

**Pass criteria:** the four canonical paths produce four distinct subject lines (or two with `<date>` substituted for "one more step" depending on signed status).

---

### S11 — Admin full refund

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Open `/admin/bids/[id]` for the S1 bid (status `paid`, amount_paid `$100`) | "Refund deposit" button visible in the actions area |
| 2 | Click **Refund deposit**. Dialog opens with amount pre-filled `$100.00`, reason textarea empty | Hint reads "Defaults to the full amount paid ($100.00). Edit for a partial refund." |
| 3 | Add reason `"Test full refund — S11"`. Leave amount at $100.00. Click **Refund $100.00** | Button shows "Refunding…" → success card "Refund issued. $100.00 refunded. Stripe reference: `re_…`" |
| 4 | Click **Done** | Page refreshes. Status badge changes from **Paid** to **Refunded** (tan). PaymentStatusBadge (Deposit paid) is gone. Refund button is gone. Pricing card adds: "Refund: $100.00" |
| 5 | SQL: `SELECT b.status, b.refund_amount, b.refund_payment_intent_id, bk.status AS booking_status FROM bids b JOIN bookings bk ON bk.id=b.booking_id WHERE bk.guest_email='you+s1@example.com';` | `bid.status=refunded`, `refund_amount=100.00`, `refund_payment_intent_id='re_…'`, `booking_status=cancelled` |
| 6 | Stripe Dashboard → Payments → click the PI from S1 | A `re_…` refund event is recorded, full amount, matching reason metadata. PI status reads "Partially refunded" or "Refunded" (depending on fraction; for $100 of $100 → Refunded) |
| 7 | `SELECT staff_notes FROM bids WHERE booking_id = (SELECT id FROM bookings WHERE guest_email='you+s1@example.com');` | Includes a markdown block: `**Refund $100.00** (re_...) — <timestamp>\n\nTest full refund — S11` (appended to whatever was there) |

**Pass criteria:** Stripe-side refund succeeds; bid + booking statuses sync via the trigger; staff_notes appended; UI gates the button correctly post-refund.

---

### S12 — Admin partial refund still flips to refunded

Confirms Path A's design choice: any refund (partial or full) moves the bid to `refunded` (booking to `cancelled`). Partial-refund-without-cancel is not currently supported.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh paid bid (`you+s12@…`, paid full $400) | Status `paid`, amount_paid `400.00` |
| 2 | `/admin/bids/[id]` → Refund deposit. Dialog defaults to `$400.00` | Hint references full amount paid |
| 3 | Try entering `$500` → Refund $500.00 | Client-side validation error: **"Refund can't exceed the amount paid ($400.00)"**. No request sent |
| 4 | Enter `$100`. Reason `"Partial refund — S12"`. Refund $100.00 | Success. Stripe refund recorded for $100 |
| 5 | SQL post-refund | `bid.status=refunded` (not `partially_refunded` — Path A treats any refund as terminal). `refund_amount=100.00`. `booking_status=cancelled`. `amount_paid=400.00` (historical — unchanged) |

**Pass criteria:** client-side cap matches `amount_paid`; partial-refund flips bid to `refunded`; `amount_paid` stays as historical truth.

---

### S13 — Refund cap = `amount_paid`, not `deposit_amount`

Edge case that the Path A migration introduced: a customer who paid more than the deposit can be refunded up to the full amount paid.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh paid bid with partial payment (`you+s13@…`, deposit $100, quote $400, paid $250) | Status `paid`, `amount_paid=250.00` |
| 2 | Open Refund dialog | Default amount: **$250.00** (NOT $100). Hint: "Defaults to the full amount paid ($250.00)" |
| 3 | Try $300 → "Refund can't exceed the amount paid ($250.00)" | Confirmed |
| 4 | Refund $250 (full amount paid). SQL post-refund | `refund_amount=250.00`, `bid.status=refunded`, `booking_status=cancelled` |

**Pass criteria:** refund cap respects what was actually paid, not the original deposit minimum.

---

### S14 — Trigger relaxation: confirmed → paid skips signed

Validates the App 6 schema change to `sync_booking_from_bid` — the `paid` arm now accepts source `awaiting_guest` (not just `signed`), so customers can pay before signing.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Create a fresh `confirmed` bid (P1 + manual UPDATE to `confirmed` or via admin Confirm action) | `bid.status=confirmed`, `booking.status=awaiting_guest` |
| 2 | `UPDATE bids SET status='paid' WHERE booking_id = (SELECT id FROM bookings WHERE guest_email='you+s14@example.com');` (no trigger disable) | Update succeeds. `bid.status=paid`. Trigger fires: `booking.status=deposit_paid` |
| 3 | `UPDATE bids SET status='refunded' WHERE booking_id = (SELECT id FROM bookings WHERE guest_email='you+s14@example.com');` | Update succeeds. `bid.status=refunded`. Trigger fires: `booking.status=cancelled` |
| 4 | Try to "refund" a non-paid bid: `UPDATE bids SET status='refunded' WHERE id = (SELECT id FROM bids WHERE status='pending_review' LIMIT 1);` | RAISES: `sync_booking_from_bid: bid X moved to refunded but its booking Y was not in the expected source state` (because `pending_review` → `cancelled` is not a valid transition) |

**Pass criteria:** the new transitions (`confirmed → paid`, `paid → refunded`) work without trigger disable; invalid transitions still raise.

---

### S15 — Admin UI: badges + clickable rows

Visual + interaction verification of the admin bids list (`/admin/bids`).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Open `/admin/bids`. Filter by status `paid` | Each paid row shows the Status column with **Paid** (green) + the appropriate payment badge stacked below: **Paid in full** (purple) / **Deposit paid** (amber) / **Partial payment** (amber). Refunded rows show only **Refunded** (tan), no payment badge |
| 2 | Hover any row | Background tints to cream; cursor changes to pointer |
| 3 | Click anywhere on a row that isn't an `<a>` or `<button>` (e.g. the guest name cell, the date cell) | Navigates to `/admin/bids/[id]` for that bid |
| 4 | Press Tab to focus a row (without clicking) | An olive focus ring appears around the row |
| 5 | Press Enter while a row is focused | Same navigation |
| 6 | Hover the property pill (a `<Link>` inside the row) and click | Goes to the property page, **not** the bid detail (inner-link takes precedence) |
| 7 | Middle-click (or Cmd/Ctrl-click) the **View →** link in the last column | Opens the bid detail in a new tab (the View link is preserved specifically for this affordance) |

**Pass criteria:** row click navigates correctly; inner links keep their own destinations; keyboard accessibility works; status + payment badges read at a glance with distinct colors.

---

## App 7 — Dropbox Sign Waiver Flow

The "W" series. Covers the e-sign waiver lifecycle: envelope creation at bid confirmation (7.1), customer-facing modal signing flow (7.4 client component), webhook handler (7.5) including the App 6 workflow finalization contract (never regress `paid` → `signed`), admin envelope visibility.

The pattern is: confirm a bid → admin Server Action queues `createSignatureEnvelope` via `after()` → envelope id stamped on `bids.dropbox_sign_envelope_id` → customer visits bid page → "Sign your waiver →" button → modal opens with Dropbox Sign iframe → customer signs → webhook fires → `bids.signed_at` stamped → page transitions to "Signed ✓".

Re-run **W1–W9** before any future change that touches: `app/api/webhooks/dropbox-sign/route.ts`, anything under `src/services/dropbox-sign/`, `src/components/public/signature-form.tsx`, `lib/dropbox-sign/*`, the `confirmBid` envelope-creation hook in `src/services/admin/transition-bid.ts`, or the `bids.dropbox_sign_envelope_id` / `bids.signed_at` schema.

### App 7 prerequisites (do once per test session)

- [ ] Dropbox Sign account created (free tier is fine — uses test mode by default via `DROPBOX_SIGN_TEST_MODE` defaulting to on)
- [ ] API key copied from Settings → API → API Keys (NOT the API App's Client ID — easy to confuse; both are 32-char hex)
- [ ] API App created at Settings → API → API Apps with:
  - **Domain**: `rhytm-one.vercel.app` (the deployed Vercel URL)
  - **Event callback URL**: `https://rhytm-one.vercel.app/api/webhooks/dropbox-sign` — **must click "UPDATE APPLICATION" to save**; the TEST button works on the field's current state but real envelope events only fire to the saved URL
  - Client ID copied
- [ ] Template uploaded at Templates → Create New Template with:
  - Any 1-page PDF
  - Signer role named exactly **"Guest"** (case-sensitive — see `src/services/dropbox-sign/create-envelope.ts`)
  - At minimum: 1 × Signature field, 1 × Name (auto-fill), 1 × Date Signed (auto-fill) — all assigned to "Guest"
  - Template ID copied
- [ ] Three env vars in Vercel **Production**, then redeploy:
  - `DROPBOX_SIGN_API_KEY` — the API key
  - `NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID` — the Client ID
  - `DROPBOX_SIGN_TEMPLATE_ID` — the template id
  - (Optional: `DROPBOX_SIGN_WEBHOOK_SECRET` if your account surfaces a distinct Callback Signing Key — paid plans only. Free tier omits this and the webhook handler falls back to `DROPBOX_SIGN_API_KEY` for HMAC verification.)
- [ ] Verify env vars are loaded by clicking **TEST** on the API App's Event callback field. Vercel logs should show `POST /api/webhooks/dropbox-sign → 200` and Dropbox Sign dashboard should show "Success! Hello API Event Received was found in the response."

### App 7 cleanup helper

To reset a signed bid for re-testing:

```sql
-- Clear signing artifacts on a bid. The envelope_id is intentionally
-- preserved so the existing Dropbox Sign record stays accessible from
-- the admin page; only clear it if you want a completely fresh envelope
-- (and accept that the existing Dropbox Sign signature request becomes
-- orphaned in their dashboard).

ALTER TABLE bids DISABLE TRIGGER bids_sync_booking_status;

UPDATE bids
SET signed_at = NULL,
    status = CASE WHEN status = 'signed' THEN 'confirmed' ELSE status END
WHERE booking_id IN (SELECT id FROM bookings WHERE guest_email = 'you+w1@example.com');

-- Booking status follows. If you also reset bid.status to 'confirmed':
UPDATE bookings
SET status = 'awaiting_guest', updated_at = now()
WHERE guest_email = 'you+w1@example.com';

ALTER TABLE bids ENABLE TRIGGER bids_sync_booking_status;
```

**Re-enable the trigger before the next scenario.** Same warning as P-status / App 6 cleanup.

To void the existing Dropbox Sign envelope and start fresh:

```sql
-- Clear the envelope_id so the next confirmBid creates a new envelope
-- (otherwise the existing one is reused). The Dropbox Sign-side
-- envelope is left orphaned; cancel it manually in their dashboard if
-- you want it tidied.
UPDATE bids
SET dropbox_sign_envelope_id = NULL
WHERE booking_id IN (SELECT id FROM bookings WHERE guest_email = 'you+w1@example.com');
```

---

### W1 — Envelope created at bid confirmation

Confirms the App 7.1 hook: `confirmBid` Server Action queues `createSignatureEnvelope()` via `after()`, which calls Dropbox Sign's `signatureRequestCreateEmbeddedWithTemplate` and persists the resulting `signature_request_id` to `bids.dropbox_sign_envelope_id`.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Create a fresh `pending_review` bid via the public funnel (P1 pattern). Note the slug | Bid exists; `dropbox_sign_envelope_id` is NULL |
| 2 | Go to `/admin/bids/[id]` for the new bid → click **Confirm** | Confirm succeeds; status badge changes to **Confirmed** |
| 3 | Watch Vercel logs (within ~5 seconds) | Either silence (envelope creation succeeded) or `[transition-bid/confirm] envelope creation failed { bidId, reason, message }`. Reason `disabled` means env vars not set (App 7 dormant — expected if not configured yet). |
| 4 | Refresh `/admin/bids/[id]`. Check the Lifecycle card's "Waiver envelope" row | Shows a non-null envelope id (looks like `7925fb23bad49d6dfd335c83a4ea69910a5c9185` — 40-char hex) |
| 5 | In the Dropbox Sign dashboard → Documents (or Signature Requests) | A new signature request appears for `you+w1@example.com` with status "Awaiting signature" |
| 6 | `SELECT dropbox_sign_envelope_id FROM bids WHERE booking_id = (SELECT id FROM bookings WHERE guest_email = 'you+w1@example.com');` | Returns the same envelope id from step 4 |

**Pass criteria:** envelope id stamped within ~5s of confirm; signature request visible in Dropbox Sign; admin Lifecycle card reflects it. If step 3 logs `disabled`, complete Prerequisites then re-run.

---

### W2 — Customer signs in modal (happy path)

Confirms the full embedded-signing flow: customer opens the modal, signs in the iframe, webhook fires, bid transitions to `signed`.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Open the customer-facing bid URL for the W1 bid (status now `confirmed`, envelope ready) | Hero + body sections render. SignatureSlot shows a **"Sign your waiver →"** button (replaces the old inline 500px iframe — see App 7 modal-mode change) |
| 2 | Click **Sign your waiver →** | Modal overlay appears with backdrop. Dropbox Sign iframe loads inside (full-screen-ish, responsive). Close button visible in top corner |
| 3 | Sign in the modal. After submitting, the modal auto-closes | Bid page shows the "Waiver signed — Finalizing your booking" success card with a 40px spinner |
| 4 | In `stripe listen`-equivalent — Vercel logs | `POST /api/webhooks/dropbox-sign → 200` for `signature_request_signed` AND `signature_request_all_signed` events |
| 5 | Within ~2-5s (polling loop in `signature-form.tsx`) the page auto-refreshes | SignatureSlot now shows **"Signed ✓"** with the "Waiver signed" copy; slot turns green (slotDone class). Timeline marks Sign step as complete |
| 6 | SQL verify: `SELECT status, signed_at, dropbox_sign_envelope_id FROM bids WHERE booking_id = (SELECT id FROM bookings WHERE guest_email = 'you+w2@example.com');` | `status = 'signed'` (or stays `'paid'` if bid was already paid — see W3), `signed_at` populated, envelope id unchanged |
| 7 | `SELECT event_type, processed_at FROM processed_webhooks WHERE source = 'dropbox_sign' ORDER BY processed_at DESC LIMIT 5;` | Two rows: `signature_request_signed` + `signature_request_all_signed` for this envelope |

**Pass criteria:** modal opens cleanly, signature persists end-to-end, page auto-transitions to Signed ✓ without manual refresh, `processed_webhooks` records both events.

---

### W3 — Pay-then-sign order: signing a paid bid stays paid

Confirms the App 6 workflow finalization contract: when a bid is already `paid` (App 6 pay-before-sign), signing stamps `signed_at` but does NOT regress status to `signed`. This is enforced by the conditional `WHERE status = 'confirmed'` in `handle-signature-event.ts`'s status-advance UPDATE.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Create a fresh confirmed bid (W1 pattern). Pay the deposit via App 6's DepositPaymentForm with test card `4242…` | Bid `status='paid'`, `paid_at` set, `signed_at` still NULL |
| 2 | Open the bid URL. SignatureSlot still shows the "Sign your waiver →" button (paid bids still need to sign for full finalization) | Confirm button visible; status banner reads "Deposit received — one more step: sign your waiver above before \<date\>" |
| 3 | Sign in the modal as in W2 | Page transitions through the success card |
| 4 | SQL: `SELECT status, signed_at, paid_at FROM bids WHERE …` | **`status` remains `'paid'`** (NOT regressed to `'signed'`), `signed_at` and `paid_at` both populated |
| 5 | SQL: `SELECT status FROM bookings WHERE id = (SELECT booking_id FROM bids WHERE …);` | Booking stays at `deposit_paid` (no spurious transition because bid status didn't change in the conditional UPDATE) |
| 6 | Bid page render | "All set" status banner ("We'll see you on \<date\>"), timeline shows BOTH Sign and Pay steps complete + "All set" complete |

**Pass criteria:** signing a paid bid never regresses status; both signals end up stamped; UI flips to the fully-finalized terminal state.

---

### W4 — Sign-then-pay order: signing first reaches `signed`, then paying reaches finalization

The mirror of W3. Same workflow finalization rule from the other direction.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Create + confirm a fresh bid (`you+w4@example.com`). Status `confirmed` | Envelope created |
| 2 | Sign first (don't pay yet) | Webhook fires. Bid → `signed`, `signed_at` stamped. Trigger fans booking → `signed` (Phase 3 trigger) |
| 3 | Pay deposit | Webhook fires (App 6). Bid → `paid`, `paid_at` stamped. Booking → `deposit_paid`. `signed_at` preserved |
| 4 | Bid page render | "All set" terminal banner. Same as W3 |

**Pass criteria:** opposite ordering reaches the same terminal state.

---

### W5 — Customer declines the waiver

Confirms decline handling: the webhook records the event in `processed_webhooks`, but the bid stays in its current state (admin follow-up is manual for v1).

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid (`you+w5@example.com`). Open bid URL → click **Sign your waiver →** | Modal opens |
| 2 | Inside the iframe, find Dropbox Sign's decline option (might require their menu to "Decline" — depends on signer permissions on the template) | Decline confirmed in iframe |
| 3 | Modal closes. SignatureForm renders the "Waiver declined" Alert: "You can't finalize your booking without signing the waiver." | Decline copy visible |
| 4 | Vercel logs | `POST /api/webhooks/dropbox-sign → 200` for `signature_request_declined` event. Handler logs `[dropbox-sign webhook] signer declined; admin follow-up required` |
| 5 | SQL: `SELECT status, signed_at FROM bids WHERE …` | **status unchanged** (still `confirmed`), `signed_at` still NULL |
| 6 | `SELECT event_type FROM processed_webhooks WHERE source = 'dropbox_sign' AND event_type = 'signature_request_declined' ORDER BY processed_at DESC LIMIT 1;` | Returns the declined event |

**Pass criteria:** decline path doesn't accidentally advance status; event is captured in `processed_webhooks` for audit. Admin would normally follow up via email; that's currently manual (not built in App 7 v1).

---

### W6 — Webhook replay is idempotent

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | After W2's successful signing, note the `processed_webhooks` row id for `signature_request_all_signed` | One row |
| 2 | Dropbox Sign dashboard → API App → callback history → find the signed event → Resend (if dashboard surfaces a resend option). Alternative: use the SDK's resend API. | New POST appears in Vercel logs |
| 3 | Re-run the SQL from step 1 | Still **one** row for that event id (PK collision short-circuited the claim insert) |
| 4 | SQL: `SELECT signed_at FROM bids WHERE …` | Unchanged from W2 (the UPDATE has `signed_at IS NULL` guard, so re-running it is a no-op) |
| 5 | Vercel log for the replay attempt | `POST /api/webhooks/dropbox-sign → 200` with `"Hello API Event Received"` body |

**Pass criteria:** replays return 200 quickly; no duplicate state mutations.

---

### W7 — Webhook signature forge

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Forge a POST: `curl -X POST https://rhytm-one.vercel.app/api/webhooks/dropbox-sign -F 'json={"event":{"event_time":"123","event_type":"callback_test","event_hash":"bogus"}}'` | HTTP **400**, body `"invalid signature"` |
| 2 | Vercel logs | `[dropbox-sign webhook] signature verification failed { eventType: 'callback_test', eventTime: '123', receivedHashLength: 5, secretLength: 32, secretSource: 'DROPBOX_SIGN_API_KEY (fallback)' }` |
| 3 | `SELECT COUNT(*) FROM processed_webhooks WHERE id = 'bogus'` | 0 (signature verification gates the claim insert) |

**Pass criteria:** forged events rejected before any DB write; diagnostic log fields useful without leaking the secret.

---

### W8 — Embedded URL expiry / refresh-to-continue

Embedded sign URLs expire ~30 min from creation. If the customer leaves the modal open across that boundary, signing fails. The UI should surface a clean recovery path.

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | Fresh confirmed bid, open bid URL, click **Sign your waiver →** | Modal opens |
| 2 | Wait ≥ 31 min without signing (or simulate by mocking the URL expiry in dev) | Iframe shows Dropbox Sign's "session expired" error inside the modal |
| 3 | Close the modal → click **Sign your waiver →** again | New sign URL fetched via Server Action; modal opens with fresh iframe; signing works |

**Pass criteria:** URL expiry is recoverable with one extra click — no permanent failure.

---

### W9 — Admin sees envelope id on bid detail

| # | Action | Expected outcome |
|---|--------|-----------------|
| 1 | After W1 confirm, open `/admin/bids/[id]` for that bid | Lifecycle card includes a **"Waiver envelope"** row with the envelope id (as monospace text) |
| 2 | After W2 sign, refresh the admin page | Same envelope id row, plus the "Signed" row now shows the timestamp from `bids.signed_at` |
| 3 | (Future polish, not yet built) Link to the signed PDF | n/a — link to signed PDF download via Dropbox Sign API is deferred to a later phase. For now, staff can view the signed document in the Dropbox Sign dashboard by clicking through to the request |

**Pass criteria:** envelope id surfaces in admin Lifecycle card pre- and post-signing.

---

## Cleanup

After a testing session, for every plus-aliased email used:

- [ ] `/dev` → Reset test user (auth scenarios)
- [ ] For App 2 scenarios, run the SQL cleanup helper in the "App 2 cleanup helper" section above (clears `bookings`, cascaded children, and `dev_email_outbox` rows)
- [ ] If P-status or any App 6 scenario ran with the workflow guard disabled, confirm `ALTER TABLE bids ENABLE TRIGGER bids_sync_booking_status;` was executed — a left-disabled workflow guard silently allows invalid status transitions on future bookings
- [ ] If App 6 scenarios created real (test-mode) Stripe PaymentIntents, no Stripe-side cleanup is required — test-mode PIs are sandboxed and auto-cancel after 24h. The `processed_webhooks` rows survive (acceptable — they're keyed by Stripe event id) and the weekly `pg_cron` job deletes them after 30 days
- [ ] If App 7 scenarios created Dropbox Sign envelopes, leave them — test-mode envelopes don't count against the free-tier monthly cap and they're cheap to ignore. The `bids.dropbox_sign_envelope_id` rows persist as historical references. If you DO want to cancel an envelope on the Dropbox Sign side, use their dashboard's "Cancel signature request" action; our app doesn't expose a cancel UI yet

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

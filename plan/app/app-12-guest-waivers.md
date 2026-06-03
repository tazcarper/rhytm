# App 12 — Guest Waivers (Implementation Plan)

**Status:** 📝 Drafted (awaiting build kickoff) · **Drafted:** 2026-05-30

Extends the post-confirmation bid flow so that **every guest in a party signs a waiver**, not just the primary signer. Today only the lead guest (the person who requested the bid) signs via Dropbox Sign; a party of four shows up with three unsigned waivers. This adds a self-service way for the primary to collect the rest.

Companion to `plan/app/app-7-waiver.md` (the single-signer waiver flow this builds on — homegrown native signing, with Dropbox Sign retained as a deprecated fallback) and `plan/app/app-6-stripe-deposit.md` (the deposit flow that, together with App 7, defines "finalized").

---

## Overall strategy

The shape of the feature, end to end:

1. **The primary finalizes first, unchanged.** Booking confirmation still depends only on the primary signing + paying any required deposit. App 12 adds nothing to the critical path — it is a *parallel completeness track* that opens up only **after** the primary is finalized.
2. **A Guest Waivers grid appears on the bid page.** Once finalized and `guest_count > 1`, the primary sees one row per additional guest (`guest_count − 1`), pre-labeled "Guest 1", "Guest 2", … Each row is a small state machine surfaced as a color: **neutral** (no link yet) → **red** (link generated, not signed) → **green** (signed).
3. **The primary labels, the guest owns their identity.** The primary types a name into a row (a label/hint) and clicks **Generate link**. They forward that link however they like (copy/paste, text, email). The guest opens it, confirms/edits their own name, supplies their *own* email, and signs. The primary never needs to know guest emails up front.
4. **One Dropbox Sign envelope per guest, created lazily.** We reuse the existing waiver template. The envelope is created the moment a guest opens their link and submits details — never sooner — so links that are generated but never opened cost nothing. Each guest ends with a legally-signed PDF identical to the primary's.
5. **Per-guest tokens, never the bid code.** Guests authenticate with their own unguessable token (bcrypt-hashed, plaintext-in-URL — the exact `bids.access_code_hash` pattern). The primary's bid access code is never exposed to a guest, and a guest token grants access only to its own row + a bare event summary.
6. **The webhook routes by metadata.** The existing Dropbox Sign handler keys off `signature_request_id` → `bids`. We add a metadata discriminator (`bid_id` vs `guest_waiver_id`) so a guest signature stamps only its own row and never touches `bids.status` or fires `bookingConfirmed`. The App 6/7 finalization contract is preserved verbatim.

**Why non-blocking:** holding a booking hostage to a slow guest is worse UX than showing up with a couple of unsigned waivers (which staff can resolve on the day). Finalization logic stays simple and untouched; the grid is a "chase the stragglers" tool, not a gate.

**Why Dropbox Sign per guest (not an in-app form):** legal consistency with the primary waiver, and zero new signing infrastructure — we reuse the template, the embedded SDK, the webhook, and the idempotency machinery. The tradeoff is per-request billing (see Risks).

---

## Decisions locked in for this build

| # | Decision | Choice |
|---|---|---|
| 1 | Signing mechanism | **Dropbox Sign per guest.** One embedded envelope per guest, reusing `DROPBOX_SIGN_TEMPLATE_ID` and the `"Guest"` signer role. |
| 2 | Gating | **Non-blocking.** Booking finalizes on primary sign + deposit, exactly as today. Guest waivers never affect `bids.status` or `bookingConfirmed`. |
| 3 | Identity capture | **Primary labels, guest confirms.** Primary types a name hint; the guest confirms/edits name + enters their own email on the waiver page. |
| 4 | Envelope creation timing | **Lazy** — created when the guest opens their link and submits details, not when the link is generated. Unopened links cost zero API requests. |
| 5 | Guest auth | **Per-guest token.** 32-byte base64url, bcrypt hash stored, plaintext embedded in URL once. Mirrors `validate_bid_access_code`. |
| 6 | Row status | **Derived, not stored** — from `access_token_hash` + `signed_at`. Avoids state drift (per the project's display-defaults rule). |
| 7 | Row reconciliation | `ensure_guest_waiver_rows(bid_id)` upserts `1..(guest_count-1)` idempotently, so admin edits to `guest_count` stay reflected. |
| 8 | Webhook routing | **By metadata.** `metadata.bid_id` → primary path (unchanged); `metadata.guest_waiver_id` → guest path (stamp row only). |
| 9 | Guest page route | **Separate top-level `/waiver/[token]`** — not nested under the bid slug/code, so the primary's code is never shared. |
| 10 | Email invite | **Optional, phase 6.** Copy-link works without it; an Inngest + Resend invite is additive. |

**Out of scope for v1:**

- Minor/guardian co-signing (flagged as a recommendation — see Risks; cheap to add now, painful to retrofit).
- Reassigning a signed waiver to a different person.
- Bulk "generate all links" / bulk email. One row at a time for v1.
- Guest-side deposit or payment. Guests sign only.

---

## Data model

New migration `supabase/migrations/<ts>_app_12_guest_waivers.sql`.

```sql
create table public.bid_guest_waivers (
  id                       uuid primary key default gen_random_uuid(),
  bid_id                   uuid not null references public.bids(id) on delete cascade,
  booking_id               uuid not null references public.bookings(id) on delete cascade,
  guest_index              int  not null,                 -- 1..(guest_count-1), the "Guest N" ordinal
  label_name               text,                          -- primary-entered name hint
  guest_name               text,                          -- guest-confirmed name at sign time
  guest_email              text,                          -- guest-entered email at sign time
  access_token_hash        text,                          -- bcrypt hash; NULL until link generated
  dropbox_sign_envelope_id text,                          -- created when guest opens link + submits
  signed_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (bid_id, guest_index),
  unique (dropbox_sign_envelope_id)
);

alter table public.bid_guest_waivers enable row level security;
```

**Derived status (single source of truth):**

| Condition | Status | Color |
|---|---|---|
| `signed_at IS NOT NULL` | signed | 🟢 green |
| `access_token_hash IS NOT NULL` and `signed_at IS NULL` | awaiting | 🔴 red |
| `access_token_hash IS NULL` | not started | ⚪ neutral |

**DB functions** (all `SECURITY DEFINER STABLE SET search_path = public`, per CLAUDE.md RLS rules — no inline cross-table EXISTS):

- `validate_guest_waiver_token(p_token text)` — bcrypt-verify against `access_token_hash`, timing-safe dummy verify on miss. Direct analog of `validate_bid_access_code`.
- `ensure_guest_waiver_rows(p_bid_id uuid)` — upserts rows `1..(guest_count-1)` keyed on `(bid_id, guest_index)`. Idempotent; reads `bookings.guest_count` under definer rights.

**RLS:** no anon policy (public guest page reads via the validator function on a service-role client). Admin SELECT policy by staff role for the admin completion view.

---

## Phases

Build in dependency order. Each phase is independently testable.

### Phase 1 — Schema & DB functions

- New migration: `bid_guest_waivers` table + RLS enable + indexes.
- `validate_guest_waiver_token` + `ensure_guest_waiver_rows`.
- **Manual test (CLAUDE.md RLS rule 6):** run the validator and reconciler as the actual roles against the live DB. Confirm `ensure_guest_waiver_rows` is idempotent and tracks a changed `guest_count`. Confirm anon gets no rows.

**Done when:** migration applies, both functions behave under manual role tests, audit shows no policy dependency cycle.

### Phase 2 — Service layer (`src/services/guest-waivers/`)

Following the established pattern (injected client, domain types, one responsibility each):

| File | Responsibility |
|---|---|
| `list-guest-waivers.ts` | `getGuestWaivers(supabase, bidId)` → `GuestWaiverRow[]` (ordinal, labelName, derived status, public link if token exists). |
| `set-guest-label.ts` | `setGuestLabel(supabase, { bidId, guestIndex, labelName })`. |
| `generate-guest-link.ts` | `generateGuestLink(supabase, { bidId, guestIndex })` → mints token, stores hash, returns plaintext URL. Idempotent: re-generating rotates the token (old link dies). |
| `validate-guest-token.ts` | `getGuestWaiverByToken(token)` → validates via RPC, returns row + event summary (property, date). |
| `submit-guest-details.ts` | `submitGuestDetails({ token, guestName, guestEmail })` → persists name/email, then calls `createGuestSignatureEnvelope`. |

**Envelope refactor** — make `src/services/dropbox-sign/create-envelope.ts` signer-agnostic:
- `createSignatureEnvelope` (primary) — public contract unchanged.
- `createGuestSignatureEnvelope(ctx, { guestWaiverId })` — same template request with guest name/email and **`metadata: { guest_waiver_id }`**. Persists envelope id onto the guest row with the same `.is(col, null)` guard + UNIQUE-index race protection used for bids.

**Done when:** each service has a unit/integration test (or manual exercise) and `createGuestSignatureEnvelope` produces a test-mode envelope tagged with `guest_waiver_id` metadata.

### Phase 3 — Webhook routing

- Extend `src/services/dropbox-sign/handle-signature-event.ts` to branch on metadata **before** matching against `bids`:
  - `metadata.bid_id` → existing primary path (unchanged).
  - `metadata.guest_waiver_id` → new `onGuestSigned()`: stamp `bid_guest_waivers.signed_at` (idempotent on `IS NULL`). **Does not** touch `bids.status` or fire Inngest.
- `signature_request_canceled` for a guest envelope clears that row's `dropbox_sign_envelope_id` (mirrors bid behavior), allowing re-issue.

**Done when:** a guest test-mode signature stamps the correct row and demonstrably leaves `bids.status` / `bookingConfirmed` untouched (verify the App 6/7 finalization scenarios still pass).

### Phase 4 — Public guest waiver page (`app/(public)/waiver/[token]/page.tsx`)

- Separate top-level route, `force-dynamic`, service-role read via `getGuestWaiverByToken`.
- Branches:
  - **Invalid/expired token** → `notFound()` (same opacity discipline as the bid page).
  - **Not signed** → event summary + "Your details" form (name prefilled from `label_name`, email field) → on submit, server action creates the envelope and mounts `<SignatureForm>`.
  - **Already signed** → "Thanks, your waiver is on file."
- New sign-URL server action `getGuestSignUrlAction` validates the **guest token** (not slug+code) and mints a fresh embedded URL. Reuse `signature-form.tsx` / `hellosign-embedded` unchanged otherwise.

**Done when:** opening a generated link as a guest, entering details, and signing flips the row to signed via the webhook.

### Phase 5 — Bid-page Guest Waivers grid

- New `<GuestWaiverSection>` in `app/(public)/bids/[slug]/[code]/page.tsx`, placed after `SignatureSlot`/`DepositSlot`, inside the active-bid block. Renders **only** when the primary is finalized (reuse the `finalized` logic already computed in `StatusBanner`) and `guest_count > 1`.
- Server-renders the grid via `getGuestWaivers` after calling `ensure_guest_waiver_rows`.
- New client component `src/components/public/guest-waiver-grid.tsx`: editable name per row, **Generate link** → **Copy link** affordance, status pill + red/green row background, and `router.refresh()` polling to flip rows green as guests sign (same idiom as `signature-form.tsx` / `deposit-payment-form.tsx`).
- Bid-page server actions in `app/(public)/bids/[slug]/[code]/guest-waiver-actions.ts` (`setGuestLabel`, `generateGuestLink`) **re-validate slug + code** via `validate_bid_access_code` — the exact authorization pattern `getSignUrlAction` / `createDepositSessionAction` use. No action trusts a client-supplied bid id.

**Done when:** full loop works end-to-end — primary labels a row, generates + copies a link, guest signs, row flips green on the primary's view without a manual reload.

### Phase 6 — Email invite & admin visibility (optional polish)

- **Email:** "Email this to my guest" on link generation → Inngest `guestWaiverInvited` event → Resend template (reuses `EmailService` + the `send-bid-confirmation-email` pattern). Idempotency key `guest-waiver:<id>`.
- **Admin:** read-only completion summary ("3 of 5 signed") on the admin bid detail view (`src/services/admin/bids.ts`) so staff can chase stragglers.

**Done when:** invite email sends in test transport with the right link; admin bid detail shows accurate counts.

---

## Risks & recommendations

1. **Dropbox Sign cost.** Billing is per signature request — a 12-guest occasion = 12 requests beyond the primary. Lazy envelope creation minimizes waste (only opened links create envelopes). Keep `DROPBOX_SIGN_TEST_MODE` on until launch; confirm plan/quota before going live.
2. **Minors / guardians.** Waivers commonly need a guardian signature for under-18s. Recommend adding an "I'm signing as guardian for a minor" checkbox + minor-name field to the guest form **now** — cheap to add, painful to retrofit. Confirm the Dropbox Sign template supports it.
3. **Token rotation.** Re-generating a link overwrites the hash and kills the old link. Surface this in the UI ("This replaces the old link") so the primary isn't surprised.
4. **Privacy scope.** A guest token shows the event summary and that guest's own row only — never pricing, deposit, or other guests. Keep the guest page strictly row-scoped.
5. **Idempotency & races.** Reuse the proven guards — `.is(col, null)` conditional updates, UNIQUE partial indexes on envelope ids, and `processed_webhooks` claim-first. No new idempotency infrastructure required.
6. **Local dev.** Same constraint as App 7 — Dropbox Sign has no CLI tunnel, so webhook testing happens against the deployed Vercel URL.

---

## Touch points (existing files this build extends)

| File | Change |
|---|---|
| `src/services/dropbox-sign/create-envelope.ts` | Add `createGuestSignatureEnvelope`; share core with the primary path. |
| `src/services/dropbox-sign/handle-signature-event.ts` | Metadata-based routing + `onGuestSigned`. |
| `app/(public)/bids/[slug]/[code]/page.tsx` | Mount `<GuestWaiverSection>` after the deposit slot, finalized + multi-guest only. |
| `app/api/webhooks/dropbox-sign/route.ts` | No change (dispatches to the handler, which now routes internally). |
| `src/services/admin/bids.ts` | (Phase 6) guest-waiver completion summary. |
| `lib/inngest/events.ts` + functions | (Phase 6) `guestWaiverInvited` event + email function. |

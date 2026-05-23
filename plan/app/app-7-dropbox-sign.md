# App 7 — Dropbox Sign Waiver Flow (Implementation Plan)

**Status:** 🔄 Scaffolding (template + API key pending from client) · **Drafted:** 2026-05-23

The customer-facing surface that turns a `confirmed` bid into a `signed` bid by collecting the guest's waiver signature via Dropbox Sign. Lives inline on the public bid page — the existing `SignatureSlot` card becomes a live embedded signing form instead of an "App 7 placeholder."

Companion to `plan/app/app-6-stripe-deposit.md`. App 6 + App 7 together complete the bid workflow: sign + pay in either order, both required to finalize.

---

## Scope recap

Four deliverables, all post-bid-confirmation:

1. **Embedded signature flow on the public bid page** — replaces the placeholder SignatureSlot when `bid.dropbox_sign_envelope_id IS NOT NULL` and `bid.signed_at IS NULL`. No redirect; the bid page stays the guest's single home base.
2. **Envelope creation at bid confirmation** — `confirmBid` Server Action queues `createSignatureEnvelope()` via `after()` so the envelope is ready by the time the guest visits.
3. **Dropbox Sign webhook handler** at `app/api/webhooks/dropbox-sign/route.ts` — verifies the HMAC signature, claim-first in `processed_webhooks` (Phase 6 pattern), advances bid status (conditional — see Workflow finalization) and stamps `bids.signed_at`.
4. **Admin visibility** — `/admin/bids/[id]` shows envelope ID + link to signed PDF when available.

**Out of scope for App 7:**

- Multi-signer envelopes (group bookings). Single-signer (the lead guest) only for v1.
- Custom waiver fields beyond auto-fill (name, date, property). The template carries the fields; we just pass merge data.
- Decline-path admin email. Currently a `declined` webhook logs + leaves the bid in its current state; admin follow-up is manual.
- Resend-signature-request admin action. Future polish.
- Inngest workflow for envelope creation. We call the API directly via `after()` for now (App 9 territory if/when async retries are needed).

---

## Decisions locked in for this build

| # | Decision | Choice |
|---|---|---|
| 1 | Signing surface | **Embedded** — Dropbox Sign's JS SDK (`hellosign-embedded`) mounts the iframe inside our SignatureSlot. Matches App 6's "bid page is home base" UX. |
| 2 | Envelope creation timing | **Eager** — created in `after()` immediately when staff confirms the bid. Customer waits zero seconds on first sign attempt. |
| 3 | Single-signer | **Yes** — lead guest only. Multi-signer is a product change, not v1. |
| 4 | Template-based | **Yes** — staff uploads a waiver template in the Dropbox Sign dashboard once; we reference it by `DROPBOX_SIGN_TEMPLATE_ID`. Custom per-bid documents are a future enhancement. |
| 5 | Status-advance rule | **Conditional.** Webhook always stamps `signed_at`. Status advances `confirmed → signed` only when current status is `confirmed`. If the bid is already `paid` (App 6 pay-before-sign path), the handler leaves status as `paid` and just stamps `signed_at`. Never regress `paid` to `signed`. |
| 6 | Direct API call (no Inngest) | The `after()` post-response pattern is sufficient for v1. If retry semantics become important, move to Inngest (App 9). |
| 7 | Webhook signing | HMAC-SHA256 over `event_time + event_type` using `DROPBOX_SIGN_WEBHOOK_SECRET` — Dropbox Sign's documented verification scheme. |
| 8 | Local dev story | **Vercel-only.** Unlike Stripe's `stripe listen`, Dropbox Sign has no CLI tunnel. All webhook testing happens against the deployed URL. More "push to Vercel and test" iteration than App 6. |

---

## What's already in the schema (no new migration needed)

Phase 3 anticipated this work:

- `bids.dropbox_sign_envelope_id text` + `UNIQUE` partial index (Phase 3 migration `20260518133902`)
- `bids.signed_at timestamptz` (Phase 3)
- `bid_status_enum` includes `'signed'` (Phase 3)
- `sync_booking_from_bid` trigger arm: `bid 'signed' from booking 'awaiting_guest'` → `booking 'signed'` (Phase 3 + App 6 relaxation)
- `processed_webhooks` (Phase 6) — claim-first idempotency

The only DB-level concern for App 7: the trigger's `'signed'` arm refuses to fire if `booking.status` is anything other than `'awaiting_guest'`. **That's the safety mechanism for "don't regress paid → signed"**: when bid is already `paid` and booking is `deposit_paid`, the webhook handler must NOT attempt the bid status UPDATE (it would RAISE in the trigger). It MUST update only `signed_at`. This is App 7's primary safety contract.

---

## Workflow finalization (the bid is "fully done" when…)

App 6 introduced the rule: a bid is fully finalized when `paid_at IS NOT NULL AND signed_at IS NOT NULL`, in any order.

App 7 makes that real. Four scenarios:

| Bid current state | What App 7 does | Result |
|---|---|---|
| `confirmed`, `signed_at` null | Customer signs. Webhook: status → `signed`, `signed_at = now()`. Trigger: booking `awaiting_guest → signed`. | Awaiting payment. |
| `signed`, `signed_at` set | Already signed. No-op (idempotent). | (n/a) |
| `paid`, `signed_at` null (pay-then-sign) | Customer signs. Webhook: `signed_at = now()`, status stays `paid`. Trigger does NOT fire (status didn't change). | **Fully finalized** — `paid_at` and `signed_at` both set. Bid page renders "All set." |
| `paid`, `signed_at` set | Already fully finalized. No-op. | (n/a) |

The "All set" terminal banner on the bid page already checks `bid.status === 'paid' && bid.signed_at !== null` — it just hasn't had a path to `signed_at` for paid bids until App 7. After App 7, it lights up correctly.

---

## Env vars

```bash
DROPBOX_SIGN_API_KEY=                  # required: server-side API key from dashboard
DROPBOX_SIGN_TEMPLATE_ID=              # required: id of the uploaded waiver template
DROPBOX_SIGN_CLIENT_ID=                # required for embedded signing: client_id from API app config
DROPBOX_SIGN_WEBHOOK_SECRET=           # already in .env.example: HMAC-SHA256 signing secret
NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID=    # client-side: same as DROPBOX_SIGN_CLIENT_ID, but inlined to the browser bundle
```

**Setup gate:** the client must:
1. Create a Dropbox Sign account
2. Upload the waiver template (PDF + signature/name/date fields)
3. Create an API app (for the embedded signing client_id)
4. Add a webhook endpoint pointing at `https://<domain>/api/webhooks/dropbox-sign` and copy the signing secret
5. Paste API key, template id, client id, webhook secret into Vercel env vars

Until items 1–5 are complete, App 7 is **dormant in production**: services skip gracefully when env vars are missing; bid pages render the existing placeholder.

---

## Packages

```bash
npm install @dropbox/sign hellosign-embedded
```

- `@dropbox/sign` — server SDK (rebranded from HelloSign Node SDK).
- `hellosign-embedded` — client-side JS for embedded signing. (Still named hellosign-embedded post-rebrand; npm package hasn't been renamed.)

---

## File layout

### New files

```
plan/app/
  app-7-dropbox-sign.md                          this file

lib/dropbox-sign/
  server.ts                                      Server-only client factory

src/services/dropbox-sign/
  create-envelope.ts                             Idempotent envelope creation
  get-embedded-sign-url.ts                       Fresh sign URL per bid-page render
  handle-signature-event.ts                     Webhook event dispatcher
  types.ts                                       Shared types

src/components/public/
  signature-form.tsx                             Client component, embedded sign iframe
  signature-form.module.css

app/api/webhooks/dropbox-sign/
  route.ts                                       Phase 6 idempotency + HMAC verify
```

### Modified files

```
app/(public)/bids/[slug]/[code]/page.tsx
  SignatureSlot mounts <SignatureForm> when bid.dropboxSignEnvelopeId set
  AND bid.signedAt is null. Existing "signed" state copy already correct.

src/services/bids/get-bid.ts
  Expose bid.dropboxSignEnvelopeId in BidDetail.

src/services/admin/get-bid-detail.ts
  Expose dropbox_sign_envelope_id in AdminBidDetail.

src/services/admin/transition-bid.ts
  confirmBid queues createSignatureEnvelope via after() — best-effort,
  doesn't block the response. Failure logs but doesn't roll back the
  confirm.

app/admin/bids/[id]/page.tsx
  Show envelope id in Lifecycle card. Link to signed PDF when
  signed_at is set (Dropbox Sign hosts the PDF; admin clicks through).

.env.example
  Add DROPBOX_SIGN_API_KEY, DROPBOX_SIGN_TEMPLATE_ID,
  DROPBOX_SIGN_CLIENT_ID, NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID.

package.json
  +@dropbox/sign, +hellosign-embedded
```

---

## Sub-phases (sequencing — what depends on what)

### 7.1 — Scaffolding (TODAY, build everything pre-template)

- Plan doc, env vars, SDK install
- `lib/dropbox-sign/server.ts` — client factory; throws if env missing (services swallow it)
- `src/services/dropbox-sign/` skeletons — services that no-op gracefully when env not set
- `app/api/webhooks/dropbox-sign/route.ts` — full handler logic, dispatches to services
- Wire into `confirmBid` (`after()` call)
- Wire into bid page SignatureSlot (renders only when envelope id set)
- Update read services to expose envelope id
- Update admin page to surface envelope id + signed PDF link

After 7.1: code compiles, no DB changes, no test deploy. App stays in current shape because env vars aren't set. Customer-facing surface unchanged.

### 7.2 — Activation (when waiver + API key arrive)

- Client uploads waiver template to Dropbox Sign
- Client creates API app, copies client_id
- Client creates webhook endpoint in dashboard, copies signing secret
- Paste env vars into Vercel: `DROPBOX_SIGN_API_KEY`, `DROPBOX_SIGN_TEMPLATE_ID`, `DROPBOX_SIGN_CLIENT_ID`, `NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID`, `DROPBOX_SIGN_WEBHOOK_SECRET`
- Redeploy
- Smoke test: confirm a bid → envelope created → bid page shows signing iframe → sign → webhook fires → status advances

### 7.3 — Test pack (post-activation)

In the same style as App 6's S series. Tentative scenarios:

- W1 — Envelope created at confirmation, bid page shows the iframe
- W2 — Customer signs (single-signer happy path): bid `confirmed → signed`, `signed_at` stamped
- W3 — Pay-then-sign order: bid `paid` → customer signs → `signed_at` stamped, status stays `paid`, "All set" banner renders
- W4 — Sign-then-pay order: bid `signed` → customer pays → bid `paid`, fully finalized
- W5 — Customer declines: webhook fires, no status change, log captured
- W6 — Webhook replay (resend in dashboard): idempotent, no double-stamping
- W7 — Webhook signature forge: 400 returned
- W8 — Embedded URL expiry: customer left tab open for 1h, returns and tries to sign → graceful "refresh to continue" message
- W9 — Admin sees envelope id in lifecycle card; link to signed PDF on a signed bid

---

## SOLID + project-rule checklist

- **Single Responsibility.** `create-envelope`, `get-embedded-sign-url`, `handle-signature-event` each do exactly one thing. Webhook route is a dispatcher.
- **Open/Closed.** Adding `declined` / `canceled` event handlers later is one new arm in the dispatcher + one new handler service. Existing arms unchanged.
- **Liskov.** N/A — no new abstractions, just integration with existing `EmailService` interface for admin notifications (deferred to App 8).
- **Interface Segregation.** Services take `{ supabase, signApi }` plus task-specific params; no monolithic context.
- **Dependency Inversion.** Services receive the Dropbox Sign API client as a parameter from the route handler / Server Action. Never instantiate internally.
- **Strict portal allowlist.** `/api/webhooks/dropbox-sign/*` is outside the portal allowlist (middleware skip on `/api/`).
- **Database is source of truth.** Dropbox Sign is the e-sign authority; our DB is the workflow authority. The webhook reconciles state.
- **Workflow finalization rule** (App 6 contract): status-advance is conditional on current status being `confirmed` — never regress.

---

## RLS notes

- `bids` already has admin / property_manager / member / partner SELECT policies (Phase 3). No new policies needed.
- `processed_webhooks` is RLS-enabled with no policies; service-role writes only. Already correct.
- Bid UPDATE in the webhook goes through service-role (anon has no UPDATE on bids). Same pattern as App 6.

---

## Risks + open questions

1. **Waiver template content.** Gating item. Without the PDF + legal language, the template can't be uploaded, and without the template, no envelope creation works. Need from client.
2. **Local-dev iteration speed.** No `stripe listen` equivalent. Every webhook iteration requires a Vercel push. Mitigations: develop service logic with unit-test-style invocation locally (mock event payloads), only push when changing the route handler shape.
3. **Embedded SDK quirks.** `hellosign-embedded` has been around since pre-rebrand; its API is stable but the docs are split between old HelloSign URLs and new Dropbox Sign URLs. Plan to consult Dropbox Sign's current docs primarily.
4. **Free-tier limits.** Dropbox Sign free tier is 3 signature requests/month. Dev/staging testing needs to be careful. Production needs a paid plan from day one.
5. **PDF URL access for admins.** Signed PDFs are accessible via Dropbox Sign API → returns a temporary download URL. We should NOT store these URLs (they expire). Admin clicks "View signed waiver" → server fetches a fresh URL → redirects browser.
6. **Decline / cancel UX.** Today these are logged + leave bid in current state. Future polish: admin email notification when a guest declines, surfaced in `/admin/bids/[id]`.

---

## What to expect when this lands (post-activation)

- Customer receives confirmation email with bid URL (existing — App 2.9)
- Customer visits bid page → SignatureSlot shows embedded waiver form → customer signs inline
- Webhook fires → bid status advances (or `signed_at` stamped if already paid) → bid page auto-refreshes to show Signed ✓
- Combined with App 6: pay + sign in any order → bid hits "All set" terminal state automatically
- Admin sees envelope ID in `/admin/bids/[id]` Lifecycle card; "View signed waiver" link appears once signed

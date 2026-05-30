# App 8 — Resend Email Transport (Implementation Plan)

**Status:** 🔄 Code complete; activation blocked on client Q1–Q3 in `plan/questions/2026-05-24/app-8-resend/` · **Drafted:** 2026-05-24 · **Phases 1–3 landed:** 2026-05-24

The transport swap that turns `LoggingEmailService` (dev-only — writes rendered emails to `dev_email_outbox`) into `ResendEmailService` — real deliverable email via Resend's API. Every existing caller (App 2.9 booking confirmation, App 6.5 deposit receipt, App 6.6 refund notice) continues to work without modification.

This is the SOLID payoff for the dependency-inversion design we baked into App 2.9. The `EmailService` interface stays unchanged; the factory branches; callers don't know or care which transport is in use.

---

## Scope

One thing: real customer emails. After App 8, every email path the prior apps wired in DELIVERS to the customer's inbox instead of accumulating in `dev_email_outbox`.

**Out of scope:**

- New email templates (we already have `guest-booking-confirmation`, `deposit-receipt`, `refund-notice`)
- Inbound email handling (replies route to a real inbox via reply-to; that inbox is the client's responsibility to monitor)
- Bounces / unsubscribe handling beyond what Resend surfaces by default
- Marketing emails / sequences — this is transactional only
- Dropping the `dev_email_outbox` table (kept for dev parity; trivially empty in prod)

---

## Decisions locked in

| # | Decision | Choice |
|---|---|---|
| 1 | Transport switch | `EMAIL_TRANSPORT` env var. Values: `resend` / `logging` / `noop`. Default `logging` (no behavior change for dev). |
| 2 | Sender domain | **Revised 2026-05-24:** `send.rhythm.co` — the client's existing verified Resend setup (DKIM + SPF + bounce-routing DNS at Netlify, dated 2026-05-07). Better pattern than the apex `rhythm.co` originally planned — keeps transactional reputation isolated from Google Workspace inbound mail at the apex. |
| 3 | From address | TBD per client Q1 (see `plan/questions/2026-05-24/app-8-resend/q1-from-address.md`). Address will be `something@send.rhythm.co`. Read from `RESEND_FROM_EMAIL` env var so the launch domain / handle can move without a deploy. |
| 4 | Reply-to | TBD per client Q3 (see `plan/questions/2026-05-24/app-8-resend/q3-reply-to-inbox.md`). Customers reply to that inbox; the client designates which inbox. Read from `RESEND_REPLY_TO` env var. |
| 5 | dev_email_outbox in prod | Skip the parallel write. Resend's dashboard is the audit log (30-day delivery history + opens + bounces). Drop in a future migration if it ever feels redundant. |
| 6 | Idempotency | Pass `idempotency_key` on every send. Key shape: `${source}-${template_name}-${to}-${stable_id}` where `stable_id` is the bid id / booking id / refund id. Same key within Resend's idempotency cache returns the same send. |
| 7 | Send fire path | Same as today: `after()` in the calling Server Action / webhook handler so the response isn't blocked on the SMTP round trip. |

---

## Setup steps (one-time, client-blocking)

### Phase 1 — Code (✅ landed 2026-05-24)

1. ✅ Plan doc (this file)
2. ✅ Install `resend` SDK (`resend@6.12.3`)
3. ✅ Write `ResendEmailService` class implementing the existing `EmailService` interface (`src/services/notifications/resend-email-service.ts` — `@react-email/render` → HTML + `toPlainText()`, deterministic per-(source,template,recipient) `idempotencyKey`, structured error returns)
4. ✅ Update `getEmailService()` factory to branch on `EMAIL_TRANSPORT === "resend"` (lazy-require keeps SDK out of dev/test paths)
5. ✅ `DEFAULT_FROM_EMAIL` reads `RESEND_FROM_EMAIL` env var with the `no-reply@rhythm.local` placeholder fallback
6. Vercel env-var add + redeploy deferred to Phase 4 (Q1–Q3 must answer first)

### Phase 2 — Resend account + domain (✅ resolved without new setup)

**Pivot from original plan.** When inspecting the client's Netlify DNS for `rhythm.co`, found that **Resend was already set up on `send.rhythm.co`** by the client (DNS records dated 2026-05-07: DKIM TXT at `resend._domainkey.send.rhythm.co`, SPF TXT at `send.send.rhythm.co`, bounce-routing MX at `send.send.rhythm.co`). This is actually the better pattern than what I'd planned (apex domain) — `send.rhythm.co` is an isolated transactional reputation lane that doesn't share with the Google Workspace inbound MX on the apex.

Pivoted to use the client's existing account instead of the new one I'd just created. The new account is dormant / discardable.

7. ✅ Use client's existing Resend account (not the new one)
8. ✅ Verified sending domain: `send.rhythm.co` (status: verified, sending: enabled, created 2026-05-07 per `GET /domains`)
9. ✅ N/A — no DNS work needed

### Phase 3 — DNS verification (✅ resolved)

10. ✅ Already in place — see Phase 2 pivot
11. ✅ N/A
12. ✅ Domain verified per `GET https://api.resend.com/domains` (HTTP 200 against client's API key)

### Phase 3.5 — End-to-end delivery proof (✅ landed 2026-05-24)

13. ✅ Got client's Resend API key (`re_a2rcu…`), added to `.env.local`
14. ✅ Sent test email via direct curl: `POST https://api.resend.com/emails` from `Rhythm Outdoors <bookings@send.rhythm.co>` to `jtc006@gmail.com` returned HTTP 200 with email id `45733227-f4d7-41cf-af56-97d167036834`. Mail landed in inbox.

### Phase 4 — Production activation (⏸ blocked on client Q1–Q3)

Three decisions needed before flipping the env vars in Vercel. See `plan/questions/2026-05-24/app-8-resend/`:

- **Q1** — From address: `bookings@send.rhythm.co` / `noreply@send.rhythm.co` / `hello@send.rhythm.co` / other?
- **Q2** — Display name: single "Rhythm Outdoors" or per-property?
- **Q3** — Reply-to inbox: where do customer replies actually land?

Once answered:

15. Vercel → Settings → Environment Variables → add:
    - `EMAIL_TRANSPORT=resend`
    - `RESEND_API_KEY=re_…`
    - `RESEND_FROM_EMAIL=<answer to Q1 + Q2>` (e.g. `Rhythm Outdoors <bookings@send.rhythm.co>`)
    - `RESEND_REPLY_TO=<answer to Q3>`
16. Redeploy
17. End-to-end test: book a bid via the public funnel → confirmation email lands in the guest's real inbox

### Phase 5 — Optional local factory test (any time before Phase 4)

Independent of Phase 4 — proves the EmailService factory + render path works (not just the curl call from Phase 3.5):

- Temporarily set in `.env.local`: `EMAIL_TRANSPORT=resend` and `RESEND_FROM_EMAIL="Rhythm Outdoors <bookings@send.rhythm.co>"`
- Restart `npm run dev`
- Run a public booking end-to-end
- Verify the mail arrives via the `ResendEmailService` code path (not via `dev_email_outbox`)
- Revert both vars to empty after testing

---

## Implementation surface

### New files

```
plan/app/
  app-8-resend.md                            this file

src/services/notifications/
  resend-email-service.ts                    ResendEmailService class
```

### Modified files

```
src/services/notifications/send-email.ts     getEmailService factory adds
                                             a 'resend' branch.

.env.example                                  EMAIL_TRANSPORT,
                                              RESEND_API_KEY,
                                              RESEND_FROM_EMAIL,
                                              RESEND_REPLY_TO.

package.json                                  + resend
```

No DB changes. No new templates. No caller changes.

---

## Edge cases folded into the implementation

1. **Resend API errors** (rate limit, invalid recipient, server error) → return `{ ok: false, error: message }` to caller. Caller logs and moves on (best-effort sends — booking + payment + refund flows complete regardless).
2. **Render failure** (template throws during `@react-email/render`) → return `{ ok: false, error: 'render failed: ...' }`. Same caller contract as LoggingEmailService.
3. **`EMAIL_TRANSPORT=resend` but `RESEND_API_KEY` missing** → factory still constructs the service but the first send fails; we surface a clear error message rather than crashing the request.
4. **Sender domain not yet verified** → Resend rejects the send. Error includes a hint. Our caller logs + continues.
5. **Plain-text fallback** → `@react-email/render`'s `toPlainText()` derives the text version from the rendered HTML (same as LoggingEmailService today). Resend accepts both `html` and `text` fields.
6. **Free-tier rate limits** — Resend free is 100/day, 3000/month. For a 3-property booking operation this is plenty; flag if usage grows.

---

## Test pack (post-activation — E series)

| # | Scenario |
|---|---|
| E1 | `EMAIL_TRANSPORT=resend`, run P1 booking → real email lands in the guest's inbox; subject + body match; bid link works |
| E2 | Pay a deposit (App 6 S1) → branded receipt lands in the guest's inbox with "one more step" copy |
| E3 | Issue a refund (App 6 S11) → refund-notice email lands |
| E4 | `EMAIL_TRANSPORT=logging` (or unset), same triggers → rows land in `dev_email_outbox`, no real emails sent (regression guard for dev workflow) |
| E5 | Invalid recipient (e.g., `foo@nonexistent.invalid`) → Resend rejects; caller logs error; booking / payment / refund state still correct |
| E6 | Webhook replay (Stripe S9 replay) → no duplicate receipt sent (the upstream idempotency gates this; Resend's `idempotency_key` is belt-and-suspenders) |

Verify the address LANDS in inbox, not spam. First-time sends from a freshly-verified domain can spam-fold; warming up the domain by sending a few one-off legit messages helps.

---

## Open questions for the client

All four App-8-related questions are in `plan/questions/2026-05-24/app-8-resend/`:

- **Q1** — From address (`bookings@send.rhythm.co` / `noreply@send.rhythm.co` / `hello@send.rhythm.co` / other)
- **Q2** — Display name in From header (single "Rhythm Outdoors" or per-property?)
- **Q3** — Reply-to inbox (where do customer replies actually land?)
- **Q4** — Existing Resend usage on `send.rhythm.co` (confidence check; low priority)

The original "do you use rhythm.co for inbound email" question is answered ✅ — yes, Google Workspace MX is at the apex (`rhythm.co MX 1 smtp.google.com`). That's why pivoting to the `send.rhythm.co` subdomain was the right move: the transactional reputation stays isolated from inbound mail.

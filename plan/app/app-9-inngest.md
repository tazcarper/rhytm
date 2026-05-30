# App 9 — Inngest Workflow Engine (Implementation Plan)

**Status:** 🔄 Scaffold landed 2026-05-24; workflow bodies blocked on client Q1–Q16 (esp. Q7, Q8, Q15) · **Drafted:** 2026-05-24

Inngest handles every multi-step async flow in the system: bid reminders, pre-event emails, post-event follow-up, membership approval, bid expiry, HubSpot sync. Each step has automatic retries, idempotency keys, and a visual execution timeline in Inngest's dashboard.

This plan documents the scaffold (in place now) and the workflow backlog (queued behind client answers).

---

## Why Inngest, not a custom queue

Build proposal locked this in. Inngest gives us:

- **Step-by-step durability.** A workflow with 6 steps survives Vercel cold-starts, function timeouts, and transient API failures — each step retries independently.
- **Visual timeline.** Every run is inspectable: arguments, return values, step duration, retries. Removes "where did that email go?" debugging.
- **Cron + sleep + wait-for-event.** Three primitives that cover most workflow shapes — bid expiry (sleep 7 days, then check), pre-event email cadence (sleep until T-3, T-1), waiting for sign + pay before sending finalization (wait-for-event).
- **Free tier covers Rhythm's volume.** 50k events/month free; this build is nowhere near that ceiling.

Alternatives considered: hand-rolled Postgres queue (no observability, every step is custom retry logic), Vercel Cron (one-shot only, no multi-step state). Both are worse for the multi-step workflows we need.

---

## Scope

In scope for App 9:

- Inngest client + event type registry + serve handler at `/api/inngest`
- Workflow functions for each Q-blocked use case (one per client decision)
- Event fire points inside existing Server Actions / webhook handlers
  (the "fire-after-commit" wiring — App 9 sub-phase 9.2)

Out of scope:

- New email templates (handled by App 8 — every Inngest function that sends mail goes through `getEmailService()`)
- HubSpot integration internals (App 9 fires events; the HubSpot writer lives in its own service module, called from an Inngest step)
- Replacing the existing `after()` calls for fire-and-forget envelope creation. Those are simple enough; only move to Inngest when we need retries or observability.

---

## Scaffold (✅ landed 2026-05-24)

### Files

```
lib/inngest/
  client.ts                     Inngest client, schemas-typed
  events.ts                     RhythmEvents — the typed event registry
  functions/
    index.ts                    Barrel — registers every function
                                with the serve handler
    on-bid-created.ts           Scaffolded no-op handler (logs only)

app/api/inngest/
  route.ts                      GET / POST / PUT via `inngest/next` serve()
```

### Event registry (initial)

Schemas defined; firing sites NOT yet wired (the existing actions/webhooks
don't call `inngest.send()` yet — that's sub-phase 9.2).

| Event | Fires from | Downstream workflows |
|---|---|---|
| `bid/created` | public booking funnel | confirmation email, HubSpot deal create, bid expiry timer (Q7) |
| `bid/confirmed` | admin `confirmBid` Server Action | bid-ready email, 48h follow-up timer (Q7) |
| `bid/signed` | Dropbox Sign webhook | deposit-ready email, finalization email |
| `bid/deposit-paid` | Stripe webhook | deposit receipt, finalization email |
| `bid/expired` | scheduled function (Q7-dependent) | status flip, instructor release, team notification |
| `booking/confirmed` | trigger or webhook | pre-event email cadence per Q15 |
| `membership/application-submitted` | membership form | approval task (Q8) |
| `membership/approved` | admin approve action | Supabase Auth invite, welcome email, HubSpot advance |

### Env vars

- `INNGEST_EVENT_KEY` — production. Authenticates `inngest.send()` against Inngest Cloud. Missing in cloud mode → throws.
- `INNGEST_SIGNING_KEY` — production. Used by `/api/inngest` to verify incoming step executions. Missing in cloud mode → handler rejects every request.
- `INNGEST_DEV=1` — local dev. **Required** with Inngest 4.x — the SDK no longer auto-detects NODE_ENV, so without this flag a local `npm run dev` runs in cloud mode and rejects the dev server's traffic. Set it in `.env.local`; never set it in production.

All three documented in `.env.example`.

---

## Workflow backlog (blocked on client answers)

Each entry below is a workflow function we can write the moment the linked
client question is answered. The infrastructure is in place; only the
business logic is gated.

### W1 — Bid auto-expiry (blocked on Q7)

**Trigger:** `bid/created` event → `step.sleep(Q7_DAYS)` → check `bids.status`.

**If status === 'awaiting_guest' after sleep:**
- Set `bids.status = 'expired'`
- Release instructor availability (delete booking row or cancel)
- Fire `bid/expired` event for downstream notifiers

**If status advanced (signed / paid / cancelled):** no-op.

**Blocked on:** Q7 — auto-expiry days (recommended 7). Also Q7's 48h follow-up sub-question affects the "team notification" step shape.

### W2 — 48-hour unsigned follow-up (blocked on Q7)

**Trigger:** `bid/confirmed` event → `step.sleep('48h')` → check `bids.signed_at IS NULL`.

**If still unsigned:**
- Per Q7 answer: email to staff, HubSpot task, admin UI flag, or combination.

**Blocked on:** Q7 sub-question (notification channel).

### W3 — Pre-event email cadence (blocked on Q15)

**Trigger:** `booking/confirmed` event → schedule four steps relative to `event_start_at`:

| Step | Sleep until | Email content |
|---|---|---|
| T-14 | `event_start_at - 14d` | Gear list, directions, what to expect |
| T-3 | `event_start_at - 3d` | Reminder, weather, parking |
| T-1 | `event_start_at - 1d` | Final confirmation, arrival time, who to ask for |
| T+1 | `event_start_at + 1d` | Post-event follow-up + (for public guests) membership CTA |

**Blocked on:** Q15 (cadence acceptable?) and Q15 sub-question (post-event membership CTA?).

### W4 — Membership approval routing (blocked on Q8)

**Trigger:** `membership/application-submitted` event.

**If Q8 answer = auto-grant on payment:**
- Direct path: payment success → Supabase Auth invite → welcome email → HubSpot deal advance.

**If Q8 answer = manual approval (recommended):**
- Hold path: status `awaiting_approval` → admin clicks Approve → fire `membership/approved` → continue.

**Blocked on:** Q8.

### W5 — Bid → confirmation email migration (no client block; infrastructure refactor)

Today, the public booking funnel calls `getEmailService().send({...})` directly inline. Migrating to Inngest:

- Server Action commits the bid to DB
- Fires `bid/created` event after commit (not inside the transaction)
- Inngest function subscribes, sends confirmation, retries on failure

Win: bid creation no longer blocks on email render + send. Email failures become Inngest-visible retries rather than caller-logged warnings.

**Blocked on:** nothing. Scheduled for sub-phase 9.2 once the firing pattern is settled.

### W6 — HubSpot deal sync (blocked on HubSpot account access)

**Trigger:** various lifecycle events.

**Each event** maps to a HubSpot deal pipeline stage transition:

| Event | HubSpot action |
|---|---|
| `bid/created` | Create deal, stage = `inquiry` |
| `bid/confirmed` | Advance to `bid_sent` |
| `bid/signed` | Advance to `signed` |
| `bid/deposit-paid` | Advance to `deposit_paid` |
| `booking/confirmed` | Advance to `booked` |
| `membership/approved` | Advance member-pipeline deal to `member_won` |

**Blocked on:** HubSpot account credentials (Private App access token) + pipeline shape (do existing HubSpot pipeline stages match what we want, or does the system define them?). Not strictly a Q1–Q16 question, but a client account question.

---

## Sub-phase plan

### Sub-phase 9.1 — Scaffold (✅ DONE 2026-05-24)

- Install `inngest@4.5.0`
- `lib/inngest/client.ts`, `events.ts`, `functions/`
- `app/api/inngest/route.ts`
- `.env.example` documentation
- This plan doc

### Sub-phase 9.2 — Event firing wiring (no client block)

- Add `inngest.send(...)` calls inside existing Server Actions and webhook
  handlers after their DB commits succeed.
- Pattern: `await commit; await inngest.send(...);` (NOT inside the
  transaction — phantom workflows on rollback).
- One event at a time. Verify each with the local Inngest dev server.

**Lost-event window.** `inngest.send()` retries transient HTTP failures
internally (built-in backoff), so most ephemeral network blips are
absorbed. What it cannot recover from is the process dying between
`await commit` and the send completing — Vercel cold-start kill, OOM,
500ms before timeout. For non-critical events (confirmation email,
HubSpot stage advance) this is acceptable; the worst case is a missed
email and we have admin tools to resend. For events that gate billable
state transitions (`bid/deposit-paid` from Stripe webhook, `bid/signed`
from Dropbox Sign webhook) the upstream webhook will retry on non-2xx,
so as long as the route returns non-2xx whenever the send fails the
provider replay covers us. The route handlers must therefore `await`
the send (not fire-and-forget) and let any throw surface as a 5xx.
An outbox table is overkill for current volume; revisit if event-loss
incidents materialise.

Events to wire (priority order):

1. `bid/created` — from `src/services/public/create-bid.ts`
2. `bid/confirmed` — from admin `confirmBid` Server Action
3. `bid/signed` — from `app/api/webhooks/dropbox-sign/route.ts`
4. `bid/deposit-paid` — from `app/api/webhooks/stripe/route.ts`
5. `booking/confirmed` — from the bid finalization trigger (fired when
   both `signed_at` and `paid_at` are set)

### Sub-phase 9.3 — W5 migration (no client block)

Migrate the existing booking-confirmation email send into an Inngest
function subscribing to `bid/created`. Existing inline send removed.
End-to-end test: a bid creates → email lands → bid_email_log row.

### Sub-phase 9.4+ — Workflow bodies (blocked per Q answers)

Each W1–W6 becomes a sub-phase once its blocking question is answered.

---

## Local dev workflow

```bash
# .env.local — required for Inngest 4.x dev mode
INNGEST_DEV=1

# Terminal 1
npm run dev

# Terminal 2
npx inngest-cli@latest dev
```

The dev server (port 8288 by default) auto-discovers `localhost:3000/api/inngest`. Fire test events from its UI; see runs, step output, and retries inline. `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` stay blank locally — `INNGEST_DEV=1` is the only flag that matters and it makes the client skip both checks.

---

## Production setup (one-time, when first workflow goes live)

1. Create Inngest account at https://inngest.com — sign up with email.
2. Create new app in dashboard, name it `rhythm-outdoors` (matches `lib/inngest/client.ts` `id`).
3. Add the production deployment URL: `https://rhytm-one.vercel.app/api/inngest`.
4. Generate Event Key (Manage → Event Keys) → set as `INNGEST_EVENT_KEY` in Vercel.
5. Generate Signing Key (Manage → Signing Key) → set as `INNGEST_SIGNING_KEY` in Vercel.
6. Redeploy.
7. Click "Sync App" in the Inngest dashboard. It hits the `/api/inngest` PUT endpoint and discovers the function list.

---

## Test pack (post-9.2 wiring)

| # | Scenario |
|---|---|
| I1 | Local `inngest-cli dev` running; trigger a public booking → `bid/created` fires; `on-bid-created` logs in the Inngest UI |
| I2 | Vercel preview with `INNGEST_*` keys set; same as I1 but the event lands on the Inngest cloud dashboard |
| I3 | Fire `bid/created` manually via Inngest UI with stub payload → log appears |
| I4 | (Once W5 lands) Disable email transport → Inngest function fails → retries visible in dashboard |
| I5 | (Once W1 lands with Q7 answered) Create a bid, wait the configured period, no signature → bid auto-expires |

---

## Decisions locked in

| # | Decision | Choice |
|---|---|---|
| 1 | App id | `rhythm-outdoors`. Changing later orphans run history. |
| 2 | Functions directory | `lib/inngest/functions/<event-name>.ts` (kebab-case). One function per file. |
| 3 | Event naming | `<resource>/<lifecycle-verb>` (`bid/created`, `booking/confirmed`). Slash-separated; past-tense verb. |
| 4 | Firing pattern | `inngest.send()` AFTER successful DB commit, NOT inside transactions. Caller awaits the send to surface auth errors but treats delivery failures as best-effort (Inngest retries). |
| 5 | Idempotency | Inngest dedupes by event id; we pass an explicit `id` on send when the trigger has a stable key (e.g., `bid-${bidId}-created`). |
| 6 | Production deploy URL | `https://rhytm-one.vercel.app/api/inngest`. Change when domain moves. |

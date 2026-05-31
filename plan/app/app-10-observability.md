# App 10 — Observability (Implementation Plan)

**Status:** ⏸ Deferred to pre-1.0 launch (deliberate, not blocked) · **Drafted:** 2026-05-30

> **Why deferred** (decision 2026-05-30): observability's value scales with real traffic + ongoing development. Pre-launch, errors are findable by grepping Vercel logs — there's no user volume to triage. Some sub-phases (10.4 Axiom event vocabulary, 10.5 alert thresholds) are feature-coupled and would churn if client feedback reshapes the funnel or lifecycle events. Pick this up immediately before 1.0 launch — that's the moment Sentry + Axiom start paying for themselves. Trigger: real customers about to start using the app.

Two products, two jobs:

- **Sentry** — error tracking + traces. Catches exceptions thrown anywhere in the stack (Server Components, Server Actions, Route Handlers, Inngest functions, webhook handlers, client React) and groups them into issues with stack traces, breadcrumbs, and request context. Primary purpose: "something crashed in prod — what was it, who hit it, when did it start?"
- **Axiom** — structured logs + custom events + metrics. Receives every `console.log` from Vercel via the log drain, and accepts purpose-shaped event sends from app code (`booking_funnel_step`, `payment_intent_succeeded_processed`, etc.). Primary purpose: "show me everyone who hit the deposit step in the last hour" / "how many bids were created today" / "what was the error rate on the Dropbox Sign webhook?".

The two are complementary — Sentry is the "something broke" surface, Axiom is the "what happened" surface. We're not picking one or the other; we want both.

---

## Scope

In scope for App 10:

- Sentry SDK installation + initialization for all three Next.js runtimes (Node server, Edge, Browser)
- Source map upload at build time so production stack traces map back to readable source
- Error capture in all critical paths: Server Actions, Route Handlers, webhook handlers (Stripe, Dropbox Sign), Inngest functions
- Trace propagation across Server Component → Server Action → Supabase round-trip → Inngest event send (best-effort — Sentry's Next.js auto-instrumentation handles most of it)
- Filtering rules (`beforeSend`) so expected validation errors don't drown out real issues
- Axiom log drain from Vercel (dashboard integration — no app code)
- Axiom structured event sends for the key lifecycle moments (bid created, signed, paid, finalized; membership applied/approved; webhook processed/skipped)
- A baseline dashboard pack in Axiom: bid funnel conversion, webhook success rate, email send result

Out of scope:

- **Session Replay** (Sentry's paid feature). Defer until prod traffic justifies it.
- **OpenTelemetry to a third backend** — Sentry handles traces; Axiom handles logs/events. Don't introduce a third trace store.
- **PagerDuty / SMS alert routing.** Sentry's email + Slack notifiers are enough until we have an on-call rotation.
- **Custom dashboards beyond a baseline.** Real dashboards come from real traffic patterns; pre-launch we'd be guessing.
- **Performance budget enforcement in CI.** Sentry's release tracking surfaces regressions; we don't need a CI gate yet.

---

## Why these two, not alternatives

- **Datadog / New Relic.** Heavyweight + expensive for a single Next.js + Supabase stack at our volume. Sentry + Axiom cover errors, logs, and metrics at a fraction of the cost and complexity.
- **Vercel Analytics alone.** Page-view + Web Vitals only. No exception capture, no custom events, no log search. Complementary, not a substitute (and we keep it — it's free + zero-config).
- **`console.log` + Vercel logs alone.** What we have today. Logs scroll past; no aggregation, no search by user/booking, no graph of "is this rate going up?". Axiom fixes that without us changing logging style much.
- **Supabase logs.** Useful for raw Postgres + Auth events; not a substitute for app-level observability. Sentry + Axiom sit on top.

---

## Decisions locked in

| # | Decision | Choice |
|---|---|---|
| 1 | Sentry org/project naming | Org slug `rhythm-outdoors`. One Next.js project covering all three portals + Inngest + webhooks; don't split per route. Matches the Inngest app id pattern. |
| 2 | DSN env var | `NEXT_PUBLIC_SENTRY_DSN`. The Next.js convention is one DSN reused client + server + edge — the SDK picks the right transport per runtime. Public-prefixed because the browser bundle needs it; that's expected by Sentry's threat model (DSNs are not secrets — they're write-only ingest endpoints). |
| 3 | Init mechanism | `instrumentation.ts` at repo root. Next.js 13+ hook that fires once per runtime (Node, Edge). Inside, branch on `process.env.NEXT_RUNTIME` and `await import()` the right `@sentry/nextjs` entry. This is the App-Router-correct way per Next 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/instrumentation.md`). |
| 4 | Source maps | Use `withSentryConfig()` wrapper in `next.config.ts`. Uploads at `vercel build` via the Sentry webpack plugin. Requires `SENTRY_AUTH_TOKEN` in Vercel build env (NOT runtime). Source maps are NOT exposed publicly — uploaded to Sentry only. |
| 5 | Release tracking | Sentry release = `git rev-parse HEAD` (short sha) at build time. Auto-detected by `withSentryConfig`. Lets errors group per deploy. |
| 6 | Sample rates | `tracesSampleRate: 0.2` (20% of requests get full spans — Sentry's low-volume default). Errors are always captured (sample rate 1.0). Revisit if Sentry quota tightens. |
| 7 | `beforeSend` filter | Drop Zod parse failures from the booking funnel (those are user input errors, not system errors). Drop `NEXT_REDIRECT` / `NEXT_NOT_FOUND` synthetic throws (Next.js uses errors as control flow for these). |
| 8 | Inngest error capture | Wrap each `step.run` body in a try/catch that calls `Sentry.captureException` with the step id + event id as tags before re-throwing. Inngest retries on the throw; Sentry sees every failed attempt with the right grouping. |
| 9 | Axiom dataset name | `rhythm-outdoors`. Single dataset for now; revisit splitting by surface (app / webhooks / inngest) once we see volume + query patterns. |
| 10 | Vercel → Axiom log drain | Wired in the Vercel dashboard (Integrations marketplace → Axiom). No app code or env vars needed for the basic drain — every `console.*` from Vercel hits Axiom automatically. |
| 11 | Axiom event sends | `@axiomhq/js` from server-only paths. Wrapper in `lib/observability/axiom.ts` exposes a typed `track(eventName, fields)` so call sites don't import the SDK directly. Best-effort (`after()`), never blocks the request. |
| 12 | Logger format | Structured JSON via a thin wrapper around `console.log` (`lib/observability/logger.ts`). Fields: `level`, `message`, `requestId`, `userId?`, plus arbitrary `context`. Vercel's log drain ships this JSON straight into Axiom searchable fields. |
| 13 | PII handling | Sentry: `sendDefaultPii: false`. Axiom events: never include raw email / phone / payment card; reference by id (`bidId`, `bookingId`). Stack traces may incidentally contain query params — accept this risk; alternative is filtering every breadcrumb which costs more than it saves. |

---

## Sub-phases

### Sub-phase 10.1 — Sentry baseline

**Goal:** every uncaught exception in production becomes a Sentry issue with a readable stack trace, request context, and a deploy-tagged release.

Steps:

1. `npm install @sentry/nextjs` (latest matching Next 16).
2. `npx @sentry/wizard@latest -i nextjs` — runs once to generate `sentry.{client,server,edge}.config.ts` + the `withSentryConfig` wiring in `next.config.ts`. Review every generated file before committing; the wizard tends to add comments + defaults we'll prune.
3. Create the Sentry project at sentry.io (org slug `rhythm-outdoors`, project `nextjs`). Copy the DSN.
4. Add to `.env.example`: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (build-time only — annotate "do not set in runtime envs"), `SENTRY_ORG`, `SENTRY_PROJECT`.
5. Add to `.env.local`: same vars (auth token from `https://sentry.io/settings/account/api/auth-tokens/`).
6. Move/replace the wizard-generated `sentry.*.config.ts` files with a single `instrumentation.ts` at repo root + a `instrumentation-client.ts` (per Next 16 conventions). Server + Edge get one branch each inside `register()` using `await import("@sentry/nextjs")`.
7. Configure `Sentry.init({ dsn, tracesSampleRate: 0.2, sendDefaultPii: false, beforeSend: ... })` with the filter rules from decision #7.
8. Wire Sentry to Vercel: `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in Vercel "Build" environment scope (NOT runtime). `NEXT_PUBLIC_SENTRY_DSN` in all envs.
9. Deploy. Trigger a deliberate error from a throwaway route (`app/api/_sentry-test/route.ts` that throws). Verify the issue lands in Sentry with a source-mapped stack trace pointing at the right line in `app/api/_sentry-test/route.ts`. Delete the test route.
10. Document in `docs/observability.md` (new file): how to read a Sentry issue, how to assign + resolve, who gets notified.

**Verification:**

- Source maps work (issue's stack trace shows `src/services/bookings/create-public-booking.ts:140`, not `chunks/12345.js:1:50000`).
- Release tag matches the deploy's git sha.
- A Server Action throw is captured.
- A Route Handler throw is captured.
- A Server Component throw is captured (the error.tsx boundary catches it but Sentry sees it first).
- A client-side throw is captured (open devtools, run `throw new Error("client test")` in console).

### Sub-phase 10.2 — Sentry depth

**Goal:** errors from the highest-stakes surfaces (Inngest functions, Stripe / Dropbox Sign webhooks) carry enough context that triage doesn't need a database lookup to understand what happened.

Steps:

1. Add a small wrapper in `lib/observability/sentry.ts`: `captureWithContext(err, tags, extras)`. Centralizes the tag shape (`source`, `bidId`, `bookingId`, `eventName`).
2. Wrap each `step.run(...)` body in Inngest functions to capture step-level failures with the event payload as `extras` and step id + event id as `tags`. Re-throw so Inngest retries. Apply this pattern in all functions in `lib/inngest/functions/`.
3. Wrap the Stripe webhook handler (`app/api/webhooks/stripe/route.ts`) — any exception captures with the Stripe event id + type as tags before the 5xx escapes to Stripe.
4. Same for Dropbox Sign webhook (`app/api/webhooks/dropbox-sign/route.ts`).
5. Add a Sentry tag-by-portal middleware shim so issues from `/admin`, `/member`, `/partner`, `/(public)` are filterable in the Sentry UI.
6. Add to `beforeSend`: ignore `AbortError` (browser navigations cancel fetches all the time — not actionable).

**Verification:**

- Force a known Inngest function failure (set `INNGEST_DEV=1`, throw inside the `send` step). Verify Sentry issue has `step=send`, `eventName=bid/created`, `bidId=<id>` tags.
- Force a Stripe webhook 5xx (return a 500 manually for one event). Verify the issue carries the Stripe `event.id` + `event.type`.

### Sub-phase 10.3 — Axiom logs + log drain

**Goal:** every `console.*` from Vercel lands in Axiom, indexed and searchable. Existing log call sites don't change shape (we won't grep-replace `console.log` for a custom logger across the codebase).

Steps:

1. Create Axiom account → workspace → dataset `rhythm-outdoors`. Copy the API token (read+ingest scope).
2. Wire the Vercel → Axiom integration (Vercel dashboard → Integrations marketplace → Axiom). Pick the `rhythm-outdoors` Vercel project + the `rhythm-outdoors` Axiom dataset. Verify a `console.log` from any route shows up in Axiom within ~30s.
3. Add `lib/observability/logger.ts` — a thin wrapper that emits structured JSON via `console.log` (Vercel + Axiom both parse JSON log lines into searchable fields). Shape: `{level, ts, msg, ctx}`. Re-export `log.info`, `log.warn`, `log.error`. Don't enforce migration of existing `console.error` call sites — those still work; the wrapper is for new code.
4. Document the log shape + Axiom query basics in `docs/observability.md`.

**Verification:**

- A `log.info("test", { ctx: { bidId: "abc" } })` call from a deployed route shows up in Axiom with `ctx.bidId = "abc"` as a queryable field.
- A `console.error(...)` from existing code (e.g., the `bid/created` send failure path) still lands in Axiom (no migration needed).

### Sub-phase 10.4 — Axiom events + baseline dashboards

**Goal:** key lifecycle moments emit structured events to Axiom regardless of whether they also produced a log line. Enables "funnel" + "rate" + "error budget" queries that raw logs can't easily support.

Steps:

1. `npm install @axiomhq/js`.
2. Create `lib/observability/axiom.ts`: `track(eventName, fields)` — thin wrapper around `@axiomhq/js` `ingest(dataset, [event])`. Best-effort (fire from `after()` where applicable); failure logs to `console.warn` and returns.
3. Define the event vocabulary in `lib/observability/events.ts` — TypeScript const map of `eventName → fields shape`. Examples:
   - `booking.funnel_step_reached` — fields: `step`, `propertySlug`, `bookingType`, `sessionId`
   - `bid.created` — fields: `bidId`, `bookingId`, `propertySlug`, `estimatedPrice`
   - `bid.confirmed` — fields: `bidId`, `confirmedByStaffId`
   - `bid.signed` — fields: `bidId`, `signedAt`
   - `bid.deposit_paid` — fields: `bidId`, `amountPaidCents`
   - `webhook.received` — fields: `provider`, `eventType`, `processed` (bool), `skipReason?`
   - `email.sent` — fields: `template`, `transport`, `to` (hashed), `ok`, `error?`
4. Wire `track(...)` calls from the relevant fire points. Many overlap with where Inngest events already fire — the Axiom track and Inngest send happen side-by-side (Inngest = workflow trigger; Axiom = analytics breadcrumb). Different audiences.
5. Build three baseline Axiom dashboards:
   - **Bid funnel**: count per `booking.funnel_step_reached` step + drop-off between adjacent steps
   - **Webhook health**: rate of `webhook.received` by provider × `processed` true/false, with skipReason breakdown
   - **Email pipeline**: count of `email.sent` by transport + ok, with error rate over time

**Verification:**

- Walk a public booking through. Each funnel step generates a `booking.funnel_step_reached` event in Axiom.
- Run a Stripe webhook. A `webhook.received` event appears with `provider=stripe`, `processed=true`.
- Send a confirmation email. An `email.sent` event appears with `transport=logging` (dev) or `transport=resend` (prod), `ok=true`.
- All three baseline dashboards render with non-empty data.

### Sub-phase 10.5 — Alerting

**Goal:** the right human gets paged when a high-impact failure pattern emerges. Light touch — email + Slack, no on-call rotation.

Steps:

1. Sentry alerts:
   - "New issue created in production" → Slack `#rhythm-alerts` (high signal, low volume)
   - "Issue regressed" → Slack `#rhythm-alerts`
   - "Webhook error rate > 5% over 15 min" → email
2. Axiom alerts:
   - "No `bid.created` events in 1 hour during business hours" → email (likely outage)
   - "`webhook.received` with `processed=false` count > 10 in 5 min" → Slack
3. Document the alert taxonomy + acknowledgment expectations in `docs/observability.md`.

**Verification:**

- Force a new issue in Sentry → Slack notification fires.
- Force a `bid.created` gap (don't book for an hour during the alert window) → email fires.

---

## Env vars

| Var | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | All envs (build + runtime) | yes | Sentry ingest endpoint. Public is correct (DSNs are not secrets). |
| `SENTRY_AUTH_TOKEN` | Build only (Vercel "Build" scope) | yes | Source map upload at build time. **Must not be set in runtime envs.** |
| `SENTRY_ORG` | Build only | yes | Sentry org slug (`rhythm-outdoors`). |
| `SENTRY_PROJECT` | Build only | yes | Sentry project slug (`nextjs`). |
| `AXIOM_TOKEN` | Runtime (server-only) | yes | API token for `@axiomhq/js` event sends. Ingest scope only. |
| `AXIOM_DATASET` | Runtime (server-only) | yes | Dataset name (`rhythm-outdoors`). |

---

## File layout

### New files

```
instrumentation.ts                       Sentry Node + Edge init (10.1)
instrumentation-client.ts                Sentry Browser init (10.1)
lib/observability/
  sentry.ts                              captureWithContext wrapper (10.2)
  logger.ts                              structured JSON logger (10.3)
  axiom.ts                               track() event wrapper (10.4)
  events.ts                              event vocabulary const map (10.4)
docs/observability.md                    runbook: read Sentry issue, query Axiom, alert taxonomy (10.1+)
```

### Modified files

```
next.config.ts                           wrapped with withSentryConfig() (10.1)
.env.example                             Sentry + Axiom vars documented (10.1, 10.3)
lib/inngest/functions/*.ts               each step.run wrapped with captureWithContext (10.2)
app/api/webhooks/stripe/route.ts         exception capture with event id tags (10.2)
app/api/webhooks/dropbox-sign/route.ts   same (10.2)
src/services/bookings/create-public-booking.ts    bid.created track() call
src/services/admin/transition-bid.ts     bid.confirmed track() call
src/services/dropbox-sign/handle-signature-event.ts    bid.signed track() call
src/services/stripe/handle-payment-intent-succeeded.ts bid.deposit_paid track() call
```

---

## Edge cases folded into the implementation

- **Sentry double-init in App Router.** Each runtime (Node, Edge, Browser) needs its own `Sentry.init`. The `instrumentation.ts` hook fires once per cold start per runtime; the `instrumentation-client.ts` fires once per browser session. Don't initialize Sentry from a Server Component or a Server Action — those run on already-initialized Node.
- **Source maps + Vercel build cache.** Cached builds skip source map upload. Force a fresh upload via the Sentry release id in the build env (`SENTRY_RELEASE=$(git rev-parse HEAD)`). Sentry's webpack plugin handles this automatically when `SENTRY_AUTH_TOKEN` is present.
- **`NEXT_REDIRECT` / `NEXT_NOT_FOUND`.** Next.js throws these as synthetic errors to short-circuit rendering. Filtering them in `beforeSend` is essential or Sentry fills with garbage. Check `err.digest === "NEXT_REDIRECT"`.
- **Axiom dataset region.** The `@axiomhq/js` client defaults to US ingest. If we ever provision Axiom in EU, override `url` in the client config.
- **Log drain duplication.** Both the Axiom client (`track`) and the Vercel log drain send to Axiom. The drain is logs (text/JSON via stdout); the client is structured events with a `dataset` of our choosing. Keep them in different datasets if cross-talk becomes confusing — current decision is single dataset, namespaced via the `_source` field the drain adds automatically.

---

## Test pack (post-10.1 — O series)

| # | Scenario | Surface |
|---|---|---|
| O1 | Deliberate throw from a Server Action lands in Sentry with mapped stack trace | Sentry |
| O2 | A Route Handler 500 lands with request context (URL, headers minus auth) | Sentry |
| O3 | A client-side `throw` from devtools lands with browser context | Sentry |
| O4 | An Inngest function failure shows step id + event id tags + event payload extras | Sentry |
| O5 | A Stripe webhook 5xx carries the Stripe event id + type as tags | Sentry |
| O6 | A `console.error` from a deployed Route Handler appears in Axiom within 30s | Axiom (log drain) |
| O7 | A `log.info("test", { ctx: ... })` shows `ctx.*` as searchable fields | Axiom (logger) |
| O8 | Walking the booking funnel produces one `booking.funnel_step_reached` per step | Axiom (events) |
| O9 | The bid funnel dashboard renders non-empty data with expected step ordering | Axiom (dashboard) |
| O10 | A Sentry "new issue" alert fires into Slack `#rhythm-alerts` | Sentry → Slack |
| O11 | An Axiom "no bid.created in 1h" alert fires by email when intentionally idled | Axiom → email |

---

## Open questions / risks

- **Sentry free tier ceiling.** 5k errors/month + 10k spans/month on the free tier. We'll exceed spans easily if `tracesSampleRate=0.2` on Vercel cold starts. Mitigation: lower sample to 0.05 once we know baseline traffic, or upgrade to Team ($26/mo).
- **Axiom free tier ceiling.** 500 GB ingest/month, 30-day retention. Vercel log drain volume is the unknown — verify after 10.3 lands and adjust. Marketing-style noisy `console.log` calls should be cleaned up regardless.
- **Slack channel exists.** `#rhythm-alerts` is assumed. Confirm with client (or pick a different channel name) before 10.5.
- **PII in stack traces / breadcrumbs.** `sendDefaultPii: false` plus the `beforeSend` filter handle the common cases. A `dataScrubber` pass is heavier but available if a real incident surfaces a leak.
- **Source map exposure.** `hideSourceMaps: true` in `withSentryConfig` keeps `.map` files out of the public bundle while still uploading them to Sentry. Verify in the deployed assets.
- **Replay (deferred).** Sentry's Session Replay is a paid tier feature + adds ~30 KB to the browser bundle. Defer until the support team asks for it.

---

## Suggested ordering

10.1 is the only path that's fully unblocked today. 10.2 + 10.3 + 10.4 can land in any order after 10.1 — they're independent surfaces. 10.5 needs at least one of 10.2 / 10.4 in place (no signal to alert on otherwise).

A pragmatic single-session sequence: **10.1 → 10.3 → 10.2 → 10.4 → 10.5**. Reasoning: 10.3 (log drain) is dashboard-only, zero risk, gets visibility on existing logs immediately. Then 10.2 deepens Sentry where it matters most (Inngest + webhooks). Then 10.4 adds the analytics layer. Then 10.5 wires the alerts that depend on the data being there.

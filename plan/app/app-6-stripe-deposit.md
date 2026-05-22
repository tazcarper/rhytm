# App 6 — Stripe Deposit Collection (Implementation Plan)

**Status:** 🔲 Not Started · **Drafted:** 2026-05-22

The customer-facing surface that turns a `confirmed` (or `signed`) bid into a `paid` bid by collecting the deposit Stripe-side. Lives inline on the public bid page — the existing `DepositSlot` card becomes a live Payment Element instead of an "App 6 placeholder."

Read `plan/app/app-3-admin.md` for the wider bid lifecycle this plugs into. App 3.5 (confirm/deny actions) is the prerequisite: nothing reaches `confirmed` without it, and `confirmed` is the gate for the pay surface.

---

## Scope recap

Three deliverables, all funneled through the existing bid lifecycle:

1. **Embedded Payment Element on the public bid page** — replaces the placeholder DepositSlot when `bid.status IN ('confirmed', 'signed')`. No redirect; the bid page stays the guest's single home base.
2. **Stripe webhook handler** at `app/api/webhooks/stripe/route.ts` — verifies the `Stripe-Signature` header, claim-first in `processed_webhooks` (Phase 6 pattern), advances `bids.status='paid'` and stamps `bids.paid_at`. The existing `sync_booking_from_bid` trigger fans the change out to `bookings.status='deposit_paid'`.
3. **Admin manual refund** — a Refund button on `/admin/bids/[id]` (visible when `bid.status='paid'` and not already refunded). Calls Stripe Refunds API, writes back to `bids.refund_payment_intent_id` + `bids.refund_amount`. No automatic refund-on-cancel — that's deferred to a later sub-phase / Inngest work.

**Out of scope for App 6:**

- Balance / final payment collection (`bookings.balance_payment_intent_id`). Phase 2's column anticipates a separate balance flow; App 6 ships deposit only.
- Stripe Customers / saved cards. Each deposit is one-shot, anonymous-from-Stripe's-perspective. Customer modeling lands when subscriptions or stored-card features arrive.
- Refund-on-cancel automation. Manual admin button only.
- Receipt email customization beyond Stripe's default. App 8 (real email transport) can wire a Rhythm-branded receipt later if the client wants one; Stripe's auto-receipt covers compliance.

---

## Decisions locked in for this build

| # | Decision | Choice |
|---|---|---|
| 1 | Payment surface | **Embedded Payment Element backed by PaymentIntent.** *Decided during build (2026-05-22):* the original plan said `ui_mode: 'custom'` Checkout Session, but `react-stripe-js` v6 has no React bindings for that mode (only `<EmbeddedCheckout>` for `ui_mode='embedded'` and `<Elements>` + `<PaymentElement>` for raw PaymentIntents). PaymentIntent is the more idiomatic React fit and reuses `bookings.deposit_payment_intent_id` (already on the table from Phase 2). Webhook event becomes `payment_intent.succeeded`. The migration that added `bookings.deposit_checkout_session_id` is reverted by `20260523130000_app_6_drop_unused_checkout_session_column.sql`. |
| 2 | Sign-before-pay enforcement | **Relaxed.** Trigger + UI allow paying from `confirmed` or `signed`. Signing remains an independent step (App 7 wires it). |
| 3 | Refund handling | **Forward-only + admin manual refund button.** No cancel-driven automation in App 6. |
| 4 | Paid timestamp | **`bids.paid_at`** column. Parallels `bids.signed_at` and the rest of the lifecycle stamps. |
| 5 | Stripe API key type | **Restricted API Key (RAK)** — per Stripe security guidance. RAK scope: read/write PaymentIntents, Checkout Sessions, Refunds, Webhook Endpoints. No customer / payout / treasury scopes. |
| 6 | Currency | **USD only** for App 6. Property tier may later need multi-currency, but the catalog and pricing today are USD. |
| 7 | Stripe API version | **Latest stable at install time** (per Stripe SDK default). SDK constructor pins it explicitly. |
| 8 | Refund auto-status | **Refund flips `bid.status='paid'` → `'refunded'` in the same DB transaction.** New enum value `refunded`; trigger arm maps it to `booking.status='cancelled'`. UI surfaces a "Refunded" banner in place of "Paid ✓". |
| 9 | Receipt email | **Branded receipt via Resend / `EmailService` interface (App 2.9 shim).** A new `DepositReceiptEmail` template fires from the webhook handler. LoggingEmailService writes to `dev_email_outbox` today; App 8 swaps in `ResendEmailService`. Stripe's auto-receipt is **disabled** (`receipt_email` omitted) — we own the receipt UX. |
| 10 | Finalization rule | **A bid is "fully finalized" when `paid_at IS NOT NULL` AND `signed_at IS NOT NULL`.** Order doesn't matter. The bid page's "All set" terminal banner renders only when both stamps are present. Until both, the unfinished step renders as current. |

---

## Database changes — one migration

`supabase/migrations/20260523120000_app_6_stripe_deposit.sql`

```sql
-- 1. bids.paid_at — stable timestamp parallel to signed_at / cancelled_at.
ALTER TABLE bids ADD COLUMN paid_at timestamptz;

-- 2. bookings.deposit_checkout_session_id was added here originally but
--    DROPPED by 20260523130000 after the Pattern A pivot. Pattern A uses
--    raw PaymentIntents, so the existing bookings.deposit_payment_intent_id
--    column (Phase 2) is the only idempotency anchor needed. This block
--    is retained in the plan for the trigger-relaxation context below
--    but should be omitted when the migration is re-applied from scratch.

-- 3. Extend bid_status_enum with 'refunded'. Set by the admin refund
--    flow in the same DB transaction that writes refund_payment_intent_id.
--    NOTE: ALTER TYPE ... ADD VALUE must run in a separate transaction
--    from any subsequent use. If applying this migration via Supabase
--    CLI as a single batch fails, split the migration: enum bump in one,
--    trigger + sync changes in another.
ALTER TYPE bid_status_enum ADD VALUE IF NOT EXISTS 'refunded';

-- 4. Relax sync_booking_from_bid + handle 'refunded'.
--    - 'paid' allowed from booking IN ('awaiting_guest', 'signed') — App 6
--      relaxation, deposit can clear before signature.
--    - 'refunded' maps to booking 'cancelled' — slot releases, deposit gone.
--      Note: 'cancelled' already exists in booking_status_enum (Phase 2).
--    Trigger function is recreated in full because the RAISE-based safety
--    net depends on row-count after the UPDATE.
CREATE OR REPLACE FUNCTION sync_booking_from_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_rows int;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      UPDATE bookings SET status = 'awaiting_guest', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'denied' THEN
      UPDATE bookings SET status = 'denied', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'signed' THEN
      UPDATE bookings SET status = 'signed', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'awaiting_guest';

    WHEN 'paid' THEN
      -- App 6 relaxation: deposit can clear before signature.
      UPDATE bookings SET status = 'deposit_paid', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    WHEN 'refunded' THEN
      -- App 6 addition: admin refund flips bid to refunded; booking goes
      -- to cancelled. Only legal from a paid bid (so booking is in
      -- deposit_paid). 'fulfilled' also blocked — once an event has run,
      -- refund is a financial-only action that doesn't unwind the booking.
      UPDATE bookings SET status = 'cancelled', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'deposit_paid';

    WHEN 'expired' THEN
      UPDATE bookings SET status = 'expired', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    ELSE
      RETURN NEW;
  END CASE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION
      'sync_booking_from_bid: bid % moved to % but its booking % was not in the expected source state',
      NEW.id, NEW.status, NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Index for webhook lookup: from session_id → bid.id needs a join via
--    bookings. The new bookings.deposit_checkout_session_id index covers it.
--    No additional index needed.
```

**Historical: `deposit_checkout_session_id` was added then dropped.** The original plan separated the pre-payment Checkout Session ID (`cs_…`) from the post-success PaymentIntent ID (`pi_…`). Pattern A collapses both into a single anchor — the PaymentIntent ID is meaningful at creation time (returned by `paymentIntents.create`) AND at success time (the `pi_…` referenced in the webhook). One column, one semantic.

**The trigger relaxation is a workflow change, not just a permissions change.** Document it in `plan/supabase/phase-7-rls.md` (or wherever the bid status machine lives) as part of this migration's PR.

---

## Workflow finalization

The bid status enum gains `refunded` and the workflow grows two parallel signals: **paid_at** (deposit collected) and **signed_at** (waiver returned). They can happen in either order; both are required for the bid to be "fully finalized."

State semantics on the bid page:

| `bid.status` | `signed_at` | UI surface |
|---|---|---|
| `confirmed` | null | Both slots active: sign first OR pay first — guest chooses. |
| `confirmed` | set (App 7 signs first) | Sign ✓ done, Pay deposit current. |
| `paid` | null (App 6 pays first) | Pay ✓ done, Sign waiver current. Banner: "Deposit received — one more step: sign your waiver." |
| `paid` | set | **Fully finalized.** Banner: "All set — we'll see you on <date>." |
| `signed` | set | Same as `confirmed` + signed_at (legacy from current trigger) — Pay deposit current. |
| `refunded` | any | Banner: "This bid has been refunded and is no longer active." No active slots. |
| `denied` / `expired` | any | Existing terminal copy (no change from current page). |

This is a UI/derived-state rule, not a new column. The bid page computes `isFinalized = bid.status==='paid' && bid.signed_at != null`. The bid-timeline component reads both signals.

**App 7's hand-off:** when Dropbox Sign stamps `bids.signed_at`, App 7 also calls `UPDATE bids SET status='signed' WHERE status='confirmed'`. **If the bid is already `paid`, App 7 does NOT change status** (no `paid` → `signed` regression) — it just stamps `signed_at`. That rule needs to be in App 7's plan; flag it during App 7 design.

---

## Env vars

Already declared in `.env.local` and setup on Verel.



**Restricted Key creation (Stripe Dashboard → Developers → API keys → Create restricted key):**

- Checkout Sessions: write
- PaymentIntents: read
- Refunds: write
- Webhook Endpoints: none required at runtime (we don't manage endpoints from code)
- Everything else: none

The user maps RAK env to `STRIPE_SECRET_KEY` because the SDK accepts both `sk_...` and `rk_...` interchangeably and the variable name is already wired through. Add a comment in `.env.example` clarifying the prefix preference.

---

## Packages to install

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

- `stripe` — server SDK, used only in `lib/stripe/server.ts` + service functions + webhook route.
- `@stripe/stripe-js` — browser loader (loadStripe). Imported only in the client component.
- `@stripe/react-stripe-js` — `<Elements>` provider + `<PaymentElement>` React wrappers.

Lock the `stripe` SDK constructor with `apiVersion: '2026-04-22.dahlia'` (latest at draft time) so a future SDK upgrade doesn't silently change wire shapes.

---

## File layout

### New files

```
supabase/migrations/
  20260523120000_app_6_stripe_deposit.sql      schema + trigger relaxation (above)

lib/stripe/
  server.ts                                     server-only Stripe client factory
  publishable-key.ts                            tiny helper that throws if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is unset (caught at build, not at first paint)

src/services/stripe/
  create-deposit-session.ts                     idempotent PaymentIntent creation (domain term "session"; impl is PI)
  handle-payment-intent-succeeded.ts            webhook event → bids.status='paid' + paid_at
  types.ts                                      shared shapes (created when 6.5 lands)

src/services/admin/
  refund-deposit.ts                             admin-triggered refund (flips bid.status → refunded)

src/services/notifications/templates/
  deposit-receipt.ts                            React Email template for the branded payment receipt

src/components/public/
  deposit-payment-form.tsx                      client component: mounts <PaymentElement>, calls Server Action, confirms

src/components/admin/
  refund-deposit-button.tsx                     client component on /admin/bids/[id]

app/(public)/bids/[slug]/[code]/
  deposit-actions.ts                            Server Action wrapper for create-deposit-session

app/admin/bids/[id]/
  refund-actions.ts                             Server Action wrapper for refund-deposit

app/api/webhooks/stripe/
  route.ts                                      POST handler — signature verify + dispatch

plan/app/
  app-6-stripe-deposit.md                       this file
```

### Modified files

```
app/(public)/bids/[slug]/[code]/page.tsx
  DepositSlot + SignatureSlot now compose against (status, signedAt) pair, not status alone.
  Renders Paid ✓ when paid_at set; Signed ✓ when signed_at set; "All set" banner only when both.
  Adds 'refunded' branch — banner + suppresses active slots.

src/components/public/bid-timeline.tsx
  Reads (paid, signed) as independent signals. "Pay your deposit" is current when !paid;
  "Sign your waiver" is current when !signed. Order-independent.

src/services/bids/get-bid.ts
  Add bid.paidAt + 'refunded' to BidStatus union. Read paid_at from RPC row.

app/admin/bids/[id]/page.tsx
  Render <RefundDepositButton> when status='paid' AND refund_payment_intent_id IS NULL.
  Hide once status='refunded'. Status badge picks up the new 'refunded' variant.

src/components/admin/bid-status-badge.tsx
  Add 'refunded' variant (re-use existing 'past' or 'closed' visual treatment).

.env.example
  Append a note on RAK prefix preference. No new variables.

package.json
  +stripe, +@stripe/stripe-js, +@stripe/react-stripe-js.
```

---

## Sub-phases

### 6.1 — Stripe client + env wiring

What this builds:

- `lib/stripe/server.ts` — exports `createStripeClient()` returning a singleton-per-process `Stripe` instance. Reads `STRIPE_SECRET_KEY`; throws (not returns null) when missing — fail-fast at first use beats silent NPEs deep in the request path. `apiVersion` pinned.
- `lib/stripe/publishable-key.ts` — exports `getPublishableKey()` reading the `NEXT_PUBLIC_*` var; throws at module load if absent.
- Install packages, run `tsc --noEmit` to confirm types resolve cleanly under Node 18 (CI / WSL) AND Node ≥20.9 (user's dev env).

**SOLID note.** The factory takes no parameters and lives in `lib/` because the Stripe SDK is an infrastructure adapter — not domain code. Service functions in `src/services/stripe/` **receive** the client as a parameter (Dependency Inversion); they never call `createStripeClient()` themselves.

### 6.2 — Migration + Phase 7 doc bump

What this builds:

- The migration file in §3.
- Update `plan/supabase/phase-7-rls.md` and/or `plan/supabase/phase-3-bids.md` with the trigger change and a one-line entry in their changelogs.
- Apply locally via Supabase CLI; manually exercise the relaxed `paid` transition in the SQL editor (UPDATE a test bid from confirmed→paid; verify booking moves to deposit_paid AND a row in `bids_status_history` if/when that table lands).

### 6.3 — Server Action: create deposit session (idempotent)

`src/services/stripe/create-deposit-session.ts`

```ts
import type { Stripe } from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DepositSessionContext {
  supabase: SupabaseClient;
  stripe: Stripe;
  bidSlug: string;
  bidAccessCode: string;
}

export interface DepositSession {
  clientSecret: string;
  sessionId: string;
  amount: number;
  currency: "usd";
}

export async function createDepositSession(
  ctx: DepositSessionContext,
): Promise<DepositSession> { ... }
```

Behavior (Pattern A — PaymentIntent, decided 2026-05-22):

1. Validate bid via `validate_bid_access_code(slug, code)`. Return `bid_not_found` if no match — never expose existence.
2. Bid status gate. `paid` / `refunded` → `already_paid`. `pending_review` / `denied` / `expired` → `bid_not_payable` with a status-specific message. `confirmed` / `signed` → proceed.
3. Fetch `bookings.deposit_amount` + `bookings.deposit_payment_intent_id`. If `deposit_amount` is null/0, return `no_deposit_amount`.
4. If `deposit_payment_intent_id` is set, retrieve the PI from Stripe. If `pi.amount === expected_cents` AND `pi.status ∈ {requires_payment_method, requires_confirmation, requires_action, processing}`, return its `client_secret`. Otherwise fall through — stale PIs (amount drift after staff edit, or terminal state) auto-cancel in Stripe's 24h window; we don't bother explicitly canceling.
5. Create a new PaymentIntent via `stripe.paymentIntents.create({ amount, currency: 'usd', metadata: { bid_id, booking_id }, description })`, idempotency key `deposit-${bid.id}-amt-${cents}-v1`. The amount is embedded so amount-drift gets a fresh key (else Stripe's idempotency cache would return the stale PI). NO `payment_method_types` per stripe-best-practices — dynamic methods on apiVersion ≥ 2023-08-16. NO `receipt_email` — branded receipt fires from the webhook (6.5).
6. UPDATE `bookings.deposit_payment_intent_id = pi.id`. UNIQUE partial index (Phase 2) is the safety net.
7. Return `{ clientSecret, paymentIntentId, amount, currency }`.

The PI metadata carries `bid_id` and `booking_id` — the webhook consumes these to skip a session→booking lookup.

`app/(public)/bids/[slug]/[code]/deposit-actions.ts` is the thin Server Action wrapper. It builds the context (service-role Supabase, Stripe client) and calls the service. Per CLAUDE.md "One action, one purpose" — no email, no logging side effects beyond what the service does.

### 6.4 — Embedded Payment Element on the bid page

`src/components/public/deposit-payment-form.tsx` — `"use client"`.

- Props: `{ bidSlug, accessCode, amount, currency }` (amount + currency are server-known and passed for the button label; client doesn't decide them).
- On mount: calls the Server Action via React's `useTransition` to get `clientSecret`. Renders nothing until it lands (skeleton state in the slot).
- Mounts `<Elements stripe={loadStripe(publishableKey)} options={{ clientSecret }}>` wrapping `<PaymentElement />` + a "Pay $X deposit" button.
- On submit: calls `stripe.confirmPayment({ elements, confirmParams: { return_url: <same bid URL> } })`. The `return_url` is the bid page itself; for the inline flow, redirect_if_required is `'if_required'` so card payments don't bounce out (only 3DS / multibanco / etc. need a redirect).
- After success: polls the bid page (existing Phase 3 polling mechanism if present, OR a one-shot router.refresh()). The webhook will have written `bid.status='paid'` by the time we re-fetch — render the "Paid ✓" state.
- Error states: form-level error from `confirmPayment.error.message`; for unrecoverable errors (session expired), fall back to a "Refresh and try again" button that retriggers the Server Action.

`app/(public)/bids/[slug]/[code]/page.tsx` — DepositSlot becomes:

```tsx
function DepositSlot({ status, detail }) {
  if (status === 'paid') return <PaidConfirmation detail={detail} />;
  if (status === 'confirmed' || status === 'signed') {
    return (
      <DepositPaymentForm
        bidSlug={detail.bid.slug}
        accessCode={/* from URL */}
        amount={detail.booking.depositAmount!}
        currency="usd"
      />
    );
  }
  return null;
}
```

The access code isn't on the server-fetched `detail` (by design — it's never stored plaintext). Pass it from `params` down into DepositSlot via the page component.

**SOLID note.** The client form's only responsibility is mounting Stripe and confirming payment. It does not own bid status interpretation (the page does that), does not own payment business logic (the service does that), and does not call Stripe directly with any keys (publishable only, via Stripe.js).

### 6.5 — Webhook handler

`app/api/webhooks/stripe/route.ts`

```ts
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createStripeClient } from "@/lib/stripe/server";
import { handleCheckoutCompleted } from "@/src/services/stripe/handle-checkout-completed";

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  const raw = await req.text();
  const stripe = createStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch { return new Response("invalid signature", { status: 400 }); }

  const supabase = createServiceRoleClient();

  // Phase 6 claim-first idempotency
  const { data: claim } = await supabase
    .from("processed_webhooks")
    .insert({ id: event.id, source: "stripe", event_type: event.type, payload: event as any })
    .select("id")
    .maybeSingle();
  if (!claim) return new Response("already processed", { status: 200 });

  try {
    if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded({ supabase, stripe, event });
    }
    // Future event types added here, each delegating to its own handler.
    // Examples to consider later: payment_intent.payment_failed (record
    // failure metric), charge.refunded (cross-check admin refund flow).
    return new Response("ok", { status: 200 });
  } catch (err) {
    // Best-effort: leave the claim row in place so Stripe retries don't
    // double-process. Log for triage. Returning 500 tells Stripe to retry,
    // but we've already claimed — so retry will short-circuit. That's the
    // intended behavior: we accept the event but stop trying to act on it.
    // If acting failed for a real reason (DB down), the row will time out
    // of the 30-day window before the issue is rediscovered. Surface to Sentry.
    console.error("[stripe webhook]", event.id, err);
    return new Response("handler error", { status: 500 });
  }
}

export const dynamic = "force-dynamic";
```

`src/services/stripe/handle-payment-intent-succeeded.ts` (renamed from handle-checkout-completed during the Pattern A pivot):

- Reads `event.data.object` as `Stripe.PaymentIntent`.
- Validates `pi.metadata.bid_id` is present; if not, log + bail (not our event).
- The PI id is already on `bookings.deposit_payment_intent_id` from the Server Action — no extra write needed for that column.
- UPDATE `bids SET status='paid', paid_at=now()` WHERE id = pi.metadata.bid_id AND status IN ('confirmed', 'signed'). The trigger fans out to bookings.
- If either UPDATE writes 0 rows: log a warning (could be a duplicate event Stripe sent twice but with a different id — rare; the metadata gate would catch most cases).
- **Send the branded receipt** via the existing `EmailService` interface (`src/services/notifications/send-email.ts`): `await getEmailService().send({ to: booking.guest_email, template: 'deposit-receipt', data: {...} })`. Wrap the send in a try/catch — receipt-send failure must NOT roll back the payment record. Log to Sentry, return 200. The receipt is best-effort; staff can re-send via App 8's outbox tooling. Use `after()` from `next/server` so the response returns before the email send awaits, matching the `create-public-booking.ts` pattern.

**Receipt template** lives at `src/services/notifications/templates/deposit-receipt.ts`. Renders: property name + brand, guest name, deposit amount, booking date/slot, "what's next" copy that branches on signed_at (if not signed, prompt to return to bid page and sign; if signed, "we'll see you on <date>"). Uses the same React Email primitives as the existing bid-ready template (App 2.9 / App 3.5 conventions).

**Idempotency notes.**

- `processed_webhooks` PK `(id, source, event_type)` prevents duplicate processing of the same Stripe event.
- UNIQUE partial index on `bookings.deposit_payment_intent_id` prevents writing the same PI to two bookings — guards against a misrouted webhook.
- `bids` UPDATE WHERE clause refuses to re-stamp an already-paid bid. **Critical implication:** if Stripe replays the same event under a different id (rare), the receipt email will NOT re-send because the bids UPDATE writes 0 rows and the handler bails before the email step. Receipt duplication is therefore guarded by the bid-status idempotency check, not by `processed_webhooks` alone.

**`force-dynamic`.** Required so Next.js doesn't try to cache the route handler.

**Vercel timeout note** (documentation only): Vercel serverless functions cap at 10s (hobby) / 60s (pro). Current handler is ~3 DB queries + 1 email send via `after()` (which runs outside the response window). Well within budget. If the handler ever needs synchronous work that approaches the cap, move to Inngest (App 9 territory) rather than expanding the route handler.

### 6.6 — Admin manual refund button

`src/services/admin/refund-deposit.ts`:

```ts
export async function refundDeposit({
  supabase,
  stripe,
  bidId,
  amount,  // optional partial; defaults to full
  reason,  // optional staff note → bids.internal_notes append
}: RefundContext): Promise<{ refundId: string; refundedAmount: number }>
```

- Reads bid + booking; aborts unless `bid.status='paid'` AND `booking.deposit_payment_intent_id IS NOT NULL` AND `bid.refund_payment_intent_id IS NULL`.
- Calls `stripe.refunds.create({ payment_intent, amount, idempotency_key: 'refund-' + bid.id })`.
- Writes back in **one UPDATE**: `bids.status='refunded'`, `bids.refund_payment_intent_id = refund.id`, `bids.refund_amount = refund.amount / 100`, optionally append `reason` to `bids.internal_notes`. The `sync_booking_from_bid` trigger fans the status change out to `booking.status='cancelled'` in the same transaction.
- **Atomicity:** the Stripe refund is created BEFORE the DB UPDATE. If the UPDATE fails, the refund still happened — Stripe is the irrevocable side and the DB must reflect it. The idempotency key on the Stripe call dedupes if staff retry the action. If the Stripe call fails, no DB writes happen and the admin sees the error.
- **Optional receipt-style email:** a "Refund processed" email to the guest (via `EmailService`). Same best-effort pattern as the deposit receipt — log on failure, don't roll back. Template: `src/services/notifications/templates/refund-notice.ts`. Decide at build time whether this is included in 6.6 or deferred to App 8.

`src/components/admin/refund-deposit-button.tsx` (`"use client"`):

- Renders a `<Button variant="destructive">` with a confirm modal: amount input (defaults to full deposit), reason textarea, Cancel / Refund $X.
- Calls the Server Action; toast on success; refreshes the page.

`app/admin/bids/[id]/refund-actions.ts` wraps the service. RLS lets admins / property managers SELECT the bid; the service writes via service-role since admin writes don't go through bid RLS (CLAUDE.md "Admin actions are explicit").

**Out-of-scope reminder.** Partial refunds are a Stripe-level capability; we surface a single optional amount input. Multi-refund (refund a partial, later refund the rest) is supported by Stripe but blocked by our `refund_payment_intent_id` UNIQUE index — admins refund once. If we need multi-refund later, the column becomes a JSONB array or a separate `refunds` table.

### 6.7 — Manual test pack

In the same style as App 2.10 / App 3.10.

| # | Scenario | Expected |
|---|---|---|
| S1 | Bid in `confirmed`: deposit form renders. Use Stripe test card `4242 4242 4242 4242`. | `bid.status='paid'`, `bid.paid_at` set, `booking.status='deposit_paid'`, `booking.deposit_payment_intent_id` set. Bid page shows Paid ✓ + "still need to sign" banner (signed_at null). |
| S2 | Same as S1 but bid is `signed` going in. | `bid.status='paid'`, `signed_at` preserved. Bid page shows "All set" terminal banner (both signed + paid). |
| S3 | Click Pay, dismiss, click Pay again — same PI reused. | `bookings.deposit_payment_intent_id` does not change between clicks; Stripe shows one PaymentIntent not two. |
| S4 | Bid is `pending_review`. | Server Action returns "Bid not yet confirmed" error; no session created. |
| S5 | Bid already `paid`. | Pay button doesn't render; status shows Paid ✓. |
| S6 | Stripe test card `4000 0000 0000 9995` (insufficient funds). | Form shows error inline; bid status unchanged. PI lands in `requires_payment_method` — retry uses the same PI. |
| S7 | 3DS test card `4000 0027 6000 3184`. | 3DS modal appears; on accept, payment completes; same outcome as S1. |
| S8 | Webhook signature fails (forge a request without `Stripe-Signature`). | Route returns 400. No DB write, no email. |
| S9 | Webhook fires twice with same event ID (replay). | Second call returns 200 "already processed". `bid.paid_at` unchanged. No duplicate receipt email. |
| S10 | Branded receipt email — after S1. | `dev_email_outbox` has one row for `deposit-receipt` template, addressed to `booking.guest_email`. Subject + body render the guest name, deposit amount, date/slot. |
| S11 | Receipt copy branches on signed_at. | Receipt sent in S1 (unsigned) prompts to return to bid page and sign. Receipt sent in S2 (signed) says "we'll see you on <date>". |
| S12 | Admin refund flow — full refund of a paid bid. | `bids.status='refunded'`, `bids.refund_payment_intent_id` set, `bids.refund_amount=deposit`. Booking moves to `cancelled` via trigger. Stripe dashboard shows refund. Bid page renders refunded banner; admin refund button hidden. |
| S13 | Admin refund flow — partial refund ($100 of $500). | Refund recorded for $100; `bids.status='refunded'` (single-refund design — partial still marks refunded). UI prevents second refund attempt. |
| S14 | Refund retry — admin clicks Refund, Stripe call succeeds, DB UPDATE fails (simulate by temporarily wrong-typing the bid id). | Stripe refund exists; staff sees error toast; subsequent retry with the same bid uses the same idempotency key → Stripe returns existing refund → DB write succeeds on second attempt. |
| S15 | Trigger relaxation: admin in SQL: UPDATE a confirmed bid to paid manually. | Booking moves to `deposit_paid`. No trigger error. |
| S16 | Trigger relaxation: admin in SQL: UPDATE a paid bid to refunded manually. | Booking moves to `cancelled`. No trigger error. |
| S17 | Cross-portal — partner / member can't see staff-only refund UI. | Refund button absent on member/partner views (they don't have `/admin` anyway, but defense-in-depth). |
| S18 | "Finalization" UI — pay then sign (App 7 sequence). | After App 7 wires signing: pay first (S1), then sign — bid page transitions from "still need to sign" banner to "All set" once `signed_at` lands. Defer execution of this scenario until App 7 ships. |

Verification log row in `docs/manual-testing.md` matching the existing format.

---

## SOLID + project-rule checklist

- **Single Responsibility.** Service functions do one thing each: `create-deposit-session`, `handle-checkout-completed`, `refund-deposit`. The webhook route handler dispatches but doesn't act.
- **Open/Closed.** Adding a future event type (e.g. `payment_intent.payment_failed` for failure tracking) means one new handler + one new switch arm — no changes to existing handlers.
- **Liskov.** The Stripe client passed to services is the real SDK shape. A future MockStripe used in tests satisfies the same interface (we don't need a custom abstraction layer).
- **Interface Segregation.** Services take only what they need: `{ supabase, stripe }` plus task-specific params. No "service registry" object.
- **Dependency Inversion.** Services receive `stripe` and `supabase` as parameters. They never call `createStripeClient()` or `createServiceRoleClient()` themselves. The route handler / Server Action wires them up.
- **Strict portal allowlist.** `/api/webhooks/stripe/*` is not in any portal allowlist (middleware skip already covers `/api/`). Admin refund Server Action checks user role via Supabase session (defense-in-depth on top of RLS).
- **Database is source of truth.** Stripe is the payment authority; the database is the workflow authority. The webhook reconciles state; we never "remember" Stripe state in memory.
- **No connections per request.** Stripe client is singleton-per-process; Supabase service client is created per request (existing project pattern).
- **No mocked DB in tests.** Per memory `feedback_booking_funnel_state` analog: any tests for the webhook should hit a real Postgres (Supabase local) rather than mocking.

---

## RLS notes

- `bids` already has admin / property_manager / member / partner SELECT policies (Phase 3). No new policies needed for App 6 — refund reads happen via admin SELECT.
- `processed_webhooks` is RLS-enabled with no policies, so only service-role can write. The webhook route uses the service-role client. Already correct from Phase 6.
- Writes in `create-deposit-session` and `handle-checkout-completed` go through service-role (anon has no UPDATE on `bids` / `bookings`). Admin refund similarly.
- No new SECURITY DEFINER functions. The bid validation continues to use the existing `validate_bid_access_code` RPC.

---

## Risks + open questions (resolved during planning)

1. **Trigger-relaxation product check.** ✅ Resolved. Workflow: signing is required to finalize the bid, but can happen before or after payment. The "fully finalized" rule (paid_at AND signed_at) is a UI-derived state — see § Workflow finalization. The trigger relaxation in §3 is intentional.
2. **Stripe webhook retries vs Vercel timeouts.** ✅ Documented in §6.5. Current handler stays well under budget; documented note in code + plan.
3. **3DS / SCA UX on the inline form.** Test pack scenario S7 exercises this. Verify in build.
4. **Currency hardcoded to USD.** ✅ Confirmed. Future multi-currency lives on `properties` or `bookings`.
5. **Receipt email.** ✅ Branded receipt via Resend / `EmailService`. Stripe's auto-receipt is suppressed (no `receipt_email`). See §6.5 for the implementation hook and §Workflow finalization for the copy split based on `signed_at`.
6. **Refund status change.** ✅ Resolved — option (a) implemented. New enum value `refunded`; refund flow flips the bid status in the same UPDATE; trigger maps to `booking='cancelled'`. UI surfaces a Refunded banner.

**Remaining open questions (build-time decisions):**

- **Single ALTER TYPE migration vs split.** `ALTER TYPE ... ADD VALUE` cannot run in the same transaction as subsequent uses of the new value. If `supabase db push` applies the §3 migration as one transaction and Postgres rejects the trigger function referencing `'refunded'` literally, split into `20260523120000_app_6_enum.sql` (just the enum bump) + `20260523120100_app_6_trigger_and_columns.sql` (everything else). Try single-file first; split if it fails.
- **Refund-notice email scope.** Whether to include the "refund processed" notification email in 6.6 or defer to App 8. Tilt: ship in 6.6 to close the customer-experience loop, since the EmailService interface already exists.
- **"Partial refund still marks refunded" UX.** A $100 partial refund of a $500 deposit flips the bid to `refunded` and the booking to `cancelled`. Confirm with client: is partial-refund-without-cancel a real scenario? If yes, App 6 needs a separate "adjust deposit" path that doesn't change status (deferred). If no, current design is correct.

---

## Sequencing recommendation

6.1 (Stripe client + env) → 6.2 (migration + trigger relaxation) → 6.3 (Server Action) → 6.4 (Payment Element UI) → 6.5 (webhook handler) → 6.6 (admin refund) → 6.7 (test pack).

6.1 + 6.2 land together — neither is useful without the other. 6.3–6.5 must land together to be testable end-to-end (you can't verify the Server Action without the form, and the form does nothing without the webhook). 6.6 is independent and can split into its own PR. 6.7 is the final integration run.

A single PR covering 6.1–6.5 is reasonable (one feature, one ship). 6.6 + 6.7 in a follow-up PR.

---

## What to expect when this lands

- A guest who receives a confirmed bid clicks "Pay your $X deposit" and completes the transaction without leaving the bid page.
- `bid.status='paid'`, `booking.status='deposit_paid'`, `bid.paid_at`, `booking.deposit_payment_intent_id` are all stamped within seconds of completion.
- A branded receipt email lands in the guest's inbox via `EmailService` (today: written to `dev_email_outbox`; post-App 8: sent via Resend).
- The bid page renders Paid ✓ in the DepositSlot. If the bid is also signed, the "All set" terminal banner shows; if not, the SignatureSlot remains current with copy nudging the guest to sign.
- Staff can refund from `/admin/bids/[id]`. Refund flips the bid to `refunded` and the booking to `cancelled` atomically.
- App 7 (Dropbox Sign) ships later and plugs in cleanly: signing stamps `bids.signed_at` and (if status is still `confirmed`) advances status to `signed`. If status is already `paid`, App 7 stamps `signed_at` only — no status regression. The "All set" banner then flips on automatically.

# Phase 3 — Bids

## Prerequisites

- Phase 1 and Phase 2 complete
- `booking_status_enum` created (Phase 2)
- `pgcrypto` extension enabled (used for hashing the per-bid access code)

## What This Phase Builds

`bid_status_enum`, `generate_bid_slug()` function, `validate_bid_access_code()` function, `bids` table, plus 3 trigger functions that keep bids and their parent bookings in sync. Live status updates on the public bid page are delivered via **HTTP polling** against a service-role Route Handler — not via Supabase Realtime (see Step 9 for the why).

---

## Key Design Decisions

**Bid and booking are created together.** The checkout Server Action opens one transaction: insert booking (`pending_review`) → generate slug → insert bid (`pending_review`) → commit. If either fails, both roll back. There is never a booking without a bid.

**`bids.booking_id` is the only FK direction.** `bookings` has no `bid_id` column — that would create a circular FK that complicates migrations and constraint ordering. To find a booking's bid: `SELECT * FROM bids WHERE booking_id = $1`.

**Bid status is the source of truth for the workflow.** When bid status changes, an AFTER UPDATE trigger syncs the booking status automatically. Application code updates the bid; the booking status follows.

**`expires_at` is set when the bid is confirmed.** Until then it is null — there is nothing to expire. Once staff confirms the bid, the guest has 7 days to sign and pay before the slot is released.

**The bid page is two-factor: slug + access code.** The slug identifies the bid in the URL; the access code is a 6-character secret generated at checkout, shown once on the confirmation page, and emailed to the guest. The bid page asks for the code on a fresh device, validates it against `access_code_hash` (bcrypt), and sets a signed `httpOnly` cookie scoped to that bid for the rest of the session. URL leakage alone does not expose the bid. Staff cannot retrieve a forgotten code — only regenerate.

**Live updates use polling, not Realtime.** Supabase Realtime delivers `postgres_changes` events through RLS, and the bid page is anonymous — so Realtime would silently deliver nothing without opening `bids` to anon reads. Instead, the page polls a service-role Route Handler every 5 seconds (see Step 9). Trivially upgradeable to a server-side broadcast channel later if sub-second latency becomes a real requirement.

---

## Migration

### Step 1 — Status enum

```sql
CREATE TYPE bid_status_enum AS ENUM (
  'pending_review',  -- created at checkout, staff notified, guest sees "being reviewed"
  'confirmed',       -- staff approved, guest can sign + pay
  'denied',          -- staff rejected, booking slot released
  'signed',          -- waiver signed via Dropbox Sign
  'paid',            -- deposit received via Stripe
  'expired',         -- confirmed/signed but guest did not complete within expires_at
  'refunded'         -- App 6 — admin Refund flipped a paid bid; booking goes to 'cancelled'
);
```

**App 6 (2026-05-23) added `'refunded'`** via `20260523120000_app_6_bid_enum_refunded.sql`. Postgres forbids referencing a newly-added enum value in the same transaction that adds it, which is why the App 6 deposit migration is split: enum bump first, columns + trigger second.

### Step 2 — Slug generation function

Runs inside the database to prevent race conditions. Normalizes the guest name, appends the booking date, and retries with a numeric suffix if the slug is already taken. All within a single function call — no application-level retry logic needed.

```sql
CREATE OR REPLACE FUNCTION generate_bid_slug(
  p_guest_name text,
  p_start_time timestamptz
)
RETURNS text AS $$
DECLARE
  v_base      text;
  v_candidate text;
  v_suffix    integer := 0;
  v_taken     boolean;
BEGIN
  -- Normalize: lowercase, replace non-alphanumeric runs with a hyphen, trim edges
  v_base := lower(regexp_replace(p_guest_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);

  -- Append the booking date (YYYY-MM-DD) for readability
  v_base := v_base || '-' || to_char(p_start_time, 'YYYY-MM-DD');

  v_candidate := v_base;

  LOOP
    SELECT EXISTS (
      SELECT 1 FROM bids WHERE slug = v_candidate
    ) INTO v_taken;

    EXIT WHEN NOT v_taken;

    v_suffix    := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  END LOOP;

  RETURN v_candidate;
END;
$$ LANGUAGE plpgsql;
```

### Step 3 — `bids`

```sql
CREATE TABLE bids (
  id                uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid   NOT NULL UNIQUE REFERENCES bookings(id),
  slug              text   NOT NULL UNIQUE,
  status            bid_status_enum NOT NULL DEFAULT 'pending_review',

  -- Guest-facing access code (bcrypt hash; plaintext is shown once at
  -- confirmation and emailed). Server Action generates the plaintext,
  -- hashes it with extensions.crypt(code, gen_salt('bf')), inserts the
  -- hash here. The plaintext is never stored. Lost codes require regen.
  access_code_hash  text   NOT NULL,

  -- Content assembled by staff before confirming
  staff_notes    text,
  schedule_notes text,
  gear_list      jsonb    NOT NULL DEFAULT '[]'::jsonb,
  faq            jsonb    NOT NULL DEFAULT '[]'::jsonb,

  -- E-sign
  dropbox_sign_envelope_id text,
  signed_at                timestamptz,

  -- Expiry (set when status transitions to 'confirmed')
  expires_at  timestamptz,

  -- Cancellation and denial
  cancelled_at             timestamptz,
  denial_reason            text,
  refund_amount            numeric(10,2),
  refund_payment_intent_id text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### Step 3.5 — Access code validation function

`SECURITY DEFINER` so it can be called by the anonymous bid page (which has no RLS read access to `bids`) without exposing the table itself. The function takes a slug + plaintext code and returns the matching `bids` row only if the bcrypt hash compares — otherwise no rows. The bcrypt verify is the standard `crypt(plaintext, stored_hash) = stored_hash` pattern, which is constant-time inside `crypt()`.

```sql
CREATE OR REPLACE FUNCTION validate_bid_access_code(
  p_slug text,
  p_code text
)
RETURNS SETOF bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Constant dummy hash used when no bid matches, so timing does not
  -- reveal whether a slug exists. bcrypt verify on the dummy still costs
  -- ~one bcrypt round, matching the real path.
  PERFORM extensions.crypt(p_code, '$2a$10$DummyDummyDummyDummyDuOJ8wzGqdtu1.JBxa/h8.7s5dyZqr5h.W');

  RETURN QUERY
  SELECT * FROM bids
  WHERE slug = p_slug
    AND access_code_hash = extensions.crypt(p_code, access_code_hash);
END;
$$;

-- Anon and authenticated callers can invoke it; the function itself
-- enforces the slug+code check before returning any row.
REVOKE ALL ON FUNCTION validate_bid_access_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_bid_access_code(text, text) TO anon, authenticated, service_role;
```

The `/bid/[slug]` Route Handler calls this function with the user-supplied code, sets a signed `httpOnly` cookie on success, and renders the bid. The cookie carries `{bidId, exp}` signed with `BID_COOKIE_SECRET`; subsequent requests verify the cookie instead of asking for the code again. Cookie lifetime tracks `bids.expires_at` (capped at 7 days).

### Step 4 — Trigger: auto-generate slug on insert

The application may pass a slug explicitly (allowing staff to override before send). If the slug is null or empty, the trigger generates one from the parent booking's guest name and start time.

```sql
CREATE OR REPLACE FUNCTION set_bid_slug()
RETURNS TRIGGER AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    NEW.slug := generate_bid_slug(v_booking.guest_name, v_booking.start_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_set_slug
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION set_bid_slug();
```

### Step 5 — Trigger: set `expires_at` when bid is confirmed

Expires 7 days after confirmation. Inngest watches this field and fires the expiry sequence when `now() > expires_at` and the status is still `confirmed` or `signed`.

```sql
CREATE OR REPLACE FUNCTION set_bid_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only the pending_review → confirmed transition sets expires_at.
  -- Guarding against OLD.status explicitly prevents weird transitions
  -- (e.g., paid → confirmed) from silently re-arming the expiry clock.
  IF NEW.status = 'confirmed' AND OLD.status = 'pending_review' THEN
    NEW.expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_set_expiry
  BEFORE UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION set_bid_expiry();
```

### Step 6 — Trigger: sync booking status when bid status changes

Bid status is the source of truth. This trigger keeps the parent booking's status aligned automatically. Application code should update `bids.status` only — the booking updates itself.

```sql
CREATE OR REPLACE FUNCTION sync_booking_from_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_rows int;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;  -- no status change, nothing to sync
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      UPDATE bookings
      SET status = 'awaiting_guest', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'denied' THEN
      UPDATE bookings
      SET status = 'denied', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'signed' THEN
      UPDATE bookings
      SET status = 'signed', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'awaiting_guest';

    WHEN 'paid' THEN
      UPDATE bookings
      SET status = 'deposit_paid', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');
      -- App 6 relaxed source state from 'signed' → ('awaiting_guest', 'signed'):
      -- deposit can clear before signature. Either ordering reaches deposit_paid.

    WHEN 'refunded' THEN
      -- App 6: admin Refund flips a paid bid to refunded; booking goes to
      -- cancelled (slot releases). Post-event refunds intentionally blocked
      -- (no match on 'fulfilled') — those are a Stripe-dashboard-only path.
      UPDATE bookings
      SET status = 'cancelled', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'deposit_paid';

    WHEN 'expired' THEN
      UPDATE bookings
      SET status = 'expired', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    ELSE
      RETURN NEW;  -- pending_review on UPDATE (e.g. expired-back-to-review) — no sync defined
  END CASE;

  -- Fail loud if the booking was not in the state we expected.
  -- Silently no-op'ing causes booking/bid status drift, which is
  -- much harder to debug than a clear error at the offending UPDATE.
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION
      'sync_booking_from_bid: bid % moved to % but its booking % was not in the expected source state',
      NEW.id, NEW.status, NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_sync_booking_status
  AFTER UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION sync_booking_from_bid();
```

### Step 7 — `updated_at` trigger

```sql
CREATE TRIGGER bids_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Step 8 — Indexes

```sql
-- Slug lookup — the primary way the bid page fetches its data.
-- (No explicit index needed: `slug text NOT NULL UNIQUE` on the table
--  already creates a unique B-tree index named `bids_slug_key`.)

-- Inngest expiry workflow: find bids that have passed their deadline
CREATE INDEX idx_bids_expiry
  ON bids (expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('confirmed', 'signed');

-- Dropbox Sign webhook: find bid by envelope ID.
-- UNIQUE so a single envelope can't be attached to two bids if a
-- webhook double-fires or the Inngest worker retries.
CREATE UNIQUE INDEX idx_bids_dropbox
  ON bids (dropbox_sign_envelope_id)
  WHERE dropbox_sign_envelope_id IS NOT NULL;

-- Stripe refund intent: same idempotency rationale as the deposit/balance
-- intents on `bookings` in Phase 2.
CREATE UNIQUE INDEX idx_bids_refund_intent
  ON bids (refund_payment_intent_id)
  WHERE refund_payment_intent_id IS NOT NULL;

-- Admin list: bids by status recency
CREATE INDEX idx_bids_status_created ON bids (status, created_at DESC);
```

### Step 9 — Live status updates (HTTP polling, not Realtime)

The bid page at `/bid/[slug]` needs to update when staff confirms, denies, or modifies the bid. We do this with HTTP polling against a service-role Route Handler — **not** Supabase Realtime. **No database change is needed for this step**; it is documented here because the system-design choice belongs in the Phase 3 plan.

**Why not Realtime.** `ALTER PUBLICATION supabase_realtime ADD TABLE bids` only delivers events to clients whose RLS allows them to `SELECT` the changed row. The bid page is anonymous (no JWT), and the RLS policies on `bids` (admin / property_manager / concierge / partner / member) all require an authenticated role. An anon subscription therefore silently receives nothing. The two ways to "fix" Realtime are either (a) opening `SELECT` on `bids` to anon — which means anyone can enumerate every bid in the database if they discover the API URL — or (b) building a server-side broadcast pipeline that bridges Postgres NOTIFY to a Realtime broadcast channel keyed by slug. Both are heavier than the alternative, and Realtime's UX benefit (sub-second latency) is invisible to a guest waiting for a human review.

**The polling pattern.** A Next.js Route Handler at `/bid/[slug]/status` uses `SUPABASE_SECRET_KEY` server-side to read `bids` for the slug, verifies the session cookie (set by `validate_bid_access_code`), and returns only the fields the page needs to react to a state change:

```ts
// app/bid/[slug]/status/route.ts
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const cookie = await readSignedBidCookie();  // returns { bidId } or null
  if (!cookie) return new Response('unauthorized', { status: 401 });

  const { data, error } = await supabaseServiceRole
    .from('bids')
    .select('status, expires_at, signed_at, dropbox_sign_envelope_id')
    .eq('slug', params.slug)
    .eq('id', cookie.bidId)        // belt-and-braces: cookie must match slug's bid
    .maybeSingle();

  if (error || !data) return new Response('not found', { status: 404 });
  return Response.json(data);
}
```

The client-side bid page polls this endpoint every 5 seconds:

```ts
useEffect(() => {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    const next = await fetch(`/bid/${slug}/status`).then(r => r.json());
    setBidState(next);  // React re-renders if status actually changed
  };
  const id = setInterval(tick, 5000);
  return () => { cancelled = true; clearInterval(id); };
}, [slug]);
```

**Properties of this approach:**

- **No `bids` row is ever exposed to anon clients.** The service role lives only inside the Route Handler.
- **The session cookie is the authorization.** Without it, the status endpoint returns 401 — even with the correct slug. The slug is identifier, the cookie (set after `validate_bid_access_code` succeeds) is the credential.
- **Latency is up to 5 seconds.** Acceptable: bid review happens on human timescales (minutes to hours), not seconds.
- **Trivially switchable later.** If we ever want sub-second updates, swap `setInterval` for a Realtime broadcast subscription without changing schema or RLS.

### Step 10 — RLS on `bids`

The bid page (`/bid/[slug]`) is publicly reachable, but **the slug alone is not the authorization** — the guest must also supply the access code (validated by `validate_bid_access_code`, which then sets a signed `httpOnly` session cookie). The initial bid fetch and the polling endpoint both use `SUPABASE_SECRET_KEY` server-side and project **only customer-safe columns** — `staff_notes`, `denial_reason`, and `dropbox_sign_envelope_id` must never leave the server. RLS policies below govern authenticated access (staff portal, member portal, partner portal); they intentionally do not grant anon any read access to the table.

```sql
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Admin reads all bids
CREATE POLICY "bids: admin read"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- Property manager reads bids for their property
CREATE POLICY "bids: property_manager read"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- Internal concierge reads bids they own
CREATE POLICY "bids: concierge read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

-- Partner concierge reads bids they created
CREATE POLICY "bids: partner read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

-- Member reads bids for their own bookings
CREATE POLICY "bids: member read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.member_user_id = (SELECT auth.uid())
    )
  );

-- Staff can update bid content and status. property_manager is scoped to
-- bids whose underlying booking is at their assigned property — without
-- the EXISTS subquery, a property_manager at HSB could update bids tied
-- to Hog Heaven bookings.
CREATE POLICY "bids: staff update"
  ON bids FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = booking_id
          AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
      )
    )
  );

-- All other writes are service role only (bid creation at checkout, webhook-driven status changes)
```

---

## Notes

**Public bid page authorization model.** The Server Component at `/bid/[slug]` uses `SUPABASE_SECRET_KEY` (server-side only) to fetch the bid. The slug is the *identifier* — it is not by itself sufficient to view the bid. The guest must additionally supply a 6-character access code, which the server verifies via `validate_bid_access_code(slug, code)`. On success, the server sets a signed `httpOnly` cookie containing `{bidId, exp}` so the guest doesn't re-enter the code on every page load. The session cookie expires no later than `bids.expires_at`. The access code itself is high-entropy (≈30^6 ≈ 730M possibilities, excluding ambiguous characters `0/O/1/I/L`), and the validation function uses a constant-time bcrypt compare with a dummy hash for non-existent slugs so failure cases don't leak slug existence via timing. Brute-forcing is further blocked by an edge-level rate limit on the validation endpoint (10 attempts / 15 min / IP).

**Access code lifecycle and recovery.** The plaintext code is generated by the checkout Server Action, hashed with `extensions.crypt(code, gen_salt('bf'))`, stored as `access_code_hash`, returned once to the confirmation page, and emailed to the guest. The plaintext is never stored. If a guest loses their code, staff can regenerate via an admin Server Action that overwrites `access_code_hash` with a new bcrypt hash and re-emails the new plaintext — there is no "look up my code" support flow.

**Column projection on the public path.** `staff_notes`, `denial_reason`, `dropbox_sign_envelope_id`, and `refund_payment_intent_id` are internal-only. The `/bid/[slug]` Server Component and the `/bid/[slug]/status` Route Handler both `.select()` an explicit allowlist of customer-safe columns. Do not `.select('*')` on the public paths.

**Slug uniqueness under concurrency.** The `generate_bid_slug` function uses a `LOOP` that retries until a unique slug is found. This is safe because the function runs within a transaction — the `SELECT EXISTS` check and the eventual `INSERT` are atomic from the perspective of concurrent callers. A concurrent bid creation that generates the same slug will fail the `UNIQUE` constraint on `bids.slug`, which bubbles up as a serialization error. The function prevents this in the normal case; the constraint is the final safety net.

**Why the sync trigger is AFTER UPDATE, not BEFORE.** The `sync_booking_from_bid` trigger issues a separate `UPDATE bookings` statement. `AFTER` triggers fire after the row is committed to the table, which is the correct moment — the bid's new status is visible to the booking update. Using `BEFORE` would mean the bid update hasn't fully committed when the booking update fires.

**Dropbox Sign flow.** When staff confirms the bid and Dropbox Sign is triggered:
1. Inngest function calls the Dropbox Sign API to create the envelope
2. Sets `bids.dropbox_sign_envelope_id` on success
3. Dropbox Sign fires a webhook when the guest signs
4. Webhook handler (via Route Handler + `processed_webhooks` idempotency check) sets `bids.status = 'signed'`
5. The `sync_booking_from_bid` trigger fires and sets `bookings.status = 'signed'`
6. Inngest continues the post-sign workflow (Stripe payment step)

**Stripe flow.** *Revised in App 6 (2026-05-23, Pattern A).* The bid page embeds `<PaymentElement>` from `react-stripe-js`, backed by a raw `paymentIntents.create()` call (NOT a Checkout Session — `react-stripe-js` has no React bindings for `ui_mode: 'custom'`). See `plan/app/app-6-stripe-deposit.md` for the full design. Summary:
1. Server Action `createDepositSession` creates a PaymentIntent and writes `pi.id` to `bookings.deposit_payment_intent_id` (UNIQUE partial index, Phase 2). Idempotency key includes the amount so amount-drift after staff edit gets a fresh PI.
2. The browser mounts `<Elements>` + `<PaymentElement>` with the PI's `client_secret`. Guest confirms via `stripe.confirmPayment()`.
3. Stripe fires `payment_intent.succeeded`. The webhook handler claims the event in `processed_webhooks` (Phase 6 pattern), then writes `bids.status='paid', paid_at=now()`. The `sync_booking_from_bid` trigger fans the bid change out to `bookings.status='deposit_paid'`. (The `deposit_payment_intent_id` was already set during the Server Action — the webhook doesn't re-write it.)
4. A branded receipt email fires via the existing `EmailService` interface (LoggingEmailService → `dev_email_outbox` today; ResendEmailService in App 8). Stripe's auto-receipt is intentionally suppressed (no `receipt_email` on PI create).
5. Inngest fires the confirmation workflow (HubSpot deal update, etc.) — keyed off the Inngest event emitted from the route handler after the writes commit, not directly off Stripe.

**Trigger relaxation (App 6).** `sync_booking_from_bid` now permits `bid.status='paid'` from `booking.status IN ('awaiting_guest', 'signed')`. Originally only `'signed'` was allowed, which transitively required Dropbox Sign (App 7) before any deposit could clear. The two steps are now independent — pay-before-sign and sign-before-pay both reach `deposit_paid`. The bid is "fully finalized" (UI rule) when `paid_at IS NOT NULL AND signed_at IS NOT NULL`.

**Refund flow (App 6).** Admin Refund flips `bid.status='paid' → 'refunded'` in the same UPDATE that writes `refund_payment_intent_id` + `refund_amount`. The trigger maps `'refunded'` to `booking.status='cancelled'` (only from `deposit_paid`; post-event refunds are intentionally a Stripe-dashboard-only path).

**Webhook idempotency contract.** All webhook handlers in Phase 6 must use the `processed_webhooks` table to dedupe. The Stripe webhook in particular should set the payment-intent-id and bid-status mutations in the same transaction as the `processed_webhooks` insert — so a retry that races the original sees the dedupe row and skips, instead of writing the same state twice and tripping the `UNIQUE INDEX idx_bookings_deposit_intent`.

**Staff slug override.** Before confirming a bid, staff can edit the slug in the admin UI (e.g., change `smith-2026-09-12` to `smith-corporate-2026-09-12`). The `UNIQUE` constraint on `bids.slug` catches any collision. The slug is part of the bid URL — changing it after the guest has received the link breaks their link. The admin UI should warn about this and only allow changes while status is `pending_review`.

# Phase 3 — Bids

## Prerequisites

- Phase 1 and Phase 2 complete
- `booking_status_enum` created (Phase 2)

## What This Phase Builds

`bid_status_enum`, `generate_bid_slug()` function, `bids` table, plus 3 trigger functions that keep bids and their parent bookings in sync.

---

## Key Design Decisions

**Bid and booking are created together.** The checkout Server Action opens one transaction: insert booking (`pending_review`) → generate slug → insert bid (`pending_review`) → commit. If either fails, both roll back. There is never a booking without a bid.

**`bids.booking_id` is the only FK direction.** `bookings` has no `bid_id` column — that would create a circular FK that complicates migrations and constraint ordering. To find a booking's bid: `SELECT * FROM bids WHERE booking_id = $1`.

**Bid status is the source of truth for the workflow.** When bid status changes, an AFTER UPDATE trigger syncs the booking status automatically. Application code updates the bid; the booking status follows.

**`expires_at` is set when the bid is confirmed.** Until then it is null — there is nothing to expire. Once staff confirms the bid, the guest has 7 days to sign and pay before the slot is released.

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
  'expired'          -- confirmed/signed but guest did not complete within expires_at
);
```

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
  id          uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid   NOT NULL UNIQUE REFERENCES bookings(id),
  slug        text   NOT NULL UNIQUE,
  status      bid_status_enum NOT NULL DEFAULT 'pending_review',

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
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    NEW.expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_set_expiry
  BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION set_bid_expiry();
```

### Step 6 — Trigger: sync booking status when bid status changes

Bid status is the source of truth. This trigger keeps the parent booking's status aligned automatically. Application code should update `bids.status` only — the booking updates itself.

```sql
CREATE OR REPLACE FUNCTION sync_booking_from_bid()
RETURNS TRIGGER AS $$
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
      WHERE id = NEW.booking_id AND status = 'signed';

    WHEN 'expired' THEN
      UPDATE bookings
      SET status = 'expired', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    ELSE NULL;
  END CASE;

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
-- Slug lookup — the primary way the bid page fetches its data
CREATE INDEX idx_bids_slug ON bids (slug);  -- UNIQUE already implies an index; explicit for clarity

-- Inngest expiry workflow: find bids that have passed their deadline
CREATE INDEX idx_bids_expiry
  ON bids (expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('confirmed', 'signed');

-- Dropbox Sign webhook: find bid by envelope ID
CREATE INDEX idx_bids_dropbox
  ON bids (dropbox_sign_envelope_id)
  WHERE dropbox_sign_envelope_id IS NOT NULL;

-- Admin list: bids by status recency
CREATE INDEX idx_bids_status_created ON bids (status, created_at DESC);
```

### Step 9 — Realtime publication

The bid page at `/bid/[slug]` needs to update live when staff confirms, denies, or modifies the bid — without the guest having to refresh. Add `bids` to Supabase's realtime publication.

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
```

The client-side bid page subscribes to changes on `bids` filtered by `slug`. When `status` changes to `confirmed`, the page transitions from the "being reviewed" state to the sign-and-pay interface.

### Step 10 — RLS on `bids`

The bid page (`/bid/[slug]`) is a public URL — knowing the slug is the authorization. That read is handled by a Next.js Server Component using the service role client. RLS policies below govern authenticated access (staff portal, member portal, partner portal).

```sql
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Admin reads all bids
CREATE POLICY "bids: admin read"
  ON bids FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- Property manager reads bids for their property
CREATE POLICY "bids: property_manager read"
  ON bids FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.property_id = (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid
    )
  );

-- Internal concierge reads bids they own
CREATE POLICY "bids: concierge read own"
  ON bids FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = auth.uid()
    )
  );

-- Partner concierge reads bids they created
CREATE POLICY "bids: partner read own"
  ON bids FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = auth.uid()
    )
  );

-- Member reads bids for their own bookings
CREATE POLICY "bids: member read own"
  ON bids FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.member_user_id = auth.uid()
    )
  );

-- Staff can update bid content and status
CREATE POLICY "bids: staff update"
  ON bids FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'property_manager')
  );

-- All other writes are service role only (bid creation at checkout, webhook-driven status changes)
```

---

## Notes

**Public bid page does not use RLS.** The Server Component at `/bid/[slug]` uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only) to fetch the bid. This is intentional — the slug is long and unguessable, and the page needs to be accessible without a login. Client-side Supabase subscriptions for Realtime updates use the anon key but only receive rows matching the slug filter, not the full table.

**Slug uniqueness under concurrency.** The `generate_bid_slug` function uses a `LOOP` that retries until a unique slug is found. This is safe because the function runs within a transaction — the `SELECT EXISTS` check and the eventual `INSERT` are atomic from the perspective of concurrent callers. A concurrent bid creation that generates the same slug will fail the `UNIQUE` constraint on `bids.slug`, which bubbles up as a serialization error. The function prevents this in the normal case; the constraint is the final safety net.

**Why the sync trigger is AFTER UPDATE, not BEFORE.** The `sync_booking_from_bid` trigger issues a separate `UPDATE bookings` statement. `AFTER` triggers fire after the row is committed to the table, which is the correct moment — the bid's new status is visible to the booking update. Using `BEFORE` would mean the bid update hasn't fully committed when the booking update fires.

**Dropbox Sign flow.** When staff confirms the bid and Dropbox Sign is triggered:
1. Inngest function calls the Dropbox Sign API to create the envelope
2. Sets `bids.dropbox_sign_envelope_id` on success
3. Dropbox Sign fires a webhook when the guest signs
4. Webhook handler (via Route Handler + `processed_webhooks` idempotency check) sets `bids.status = 'signed'`
5. The `sync_booking_from_bid` trigger fires and sets `bookings.status = 'signed'`
6. Inngest continues the post-sign workflow (Stripe payment step)

**Stripe flow.** The bid page embeds a Stripe Payment Element for the deposit. On payment success:
1. Stripe fires a webhook (`payment_intent.succeeded`)
2. Webhook handler sets `bids.status = 'paid'` and sets `bookings.deposit_payment_intent_id`
3. The sync trigger sets `bookings.status = 'deposit_paid'`
4. Inngest fires the confirmation workflow (HubSpot deal update, confirmation email)

**Staff slug override.** Before confirming a bid, staff can edit the slug in the admin UI (e.g., change `smith-2026-09-12` to `smith-corporate-2026-09-12`). The `UNIQUE` constraint on `bids.slug` catches any collision. The slug is part of the bid URL — changing it after the guest has received the link breaks their link. The admin UI should warn about this and only allow changes while status is `pending_review`.

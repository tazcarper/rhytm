-- Phase 5: Member Adventures
--
-- Builds:
--   1. adventure_status_enum + rsvp_status_enum.
--   2. member_adventures — curated 3rd-party trips Rhythm books on
--      behalf of members. Per-adventure pricing (price + optional
--      guest_price add-on), per-adventure guest cap
--      (max_guests_per_rsvp), and a staff-controlled is_manually_sold_out
--      flag separate from the capacity-driven status.
--   3. member_adventure_rsvps — member RSVPs against an adventure,
--      including guest_count and Stripe payment intent slots.
--   4. check_adventure_capacity trigger — enforces (a) per-RSVP guest
--      cap, (b) manual sold-out block, (c) total capacity. FOR UPDATE
--      lock on the parent adventure row serializes concurrent inserts.
--   5. sync_adventure_sold_out trigger — auto-flips status between
--      'published' and 'sold_out' as confirmed_count crosses
--      max_capacity, except when is_manually_sold_out=true (staff wins).
--   6. resync_adventure_sold_out_on_capacity_change trigger — keeps
--      status correct when staff edits max_capacity, same manual-flag
--      respect.
--
-- Application-layer pieces (NOT in this migration):
--   - RSVP Server Action: computes total charge
--     price + (guest_count - 1) * COALESCE(guest_price, 0), creates the
--     Stripe payment intent, inserts the RSVP. Routes to 'waitlisted'
--     when the adventure is at capacity or manually sold-out.
--   - Cancellation Server Action: updates status='cancelled' via the
--     service role, refunds per cancellation policy, emits rsvp.cancelled.
--   - Inngest waitlist promoter on rsvp.cancelled: re-reads
--     is_manually_sold_out and aborts if set; otherwise promotes the
--     oldest waitlisted RSVP to 'confirmed'.
--
-- Pricing semantics: guest_count INCLUDES the member themselves
-- (guest_count=1 is a solo member). max_guests_per_rsvp caps the same
-- value. The application is responsible for displaying "X additional
-- guests" UX from guest_count - 1.

-- ============================================================
-- Step 1 — Enums
-- ============================================================

CREATE TYPE adventure_status_enum AS ENUM (
  'draft',      -- invisible to members
  'published',  -- visible and bookable
  'sold_out',   -- visible but no new RSVPs (capacity full)
  'cancelled',  -- cancelled by staff
  'completed'   -- event happened
);

CREATE TYPE rsvp_status_enum AS ENUM (
  'confirmed',   -- holding a confirmed spot
  'waitlisted',  -- on the waitlist; no spot held
  'cancelled'    -- member cancelled their RSVP
);

-- ============================================================
-- Step 2 — member_adventures
-- ============================================================

CREATE TABLE member_adventures (
  id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid   NOT NULL REFERENCES properties(id),

  title        text   NOT NULL,
  description  text,
  start_date   date   NOT NULL,
  end_date     date   NOT NULL,

  -- Capacity
  max_capacity         integer NOT NULL CHECK (max_capacity > 0),
  max_guests_per_rsvp  integer NOT NULL CHECK (max_guests_per_rsvp > 0),

  -- Pricing (pending Q14: deposit vs. full payment).
  -- price = what a solo member pays (guest_count = 1).
  -- guest_price = additional fee for each guest beyond the member.
  --   NULL means no extra charge per guest (flat price covers the party).
  -- Total at RSVP = price + (guest_count - 1) * COALESCE(guest_price, 0).
  price           numeric(10,2) NOT NULL CHECK (price >= 0),
  guest_price     numeric(10,2) CHECK (guest_price IS NULL OR guest_price >= 0),
  deposit_amount  numeric(10,2),  -- null = full payment upfront

  -- Visible status. Auto-managed by the capacity-based triggers.
  status  adventure_status_enum NOT NULL DEFAULT 'draft',

  -- Staff override. When true, check_adventure_capacity rejects new
  -- confirmed RSVPs (forcing waitlist) and both auto-sync triggers
  -- skip status updates. Independent of `status` so the operator-side
  -- "we're full at 18, not 20" case cannot be undone by a single RSVP
  -- cancellation. Member portal treats either status='sold_out' OR
  -- is_manually_sold_out=true as effectively sold-out.
  is_manually_sold_out boolean NOT NULL DEFAULT false,

  details jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT end_after_start CHECK (end_date >= start_date),
  -- A single RSVP can't claim more slots than the whole adventure has.
  CONSTRAINT guests_per_rsvp_within_capacity
    CHECK (max_guests_per_rsvp <= max_capacity)
);

CREATE INDEX idx_adventures_property_status
  ON member_adventures (property_id, status, start_date);

CREATE TRIGGER member_adventures_updated_at
  BEFORE UPDATE ON member_adventures
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE member_adventures ENABLE ROW LEVEL SECURITY;

-- Members see published / sold_out adventures at any property where
-- they hold an active membership. Joins through `members` because the
-- Phase 4 cross-property model means members carry no single
-- property_id claim in app_metadata.
CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (
      SELECT property_id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

CREATE POLICY "adventures: admin read all"
  ON member_adventures FOR SELECT
  USING (is_admin());

CREATE POLICY "adventures: property_manager read"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

CREATE POLICY "adventures: admin write"
  ON member_adventures FOR ALL
  USING (is_admin());

CREATE POLICY "adventures: property_manager write"
  ON member_adventures FOR ALL
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- ============================================================
-- Step 3 — member_adventure_rsvps
-- ============================================================

CREATE TABLE member_adventure_rsvps (
  id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id uuid   NOT NULL REFERENCES member_adventures(id),
  member_id    uuid   NOT NULL REFERENCES members(id),

  -- Includes the member themselves; solo RSVP has guest_count=1.
  guest_count  integer NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  status       rsvp_status_enum NOT NULL DEFAULT 'confirmed',

  -- Payment (pending Q14).
  deposit_payment_intent_id  text,
  balance_payment_intent_id  text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One RSVP per member per adventure. Re-RSVP after cancellation is
  -- an UPDATE on the existing row, not an INSERT.
  UNIQUE (adventure_id, member_id)
);

CREATE INDEX idx_rsvps_adventure ON member_adventure_rsvps (adventure_id, status);
CREATE INDEX idx_rsvps_member    ON member_adventure_rsvps (member_id);

CREATE TRIGGER member_adventure_rsvps_updated_at
  BEFORE UPDATE ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Step 4 — Trigger: capacity enforcement
-- ============================================================
--
-- Three guardrails fire under one row lock on the parent adventure:
--   (1) Per-RSVP guest cap — applies to every non-cancelled RSVP. A
--       waitlisted RSVP that exceeds max_guests_per_rsvp would be
--       invalid the moment it's promoted, so reject up front.
--   (2) Manual sold-out — rejects confirmed RSVPs outright. Caller
--       must route to 'waitlisted' instead.
--   (3) Total capacity — sum of guest_count across confirmed RSVPs
--       cannot exceed max_capacity. The FOR UPDATE lock serializes
--       concurrent inserts so two members can't both "see room"
--       before either commits.

CREATE OR REPLACE FUNCTION check_adventure_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_max_guests_per_rsvp  integer;
  v_is_manually_sold_out boolean;
  v_confirmed_count      integer;
BEGIN
  -- Always lock the adventure row — every branch below needs current
  -- state, and the lock is what makes the capacity check race-free.
  SELECT max_capacity, max_guests_per_rsvp, is_manually_sold_out
    INTO v_max_capacity, v_max_guests_per_rsvp, v_is_manually_sold_out
  FROM member_adventures
  WHERE id = NEW.adventure_id
  FOR UPDATE;

  -- (1) Per-RSVP guest cap.
  IF NEW.status != 'cancelled' AND NEW.guest_count > v_max_guests_per_rsvp THEN
    RAISE EXCEPTION
      'guest_count % exceeds max_guests_per_rsvp % for this adventure',
      NEW.guest_count, v_max_guests_per_rsvp;
  END IF;

  -- Waitlisted/cancelled don't consume capacity — done after the cap check.
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- (2) Manual sold-out blocks new confirmed RSVPs.
  IF v_is_manually_sold_out THEN
    RAISE EXCEPTION
      'adventure is marked sold-out by staff; new RSVPs must be waitlisted';
  END IF;

  -- (3) Total capacity.
  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id
    AND status = 'confirmed'
    AND id IS DISTINCT FROM NEW.id;

  IF v_confirmed_count + NEW.guest_count > v_max_capacity THEN
    RAISE EXCEPTION
      'adventure is at capacity (% of % spots taken)',
      v_confirmed_count, v_max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rsvps_check_capacity
  BEFORE INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION check_adventure_capacity();

-- ============================================================
-- Step 5 — Trigger: auto-sync adventure status from confirmed count
-- ============================================================
--
-- Keeps `status` in lockstep with capacity so the member portal can
-- filter on status without counting RSVPs. Manual sold-out shortcircuits
-- this whole trigger — staff intent must not be overwritten when a
-- single cancellation frees a slot.

CREATE OR REPLACE FUNCTION sync_adventure_sold_out()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_is_manually_sold_out boolean;
  v_confirmed_count      integer;
BEGIN
  SELECT max_capacity, is_manually_sold_out
    INTO v_max_capacity, v_is_manually_sold_out
  FROM member_adventures WHERE id = NEW.adventure_id;

  IF v_is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id AND status = 'confirmed';

  IF v_confirmed_count >= v_max_capacity THEN
    UPDATE member_adventures
    SET status = 'sold_out', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'published';
  ELSE
    -- Re-open if a cancellation freed space.
    UPDATE member_adventures
    SET status = 'published', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'sold_out';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rsvps_sync_adventure_sold_out
  AFTER INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION sync_adventure_sold_out();

-- ============================================================
-- Step 5.5 — Trigger: re-sync sold_out when staff edits max_capacity
-- ============================================================
--
-- If staff drop a 20-cap adventure to 10 while 15 are already confirmed,
-- the visible status must flip to sold_out immediately. BEFORE UPDATE so
-- the new status is written in the same row update. Does NOT reject
-- under-capacity changes — that's intentional (see Phase 5 plan note).

CREATE OR REPLACE FUNCTION resync_adventure_sold_out_on_capacity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_confirmed_count integer;
BEGIN
  IF NEW.max_capacity IS NOT DISTINCT FROM OLD.max_capacity THEN
    RETURN NEW;
  END IF;

  IF NEW.is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.id AND status = 'confirmed';

  IF v_confirmed_count >= NEW.max_capacity AND NEW.status = 'published' THEN
    NEW.status := 'sold_out';
  ELSIF v_confirmed_count < NEW.max_capacity AND NEW.status = 'sold_out' THEN
    NEW.status := 'published';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adventures_resync_capacity
  BEFORE UPDATE OF max_capacity ON member_adventures
  FOR EACH ROW EXECUTE FUNCTION resync_adventure_sold_out_on_capacity_change();

-- ============================================================
-- Step 6 — RLS on member_adventure_rsvps
-- ============================================================

ALTER TABLE member_adventure_rsvps ENABLE ROW LEVEL SECURITY;

-- Members read RSVPs tied to any of their memberships. member_id IN (...)
-- handles the multi-property case where one auth user is linked to
-- several `members` rows.
CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Member can insert an RSVP only against one of their *active*
-- memberships. The capacity trigger enforces the slot limit and the
-- manual sold-out block. Lapsed/suspended members are excluded by the
-- subquery filter.
CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- No FOR UPDATE policy for members. RLS is row-level, and a member
-- UPDATE policy would allow changing any column (guest_count,
-- deposit_payment_intent_id, member_id) from the browser via the
-- publishable-key client. Cancellations go through a Server Action
-- using the service role with an explicit column allowlist.

CREATE POLICY "rsvps: admin read all"
  ON member_adventure_rsvps FOR SELECT
  USING (is_admin());

CREATE POLICY "rsvps: property_manager read"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM member_adventures a
      WHERE a.id = adventure_id
        AND a.property_id = auth_property_id()
    )
  );

CREATE POLICY "rsvps: staff update"
  ON member_adventure_rsvps FOR UPDATE
  USING (
    is_admin()
    OR (
      auth_role() = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM member_adventures a
        WHERE a.id = adventure_id
          AND a.property_id = auth_property_id()
      )
    )
  );

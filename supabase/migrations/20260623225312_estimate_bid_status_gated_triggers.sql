-- ============================================================
-- Status-gated availability triggers (Phase A of the
-- request-estimate → bid integration; see
-- plan/request-estimate-bid-integration.md §6/§7).
--
-- The /request-estimate front door produces a "soft" request: it
-- creates a Booking + quote-only Bid at bookings.status =
-- 'pending_review' from a provisional slot (preferred date + arrival).
-- A soft request must NEVER bounce the guest on availability, so the
-- two availability triggers are gated to SKIP enforcement while a
-- booking is 'pending_review'. Enforcement re-arms automatically when
-- staff run the slot-lock action and advance bookings.status to
-- 'awaiting_guest' in the same UPDATE (both triggers are BEFORE
-- INSERT/UPDATE), so a real double-book is still caught at lock time.
--
-- NOTE on booking status vs bid status (load-bearing — see §6 callout):
-- these triggers read bookings.status (enum: pending_review /
-- awaiting_guest / denied / signed / deposit_paid / fulfilled /
-- cancelled / expired — there is NO 'confirmed' here). confirmBid()
-- only moves bids.status → confirmed; it never touches the booking.
-- The lock action is what moves bookings.status to 'awaiting_guest',
-- which is the only thing that makes enforcement fire.
--
-- This migration ONLY rewrites two trigger function bodies with
-- CREATE OR REPLACE (preserving the existing trigger bindings — the
-- triggers themselves are not dropped/recreated). It adds NO new
-- column, makes NO change to create_public_booking's signature, and
-- introduces NO new RLS policy — so there is no policy-dependency
-- cycle to audit (CLAUDE.md rule 5 is satisfied trivially).
-- ============================================================

-- ------------------------------------------------------------
-- Trigger 2: validate start_time against time_slots
-- (CREATE OR REPLACE; binding bookings_02_validate_start_time intact)
--
-- Guard added: a 'pending_review' booking carries a PROVISIONAL slot
-- that need not exist in time_slots, so skip slot validation for it.
-- The check re-arms when the lock action sets a real start_time and
-- advances status to 'awaiting_guest' (see plan §6/§7).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_booking_start_time()
RETURNS TRIGGER AS $$
DECLARE
  v_timezone    text;
  v_day_of_week smallint;
  v_slot_start  time;
  v_slot_exists boolean;
BEGIN
  -- Soft estimate requests carry a provisional slot; do not require it
  -- to exist in time_slots. Enforcement re-arms at slot-lock time when
  -- status advances to 'awaiting_guest' (plan §6/§7).
  IF NEW.status = 'pending_review' THEN
    RETURN NEW;
  END IF;

  SELECT timezone INTO v_timezone
  FROM properties WHERE id = NEW.property_id;

  v_day_of_week := EXTRACT(DOW FROM NEW.start_time AT TIME ZONE v_timezone)::smallint;
  v_slot_start  := (NEW.start_time AT TIME ZONE v_timezone)::time;

  SELECT EXISTS (
    SELECT 1 FROM time_slots
    WHERE property_id = NEW.property_id
      AND day_of_week = v_day_of_week
      AND slot_start  = v_slot_start
      AND is_active   = true
  ) INTO v_slot_exists;

  IF NOT v_slot_exists THEN
    RAISE EXCEPTION
      'start_time % is not a valid booking slot for this property',
      NEW.start_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Trigger 3: property capacity check
-- (CREATE OR REPLACE; binding bookings_03_check_property_capacity intact)
--
-- Two guards added, both required:
--  (a) early-return for 'pending_review' — a soft request must never be
--      bounced on capacity at intake;
--  (b) exclude 'pending_review' from the concurrency SUM — a pile of
--      unconfirmed soft requests must not consume capacity and block a
--      LATER staff lock at the same time. Enforcement re-arms when the
--      lock action advances status to 'awaiting_guest' (plan §6/§7).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_property_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_concurrent integer;
  v_max        integer;
BEGIN
  -- Released statuses do not hold capacity
  IF NEW.status IN ('cancelled', 'expired', 'denied') THEN
    RETURN NEW;
  END IF;

  -- Soft estimate requests (provisional slot) skip capacity enforcement
  -- at intake; it re-arms at slot-lock when status → 'awaiting_guest'.
  IF NEW.status = 'pending_review' THEN
    RETURN NEW;
  END IF;

  SELECT max_concurrent_groups INTO v_max
  FROM properties WHERE id = NEW.property_id
  FOR UPDATE;

  SELECT COALESCE(SUM(capacity_reserved), 0) INTO v_concurrent
  FROM bookings
  WHERE property_id = NEW.property_id
    AND status NOT IN ('cancelled', 'expired', 'denied', 'pending_review')
    AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
    AND id IS DISTINCT FROM NEW.id;

  IF v_concurrent + NEW.capacity_reserved > v_max THEN
    RAISE EXCEPTION
      'property is at capacity for the requested time window (% of % units in use)',
      v_concurrent, v_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

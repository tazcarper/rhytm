-- =============================================================
-- Adventures full-payment checkout — capacity hold + payment columns.
--
-- The hold-then-pay model needs `pending_payment` RSVPs to occupy
-- capacity exactly like `confirmed` ones, so a slot is held the instant
-- checkout starts (and a second member can't pay for the same last spot).
-- Updates the three Phase 5 capacity trigger functions to count
-- confirmed + pending_payment. Adds amount_paid / paid_at for the receipt
-- and a partial index for the abandoned-hold sweep.
-- =============================================================

-- ---- (1) capacity enforcement: count confirmed + pending_payment ----
CREATE OR REPLACE FUNCTION check_adventure_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_max_guests_per_rsvp  integer;
  v_is_manually_sold_out boolean;
  v_occupied_count       integer;
BEGIN
  SELECT max_capacity, max_guests_per_rsvp, is_manually_sold_out
    INTO v_max_capacity, v_max_guests_per_rsvp, v_is_manually_sold_out
  FROM member_adventures
  WHERE id = NEW.adventure_id
  FOR UPDATE;

  -- Per-RSVP guest cap — every non-cancelled RSVP.
  IF NEW.status != 'cancelled' AND NEW.guest_count > v_max_guests_per_rsvp THEN
    RAISE EXCEPTION
      'guest_count % exceeds max_guests_per_rsvp % for this adventure',
      NEW.guest_count, v_max_guests_per_rsvp;
  END IF;

  -- Only confirmed + pending_payment consume capacity. Waitlisted /
  -- cancelled do not — skip the rest for them.
  IF NEW.status NOT IN ('confirmed', 'pending_payment') THEN
    RETURN NEW;
  END IF;

  -- Manual sold-out blocks new occupying RSVPs (must waitlist instead).
  IF v_is_manually_sold_out THEN
    RAISE EXCEPTION
      'adventure is marked sold-out by staff; new RSVPs must be waitlisted';
  END IF;

  -- Total capacity across confirmed + pending_payment. The FOR UPDATE
  -- lock above serializes concurrent inserts so two members can't both
  -- claim the last spot.
  SELECT COALESCE(SUM(guest_count), 0) INTO v_occupied_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id
    AND status IN ('confirmed', 'pending_payment')
    AND id IS DISTINCT FROM NEW.id;

  IF v_occupied_count + NEW.guest_count > v_max_capacity THEN
    RAISE EXCEPTION
      'adventure is at capacity (% of % spots taken)',
      v_occupied_count, v_max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- (2) auto-sync sold_out: count confirmed + pending_payment ----
CREATE OR REPLACE FUNCTION sync_adventure_sold_out()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_is_manually_sold_out boolean;
  v_occupied_count       integer;
BEGIN
  SELECT max_capacity, is_manually_sold_out
    INTO v_max_capacity, v_is_manually_sold_out
  FROM member_adventures WHERE id = NEW.adventure_id;

  IF v_is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_occupied_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id
    AND status IN ('confirmed', 'pending_payment');

  IF v_occupied_count >= v_max_capacity THEN
    UPDATE member_adventures
    SET status = 'sold_out', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'published';
  ELSE
    UPDATE member_adventures
    SET status = 'published', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'sold_out';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- (3) resync on staff max_capacity edit: count confirmed + pending ----
CREATE OR REPLACE FUNCTION resync_adventure_sold_out_on_capacity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_occupied_count integer;
BEGIN
  IF NEW.max_capacity IS NOT DISTINCT FROM OLD.max_capacity THEN
    RETURN NEW;
  END IF;

  IF NEW.is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_occupied_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.id
    AND status IN ('confirmed', 'pending_payment');

  IF v_occupied_count >= NEW.max_capacity AND NEW.status = 'published' THEN
    NEW.status := 'sold_out';
  ELSIF v_occupied_count < NEW.max_capacity AND NEW.status = 'sold_out' THEN
    NEW.status := 'published';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- payment columns + abandoned-hold sweep index ----
ALTER TABLE member_adventure_rsvps
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_rsvps_pending_payment
  ON member_adventure_rsvps (created_at)
  WHERE status = 'pending_payment';

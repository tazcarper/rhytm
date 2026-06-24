-- =============================================================
-- Phase 1 follow-up — atomic, lock-serialized confirmed_price mutations.
--
-- Two operations change a booking's confirmed_price by composing several writes
-- (read total → write override/line → write total → write audit). Doing that in
-- application code with separate statements has two failure modes:
--   1. Lost update — two concurrent comps (or a comp racing a manual edit) each
--      read the same confirmed_price and write absolute values; one is lost.
--   2. Partial failure — the override row inserts but the total update fails,
--      leaving a visible comp the total never reflected.
--
-- Both functions below take a `SELECT ... FOR UPDATE` lock on the booking row,
-- so every confirmed_price mutation for a booking serializes, and do all their
-- writes in ONE transaction (the function body), so a partial failure rolls the
-- whole thing back. They are the single writers the services call by RPC.
--
-- SECURITY DEFINER + SET search_path = public per CLAUDE.md RLS rule 4: they run
-- as the owner and bypass RLS (the override / event tables are service-role
-- write-only, with no INSERT/UPDATE/DELETE policy), which is exactly the privilege
-- the privileged write needs. They are GRANTed to service_role only — the
-- calling Server Actions authorize + status-gate before invoking them.
-- =============================================================

-- ---- apply_line_override: one comp, atomically ----
-- Loads the line, validates the comp (0 <= new <= original), reads the line's
-- latest prior delta, reconciles confirmed_price INCREMENTALLY
-- (incremental = newDelta − priorDelta), appends the immutable override row, and
-- appends the source='line_override' audit event — under the booking lock.
-- Returns a jsonb result the service marshals back: business-rule rejections
-- come back as { ok:false, error } (not a thrown error) so the UI shows a clean
-- message; only infrastructure failures raise.
CREATE OR REPLACE FUNCTION apply_line_override(
  p_booking_id           uuid,
  p_line_item_id         uuid,
  p_new_amount           numeric,
  p_reason               text,
  p_customer_facing_label text,
  p_actor_id             uuid,
  p_actor_email          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed      numeric(10,2);
  v_estimated      numeric(10,2);
  v_deposit        numeric(10,2);
  v_original       numeric(10,2);
  v_line_booking   uuid;
  v_effective      numeric(10,2);
  v_prior_delta    numeric(10,2);
  v_new_amount     numeric(10,2) := round(p_new_amount, 2);
  v_new_delta      numeric(10,2);
  v_incremental    numeric(10,2);
  v_new_confirmed  numeric(10,2);
  v_override_id    uuid;
BEGIN
  -- Serialize every confirmed_price mutation for this booking on the row lock.
  SELECT confirmed_price, estimated_price, deposit_amount
    INTO v_confirmed, v_estimated, v_deposit
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bid not found.');
  END IF;

  -- The line must belong to this booking.
  SELECT round(line_amount, 2), booking_id
    INTO v_original, v_line_booking
    FROM bid_line_items
    WHERE id = p_line_item_id;
  IF NOT FOUND OR v_line_booking IS DISTINCT FROM p_booking_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That line item is not part of this bid.');
  END IF;

  -- A comp only ever lowers a line (0 <= new <= original).
  IF v_new_amount > v_original + 0.005 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Comped amount can''t exceed the line''s $'
               || to_char(v_original, 'FM999999990.00') || '.'
    );
  END IF;

  v_effective := COALESCE(v_confirmed, v_estimated);
  IF v_effective IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This bid has no price to discount yet.');
  END IF;

  -- Latest prior override for this line — same deterministic order the readers
  -- use (created_at, then id as the tie-break) so reconciliation and display
  -- can never pick different "latest" rows.
  SELECT delta
    INTO v_prior_delta
    FROM bid_line_overrides
    WHERE line_item_id = p_line_item_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  v_prior_delta := COALESCE(v_prior_delta, 0);

  v_new_delta     := round(v_new_amount - v_original, 2);
  v_incremental   := round(v_new_delta - v_prior_delta, 2);
  v_new_confirmed := round(v_effective + v_incremental, 2);
  IF v_new_confirmed < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That comp would drive the total below $0.');
  END IF;

  INSERT INTO bid_line_overrides (
    booking_id, line_item_id, original_amount, new_amount,
    reason, customer_facing_label, actor_id, actor_email
  )
  VALUES (
    p_booking_id, p_line_item_id, v_original, v_new_amount,
    p_reason, p_customer_facing_label, p_actor_id, p_actor_email
  )
  RETURNING id INTO v_override_id;

  UPDATE bookings SET confirmed_price = v_new_confirmed WHERE id = p_booking_id;

  INSERT INTO bid_pricing_events (
    booking_id, source, line_override_id, old_total, new_total, actor_id, actor_email
  )
  VALUES (
    p_booking_id, 'line_override', v_override_id,
    round(v_effective, 2), v_new_confirmed, p_actor_id, p_actor_email
  );

  RETURN jsonb_build_object(
    'ok', true,
    'newConfirmedPrice', v_new_confirmed,
    -- deposit_amount is never touched here; warn when it now exceeds the total.
    'depositExceedsTotal', (v_deposit IS NOT NULL AND v_deposit > v_new_confirmed + 0.005)
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_line_override(uuid, uuid, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_line_override(uuid, uuid, numeric, text, text, uuid, text) TO service_role;

COMMENT ON FUNCTION apply_line_override(uuid, uuid, numeric, text, text, uuid, text) IS
  'Atomically apply one per-line waive/comp: validate, append the immutable '
  'override row, reconcile bookings.confirmed_price incrementally, and append a '
  'source=line_override audit event — under a FOR UPDATE lock on the booking. '
  'service_role only; the caller authorizes and status-gates first.';


-- ---- reverse_add_on_comps_and_clear: comps don't survive an add-on change ----
-- Called by rematerializeAddOnLines before it re-inserts the rebuilt add-on
-- lines. In one transaction, under the booking lock: sum the in-force comps on
-- the booking's add_on lines (latest override per line with delta < 0), restore
-- confirmed_price by that amount, append a source=auto_reversal audit event, and
-- delete the add_on lines (ON DELETE CASCADE clears their now-reversed override
-- rows). Restoring BEFORE the delete is what stops the discount being orphaned
-- on the total. Base/guest-fee lines and their overrides are untouched.
CREATE OR REPLACE FUNCTION reverse_add_on_comps_and_clear(
  p_booking_id  uuid,
  p_actor_id    uuid,
  p_actor_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed     numeric(10,2);
  v_restore_delta numeric(10,2);  -- sum of in-force add-on comp deltas (<= 0)
  v_labels        text;
  v_reversed      int;
  v_new_confirmed numeric(10,2);
BEGIN
  SELECT confirmed_price INTO v_confirmed
    FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bid not found.');
  END IF;

  -- Latest override per add_on line; count only the ones still discounting.
  WITH latest AS (
    SELECT DISTINCT ON (o.line_item_id)
           o.line_item_id, o.delta, li.label
      FROM bid_line_overrides o
      JOIN bid_line_items li ON li.id = o.line_item_id
     WHERE o.booking_id = p_booking_id
       AND li.kind = 'add_on'
     ORDER BY o.line_item_id, o.created_at DESC, o.id DESC
  )
  SELECT
    COALESCE(SUM(delta) FILTER (WHERE delta < 0), 0),
    string_agg(label, ', ') FILTER (WHERE delta < 0),
    COUNT(*) FILTER (WHERE delta < 0)
    INTO v_restore_delta, v_labels, v_reversed
    FROM latest;

  -- Restore + audit BEFORE clearing the lines, so the discount can never be
  -- left on confirmed_price after its override row cascades away.
  IF v_reversed > 0 AND v_confirmed IS NOT NULL AND v_restore_delta < 0 THEN
    v_new_confirmed := round(v_confirmed - v_restore_delta, 2);  -- subtract negative = add back
    UPDATE bookings SET confirmed_price = v_new_confirmed WHERE id = p_booking_id;

    INSERT INTO bid_pricing_events (
      booking_id, source, line_override_id, old_total, new_total,
      actor_id, actor_email, note
    )
    VALUES (
      p_booking_id, 'auto_reversal', NULL, round(v_confirmed, 2), v_new_confirmed,
      p_actor_id, p_actor_email,
      'Auto-removed comp on changed add-on(s): ' || COALESCE(v_labels, 'add-on')
    );
  END IF;

  -- Clear the add-on lines; ON DELETE CASCADE removes their (reversed) override
  -- rows. bid_pricing_events.line_override_id is ON DELETE SET NULL, so the
  -- prior events survive (the timeline keeps the totals, loses only the join).
  DELETE FROM bid_line_items
    WHERE booking_id = p_booking_id AND kind = 'add_on';

  RETURN jsonb_build_object(
    'ok', true,
    'reversedCount', v_reversed,
    'restored', COALESCE(-v_restore_delta, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION reverse_add_on_comps_and_clear(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reverse_add_on_comps_and_clear(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION reverse_add_on_comps_and_clear(uuid, uuid, text) IS
  'Atomically reverse any in-force comps on a booking''s add_on lines (restore '
  'confirmed_price + audit as source=auto_reversal) and clear those add_on '
  'lines, before rematerializeAddOnLines re-inserts the rebuilt set. Under a '
  'FOR UPDATE lock; service_role only.';

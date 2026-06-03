-- ============================================================
-- App 7 (homegrown waiver) — record_bid_signature: idempotency before gate
-- ============================================================
-- A live test (project RLS rule #6) showed that calling the RPC on an
-- already-signed bid RAISED "not signable (status=signed)" instead of
-- returning first_stamp = false. The signable-status gate ran before the
-- already-signed check, so a concurrent race-loser (whose bid is now
-- 'signed') tripped the gate and got an error rather than a graceful
-- "already signed" no-op.
--
-- Fix: check signed_at FIRST. If already signed, no-op and report
-- first_stamp = false. The signable-status gate now only applies to a bid
-- that has not been signed yet. Behavior for the common path is unchanged.
--
-- No data-safety change — the FOR UPDATE lock + the signed_at guard always
-- prevented double-stamping; this only makes the loser's RESPONSE graceful
-- so the coordinator can return "already signed" instead of a generic
-- error.

CREATE OR REPLACE FUNCTION record_bid_signature(
  p_bid_id            uuid,
  p_template_id       uuid,
  p_blob_url          text,
  p_blob_pathname     text,
  p_pdf_sha256        text,
  p_signed_name       text,
  p_signed_ip         inet,
  p_signed_user_agent text,
  p_signer_user_id    uuid
)
RETURNS TABLE (
  first_stamp    boolean,
  booking_id     uuid,
  paid_at        timestamptz,
  deposit_amount numeric,
  start_time     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid   bids%ROWTYPE;
  v_first boolean := false;
BEGIN
  -- Lock the bid; serializes concurrent signing attempts. CORRECTNESS:
  -- this SELECT must carry FOR UPDATE and must precede the signed_at
  -- branch below. Idempotency under concurrency rests on the losing caller
  -- blocking on the lock, then re-reading the committed signed_at once the
  -- winner commits. Reordering (reading v_bid before the lock) breaks it.
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_bid_signature: bid % not found', p_bid_id;
  END IF;

  -- Already-signed check FIRST (idempotent / race-loser path): no-op and
  -- report first_stamp = false. Must come before the signable gate so a
  -- second signer of a now-'signed' bid returns gracefully.
  IF v_bid.signed_at IS NULL THEN
    -- Not yet signed: it must be in a signable status to proceed.
    IF v_bid.status NOT IN ('confirmed', 'paid') THEN
      RAISE EXCEPTION 'record_bid_signature: bid % not signable (status=%)',
        p_bid_id, v_bid.status;
    END IF;

    v_first := true;

    INSERT INTO waiver_documents (
      bid_id, waiver_template_id, blob_url, blob_pathname, pdf_sha256,
      signed_name, signed_ip, signed_user_agent, signer_user_id
    ) VALUES (
      p_bid_id, p_template_id, p_blob_url, p_blob_pathname, p_pdf_sha256,
      p_signed_name, p_signed_ip, p_signed_user_agent, p_signer_user_id
    );

    -- Stamp the canonical signal (does not touch status -> sync trigger
    -- does not fire here).
    UPDATE bids SET signed_at = now() WHERE id = p_bid_id;

    -- Guarded advance: confirmed -> signed only. A 'paid' bid matches 0
    -- rows, so the status trigger never fires for it.
    UPDATE bids SET status = 'signed'
      WHERE id = p_bid_id AND status = 'confirmed';
  END IF;

  RETURN QUERY
    SELECT v_first, bk.id, b.paid_at, bk.deposit_amount, bk.start_time
    FROM bids b
    JOIN bookings bk ON bk.id = b.booking_id
    WHERE b.id = p_bid_id;
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL, but re-assert the
-- service-role-only lockdown so a from-scratch replay is correct
-- regardless of migration ordering.
REVOKE ALL ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) TO service_role;

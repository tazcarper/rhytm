-- ============================================================
-- App 7 (homegrown waiver) — Phase 1: data layer
-- ============================================================
-- Supersedes the Dropbox Sign e-sign integration with an in-house,
-- typed-signature waiver. The vendor path is kept + deprecated behind a
-- WAIVER_PROVIDER switch (later phase); nothing here removes it.
--
-- This migration introduces:
--   1. waiver_templates   — config-in-DB waiver text, versioned, one
--                           active row per property (admin-editable).
--   2. waiver_documents   — the signed PDF artifact + legal audit trail,
--                           one row per bid.
--   3. record_bid_signature(...) — the ATOMIC write that the synchronous
--                           signing Server Action calls: insert artifact,
--                           stamp bids.signed_at (idempotent), guarded
--                           status advance. Returns the finalization
--                           context the Inngest emitter needs.
--
-- CONTRACT PRESERVED: bids.signed_at stays the canonical "signed" signal.
-- The guarded `confirmed -> signed` advance reproduces exactly what the
-- Dropbox Sign webhook did (handle-signature-event.ts onSigned), so the
-- sync_booking_from_bid trigger sees an identical transition. A `paid`
-- bid matches 0 rows on the guarded UPDATE, so the AFTER UPDATE OF status
-- trigger never fires for it (no awaiting_guest RAISE) — same as today.
--
-- RLS NOTES (per project RLS rules):
--   - All auth.jwt()/auth.uid() reads are wrapped in (SELECT …) to force
--     an InitPlan (evaluated once per query, not per row).
--   - waiver_documents has NO write policy: it is written ONLY by the
--     SECURITY DEFINER RPC (owned by postgres, bypasses RLS) and by the
--     service-role signing path. Authenticated clients cannot insert.
--   - waiver_documents is a leaf table (nothing references it), so its
--     read policy's bids→bookings EXISTS traverses one direction only —
--     no policy dependency cycle is introduced.

-- ============================================================
-- 1. waiver_templates — config-in-DB, versioned
-- ============================================================
CREATE TABLE waiver_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid        NOT NULL REFERENCES properties(id),
  version       integer     NOT NULL,
  title         text        NOT NULL,
  body          text        NOT NULL,   -- legal waiver text (markdown)
  consent_text  text        NOT NULL,   -- e-sign consent disclosure shown at signing
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid        REFERENCES auth.users(id),  -- admin auth.uid() who saved this version
  UNIQUE (property_id, version)
);

-- Exactly one active template per property, enforced at the DB level.
-- saveWaiverTemplate (a later phase) inserts a new version then flips the
-- prior row's is_active to false inside one transaction.
CREATE UNIQUE INDEX waiver_templates_one_active_per_property
  ON waiver_templates (property_id)
  WHERE is_active;

ALTER TABLE waiver_templates ENABLE ROW LEVEL SECURITY;

-- Staff may read the template (admins edit; property_manager views what
-- guests at their property are asked to sign). The signing path itself
-- reads via the service-role client, which bypasses RLS.
CREATE POLICY "waiver_templates: staff read"
  ON waiver_templates FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
      IN ('super_admin', 'admin', 'property_manager')
  );

-- Only super_admin / admin author or version templates.
CREATE POLICY "waiver_templates: admin insert"
  ON waiver_templates FOR INSERT
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

CREATE POLICY "waiver_templates: admin update"
  ON waiver_templates FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- ============================================================
-- 2. waiver_documents — signed artifact + legal audit trail
-- ============================================================
CREATE TABLE waiver_documents (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id             uuid        NOT NULL UNIQUE REFERENCES bids(id),
  waiver_template_id uuid        NOT NULL REFERENCES waiver_templates(id),  -- exact version signed
  blob_url           text        NOT NULL,   -- Vercel Blob URL; SERVER-ONLY secret, never sent to browser
  blob_pathname      text        NOT NULL,
  pdf_sha256         text        NOT NULL,    -- tamper-evidence: hash of the stored bytes
  signed_name        text        NOT NULL,    -- typed legal name, frozen snapshot (cf. guest_name)
  signed_ip          inet,
  signed_user_agent  text,
  signer_user_id     uuid        REFERENCES auth.users(id),  -- auth.uid() if a member signed, else NULL (guest)
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE waiver_documents ENABLE ROW LEVEL SECURITY;

-- Admins read every waiver.
CREATE POLICY "waiver_documents: admin read"
  ON waiver_documents FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- property_manager reads waivers for bids whose booking is at their
-- assigned property. Leaf-table, one-directional EXISTS (waiver_documents
-- -> bids -> bookings) — introduces no policy cycle.
CREATE POLICY "waiver_documents: property_manager read"
  ON waiver_documents FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND EXISTS (
      SELECT 1
      FROM bids b
      JOIN bookings bk ON bk.id = b.booking_id
      WHERE b.id = waiver_documents.bid_id
        AND bk.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- NB: no INSERT/UPDATE/DELETE policies. Writes happen exclusively through
-- record_bid_signature (SECURITY DEFINER, bypasses RLS) and the
-- service-role signing path. With RLS enabled and no write policy,
-- authenticated/anon clients cannot mutate this table.

-- ============================================================
-- 3. record_bid_signature(...) — atomic signing write
-- ============================================================
-- SECURITY DEFINER so a single call performs the artifact insert + the
-- guarded bids mutations transactionally. SET search_path = public guards
-- against search_path attacks (the function bypasses RLS — it is owned by
-- postgres). EXECUTE is granted to service_role ONLY: the signing Server
-- Action validates the bid access code (validate_bid_access_code) BEFORE
-- calling this, and clients can never invoke it directly.
--
-- Idempotency + races: the bid row is locked FOR UPDATE. Only the first
-- caller to find signed_at IS NULL performs the insert/stamp/advance and
-- returns first_stamp = true; concurrent/duplicate callers serialize on
-- the lock, observe signed_at set, and return first_stamp = false (the
-- caller then cleans up the orphan Blob it just uploaded). The
-- UNIQUE(bid_id) on waiver_documents is a second line of defense.
--
-- Returns the finalization context (booking_id, paid_at, deposit_amount,
-- start_time) so the bid/signed + booking/confirmed Inngest emitter needs
-- no follow-up query.

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

  -- Only confirmed or paid bids are signable. (pending_review/denied/
  -- expired/refunded are not.)
  IF v_bid.status NOT IN ('confirmed', 'paid') THEN
    RAISE EXCEPTION 'record_bid_signature: bid % not signable (status=%)',
      p_bid_id, v_bid.status;
  END IF;

  -- First signing only: write artifact, stamp signed_at, advance status.
  IF v_bid.signed_at IS NULL THEN
    v_first := true;

    INSERT INTO waiver_documents (
      bid_id, waiver_template_id, blob_url, blob_pathname, pdf_sha256,
      signed_name, signed_ip, signed_user_agent, signer_user_id
    ) VALUES (
      p_bid_id, p_template_id, p_blob_url, p_blob_pathname, p_pdf_sha256,
      p_signed_name, p_signed_ip, p_signed_user_agent, p_signer_user_id
    );

    -- Stamp the canonical signal. Does not touch status, so the
    -- sync_booking_from_bid (AFTER UPDATE OF status) trigger does not fire.
    UPDATE bids SET signed_at = now() WHERE id = p_bid_id;

    -- Guarded advance: confirmed -> signed only. A `paid` bid matches 0
    -- rows here, so the status trigger never fires for it (no regression,
    -- no awaiting_guest RAISE). Mirrors the Dropbox Sign webhook exactly.
    UPDATE bids SET status = 'signed'
      WHERE id = p_bid_id AND status = 'confirmed';
  END IF;

  -- Finalization context (re-read for the freshest paid_at).
  RETURN QUERY
    SELECT v_first, bk.id, b.paid_at, bk.deposit_amount, bk.start_time
    FROM bids b
    JOIN bookings bk ON bk.id = b.booking_id
    WHERE b.id = p_bid_id;
END;
$$;

-- Lock down EXECUTE: service-role only (server-side signing path).
REVOKE ALL ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) TO service_role;

-- ============================================================
-- 4. Seed a starter template per property (version 1, active)
-- ============================================================
-- Placeholder liability-waiver text so signing works day one. Admins edit
-- it via the template editor (a later phase); each edit creates a new
-- version and the signed PDF freezes whichever version it used.
INSERT INTO waiver_templates (property_id, version, title, body, consent_text)
SELECT
  p.id,
  1,
  'Liability Waiver & Release — ' || p.name,
  'ASSUMPTION OF RISK, WAIVER AND RELEASE OF LIABILITY'
    || E'\n\n'
    || 'I acknowledge that participation in outdoor shooting-sports and '
    || 'related activities at ' || p.name || ' involves inherent risks, '
    || 'including the risk of serious bodily injury, and I voluntarily '
    || 'assume all such risks. In consideration of being permitted to '
    || 'participate, I, for myself and my heirs, release and hold harmless '
    || p.name || ', its owners, staff, and agents from any and all '
    || 'liability, claims, or demands arising out of my participation, to '
    || 'the fullest extent permitted by law. I confirm that the '
    || 'information I have provided is accurate and that I am signing this '
    || 'release knowingly and voluntarily.',
  'I agree that typing my name below constitutes my electronic signature, '
    || 'that it is the legal equivalent of my handwritten signature, and '
    || 'that I consent to sign this waiver electronically.'
FROM properties p;

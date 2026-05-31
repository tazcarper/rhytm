// ⚠️ DEPRECATED — Dropbox Sign waiver path (App 7).
// Superseded by the in-house typed-signature waiver (src/services/waiver/*).
// Kept INTACT as a revivable fallback — NOT deleted. Dormant unless
// WAIVER_PROVIDER=dropbox_sign (see lib/waiver/provider.ts). Don't extend;
// revival steps in src/services/dropbox-sign/DEPRECATED.md.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SignatureRequestCreateEmbeddedWithTemplateRequest } from "@dropbox/sign";
import { createDropboxSignClients } from "@/lib/dropbox-sign/server";

// Create the embedded signature envelope for a bid. Idempotent:
//   - If `bids.dropbox_sign_envelope_id` is already set, return the
//     existing envelope id (no API call).
//   - Otherwise call Dropbox Sign's
//     `signatureRequestCreateEmbeddedWithTemplate` and persist the
//     returned signature_request_id.
//
// Called from the `confirmBid` Server Action via `after()` so envelope
// creation runs post-response (doesn't block the admin "Confirm" click).
//
// Dormant when env not configured: returns
// `{ ok: false, reason: 'disabled' }` if any of:
//   - `DROPBOX_SIGN_API_KEY` is missing (the client factory returns
//     null)
//   - `DROPBOX_SIGN_TEMPLATE_ID` is missing (no template to bind to)
//   - `DROPBOX_SIGN_CLIENT_ID` is missing (embedded requires it)
// Callers log the dormant return + move on. The bid is still confirmed
// in the DB; just no signing flow until activation.

export type CreateSignatureEnvelopeResult =
  | { ok: true; envelopeId: string; reused: boolean }
  | {
      ok: false;
      reason: "disabled" | "bid_not_found" | "api_error" | "db_error";
      message: string;
    };

export interface CreateSignatureEnvelopeContext {
  supabase: SupabaseClient;
  bidId: string;
}

type BidWithBookingRow = {
  id: string;
  dropbox_sign_envelope_id: string | null;
  bookings: {
    guest_name: string;
    guest_email: string;
    start_time: string;
    properties: { name: string } | null;
  } | null;
};

export async function createSignatureEnvelope(
  ctx: CreateSignatureEnvelopeContext,
): Promise<CreateSignatureEnvelopeResult> {
  const { supabase, bidId } = ctx;

  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  const templateId = process.env.DROPBOX_SIGN_TEMPLATE_ID;
  // Single source for the client ID — public by design (it's exposed
  // to the browser bundle for the hellosign-embedded SDK). Same value
  // works server-side; no need for a parallel non-public env var.
  const clientId = process.env.NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID;

  if (!apiKey || !templateId || !clientId) {
    return {
      ok: false,
      reason: "disabled",
      message:
        "Dropbox Sign is not configured (API key + template id + client id required). App 7 is dormant.",
    };
  }

  const clients = createDropboxSignClients();
  if (!clients) {
    // Belt-and-suspenders — the env check above already covered this.
    return {
      ok: false,
      reason: "disabled",
      message: "Dropbox Sign client factory returned null.",
    };
  }

  // 1. Load the bid + guest details. Idempotency check: if an envelope
  //    id is already on file, we're done.
  const { data: bid, error: fetchErr } = await supabase
    .from("bids")
    .select(
      `id, dropbox_sign_envelope_id,
       bookings ( guest_name, guest_email, start_time, properties ( name ) )`,
    )
    .eq("id", bidId)
    .maybeSingle<BidWithBookingRow>();

  if (fetchErr) {
    return {
      ok: false,
      reason: "db_error",
      message: `Couldn't load bid: ${fetchErr.message}`,
    };
  }
  if (!bid || !bid.bookings || !bid.bookings.properties) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "Bid not found or missing booking/property data.",
    };
  }

  if (bid.dropbox_sign_envelope_id) {
    return {
      ok: true,
      envelopeId: bid.dropbox_sign_envelope_id,
      reused: true,
    };
  }

  const booking = bid.bookings;
  // Re-narrow inside the closure scope — TS doesn't carry the earlier
  // `!bid.bookings.properties` guard through to the local `booking`
  // binding.
  const property = booking.properties;
  if (!property) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "Booking has no property attached.",
    };
  }

  // 2. Build the request. Template-driven: signer "role" must match
  //    the role name on the Dropbox Sign template. We assume "Guest"
  //    as the canonical signer role — the client should match this
  //    when uploading the template, or we'll need to make this
  //    configurable later.
  const req = new SignatureRequestCreateEmbeddedWithTemplateRequest();
  req.templateIds = [templateId];
  req.clientId = clientId;
  req.signers = [
    {
      role: "Guest",
      name: booking.guest_name,
      emailAddress: booking.guest_email,
    },
  ];
  req.subject = `Waiver — ${property.name}`;
  req.message = `Please sign your waiver for ${property.name}.`;
  req.metadata = {
    bid_id: bid.id,
  };
  // Test mode: free dev iteration. Toggle to live by setting
  // DROPBOX_SIGN_TEST_MODE=0 in env (or just unset; default test=on).
  req.testMode = process.env.DROPBOX_SIGN_TEST_MODE !== "0";

  // 3. Hit the API.
  let signatureRequestId: string;
  try {
    const response =
      await clients.signatureRequest.signatureRequestCreateEmbeddedWithTemplate(
        req,
      );
    const id = response.body.signatureRequest?.signatureRequestId;
    if (!id) {
      return {
        ok: false,
        reason: "api_error",
        message: "Dropbox Sign returned no signature_request_id.",
      };
    }
    signatureRequestId = id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dropbox Sign API call failed.";
    console.error("[dropbox-sign/create-envelope] API call failed", {
      bidId,
      message,
    });
    return {
      ok: false,
      reason: "api_error",
      message,
    };
  }

  // 4. Persist. UNIQUE partial index on dropbox_sign_envelope_id (Phase
  //    3) means a concurrent second call would lose the race; we'd see
  //    a constraint error and the caller would log. Same envelope id
  //    would be returned on retry.
  const { error: updateErr } = await supabase
    .from("bids")
    .update({ dropbox_sign_envelope_id: signatureRequestId })
    .eq("id", bidId)
    .is("dropbox_sign_envelope_id", null);

  if (updateErr) {
    console.error(
      "[dropbox-sign/create-envelope] DB write failed after API success",
      { bidId, signatureRequestId, message: updateErr.message },
    );
    return {
      ok: false,
      reason: "db_error",
      message: `Envelope created in Dropbox Sign (${signatureRequestId}) but DB write failed: ${updateErr.message}. Reach out to engineering.`,
    };
  }

  return {
    ok: true,
    envelopeId: signatureRequestId,
    reused: false,
  };
}

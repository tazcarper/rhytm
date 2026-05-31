import type { SupabaseClient } from "@supabase/supabase-js";
import type { WaiverStorage } from "@/lib/storage/waiver-storage";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { getActiveWaiverTemplate } from "./get-active-waiver-template";
import { renderWaiverPdf } from "./render-waiver-pdf";
import { storeWaiverPdf } from "./store-waiver-pdf";
import { emitSignedSideEffects } from "./emit-signed-side-effects";

// The synchronous signing use case — the in-house analog of the old
// Dropbox Sign onSigned. It coordinates; every step is delegated to a
// single-purpose collaborator:
//
//   validate access code -> load template -> render PDF -> store ->
//   record_bid_signature (atomic DB write) -> emit side effects.
//
// It takes its infrastructure (a service-role Supabase client + the waiver
// storage adapter) as injected dependencies and never instantiates them.
// bids.signed_at stays the canonical "signed" signal; this path stamps it
// through the RPC and adds the artifact alongside.

export interface SignWaiverInput {
  bidSlug: string;
  bidAccessCode: string;
  signedName: string;
  signedIp: string | null;
  signedUserAgent: string | null;
  signerUserId: string | null;
}

export type RecordSignatureResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "bid_not_found"
        | "not_signable"
        | "already_signed"
        | "template_missing"
        | "error";
      message: string;
    };

export interface RecordSignatureDeps {
  supabase: SupabaseClient; // service-role
  storage: WaiverStorage;
}

type ValidatedBid = {
  id: string;
  booking_id: string;
  status: string;
  signed_at: string | null;
};

type BookingRow = {
  id: string;
  start_time: string;
  property_id: string;
  properties: { name: string; timezone: string } | null;
};

type SignatureOutcome = {
  first_stamp: boolean;
  booking_id: string;
  paid_at: string | null;
  deposit_amount: number | string | null;
  start_time: string;
};

export async function recordSignature(
  deps: RecordSignatureDeps,
  input: SignWaiverInput,
): Promise<RecordSignatureResult> {
  const { supabase, storage } = deps;

  // 1. Same access-code gate as the bid-page read path. Never trust a
  //    slug alone.
  const { data: bidRows, error: validateErr } = await supabase.rpc(
    "validate_bid_access_code",
    { p_slug: input.bidSlug, p_code: input.bidAccessCode },
  );
  if (validateErr) {
    return { ok: false, reason: "error", message: "Couldn't verify your bid. Try again." };
  }
  const bid = (Array.isArray(bidRows) ? bidRows[0] : undefined) as
    | ValidatedBid
    | undefined;
  if (!bid) {
    return { ok: false, reason: "bid_not_found", message: "We couldn't find this bid." };
  }

  // 2. Cheap pre-check before rendering/uploading. The RPC re-checks
  //    authoritatively under a row lock — this just avoids wasted work and
  //    avoids overwriting an existing artifact.
  if (bid.signed_at) {
    return { ok: false, reason: "already_signed", message: "This waiver is already signed." };
  }
  if (bid.status !== "confirmed" && bid.status !== "paid") {
    return { ok: false, reason: "not_signable", message: "This bid can't be signed right now." };
  }

  // 3. Booking + property (for the template lookup and the date label).
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, start_time, property_id, properties ( name, timezone )")
    .eq("id", bid.booking_id)
    .maybeSingle<BookingRow>();
  if (bookingErr || !booking || !booking.properties) {
    return { ok: false, reason: "error", message: "Couldn't load booking details." };
  }

  // 4. Active waiver template for the property.
  const template = await getActiveWaiverTemplate(supabase, booking.property_id);
  if (!template) {
    return {
      ok: false,
      reason: "template_missing",
      message: "No waiver is configured for this property yet. Please contact us.",
    };
  }

  // 5. Render the PDF.
  const signedAtIso = new Date().toISOString();
  const signedDateLabel = `${formatDateLongTz(
    signedAtIso,
    booking.properties.timezone,
  )} at ${formatSlotLabelTz(signedAtIso, booking.properties.timezone)} CT`;
  const auditLines = [
    `Signed electronically by ${input.signedName} on ${signedDateLabel}.`,
    input.signedIp ? `Signer IP: ${input.signedIp}` : "Signer IP: not recorded.",
    `Typed-name electronic signature; consent (waiver v${template.version}) recorded at signing.`,
  ];

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderWaiverPdf({
      title: template.title,
      body: template.body,
      signedName: input.signedName,
      signedDateLabel,
      auditLines,
    });
  } catch (err) {
    console.error("[waiver/record-signature] render failed", { bidId: bid.id, err });
    return { ok: false, reason: "error", message: "Couldn't generate your waiver. Try again." };
  }

  // 6. Store to the private bucket (random path — never overwrites).
  let stored;
  try {
    stored = await storeWaiverPdf(storage, bid.id, pdfBytes);
  } catch (err) {
    console.error("[waiver/record-signature] store failed", { bidId: bid.id, err });
    return { ok: false, reason: "error", message: "Couldn't save your waiver. Try again." };
  }

  // 7. Atomic write: artifact row + signed_at stamp + guarded status
  //    advance, all in one RPC under a row lock.
  const { data: rpcRows, error: rpcErr } = await supabase.rpc(
    "record_bid_signature",
    {
      p_bid_id: bid.id,
      p_template_id: template.id,
      p_blob_url: stored.reference,
      p_blob_pathname: stored.path,
      p_pdf_sha256: stored.sha256,
      p_signed_name: input.signedName,
      p_signed_ip: input.signedIp,
      p_signed_user_agent: input.signedUserAgent,
      p_signer_user_id: input.signerUserId,
    },
  );
  if (rpcErr) {
    await storage.remove(stored.path).catch(() => {});
    console.error("[waiver/record-signature] RPC failed", {
      bidId: bid.id,
      message: rpcErr.message,
    });
    return { ok: false, reason: "error", message: "Couldn't finalize your signature. Try again." };
  }

  const outcome = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | SignatureOutcome
    | undefined;
  if (!outcome) {
    await storage.remove(stored.path).catch(() => {});
    return { ok: false, reason: "error", message: "Couldn't finalize your signature. Try again." };
  }

  // 8. Lost the race — another submission stamped signed_at first. Clean up
  //    the orphan we just uploaded; the original artifact is untouched.
  if (!outcome.first_stamp) {
    await storage.remove(stored.path).catch(() => {});
    return { ok: false, reason: "already_signed", message: "This waiver is already signed." };
  }

  // 9. Side effects. Coerce deposit_amount string-or-number (PostgREST can
  //    return a numeric column as a string).
  const depositAmount =
    typeof outcome.deposit_amount === "string"
      ? parseFloat(outcome.deposit_amount)
      : (outcome.deposit_amount ?? 0);

  await emitSignedSideEffects({
    bidId: bid.id,
    bookingId: outcome.booking_id,
    signedAt: signedAtIso,
    paidAt: outcome.paid_at,
    depositAmount,
    startTime: outcome.start_time,
  });

  return { ok: true };
}

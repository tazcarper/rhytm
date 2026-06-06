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

// Staff-initiated, on-site waiver signing for a booking's bid. Same finalize
// path as guest signing (record_bid_signature → signed_at + guarded status
// advance + side effects), but authorized by staff identity instead of the
// bid access code. The caller (admin sign action) MUST verify the staff
// member may act on this bid before calling. Reuses the same render/store/
// RPC building blocks as recordSignature.

export interface StaffSignInput {
  bidId: string;
  signedName: string;
  signedIp: string | null;
  signedUserAgent: string | null;
}

export type StaffSignResult =
  | { ok: true }
  | {
      ok: false;
      reason: "bid_not_found" | "not_signable" | "already_signed" | "template_missing" | "error";
      message: string;
    };

interface BidRow {
  id: string;
  booking_id: string;
  status: string;
  signed_at: string | null;
}
interface BookingRow {
  id: string;
  start_time: string;
  property_id: string;
  properties: { name: string; timezone: string } | null;
}
interface SignatureOutcome {
  first_stamp: boolean;
  booking_id: string;
  paid_at: string | null;
  deposit_amount: number | string | null;
  start_time: string;
}

export async function recordStaffBidSignature(
  deps: { supabase: SupabaseClient; storage: WaiverStorage },
  input: StaffSignInput,
): Promise<StaffSignResult> {
  const { supabase, storage } = deps;

  const { data: bid } = await supabase
    .from("bids")
    .select("id, booking_id, status, signed_at")
    .eq("id", input.bidId)
    .maybeSingle<BidRow>();
  if (!bid) {
    return { ok: false, reason: "bid_not_found", message: "We couldn't find this booking's bid." };
  }
  if (bid.signed_at) {
    return { ok: false, reason: "already_signed", message: "This waiver is already signed." };
  }
  if (bid.status !== "confirmed" && bid.status !== "paid") {
    return {
      ok: false,
      reason: "not_signable",
      message: "This bid isn't ready to sign — confirm it first.",
    };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, start_time, property_id, properties ( name, timezone )")
    .eq("id", bid.booking_id)
    .maybeSingle<BookingRow>();
  if (!booking || !booking.properties) {
    return { ok: false, reason: "error", message: "Couldn't load booking details." };
  }

  const template = await getActiveWaiverTemplate(supabase, booking.property_id);
  if (!template) {
    return {
      ok: false,
      reason: "template_missing",
      message: "No waiver is configured for this property yet.",
    };
  }

  const signedAtIso = new Date().toISOString();
  const signedDateLabel = `${formatDateLongTz(signedAtIso, booking.properties.timezone)} at ${formatSlotLabelTz(
    signedAtIso,
    booking.properties.timezone,
  )} CT`;
  const auditLines = [
    `Signed electronically in person by ${input.signedName} on ${signedDateLabel}.`,
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
    console.error("[waiver/staff-sign] render failed", { bidId: bid.id, err });
    return { ok: false, reason: "error", message: "Couldn't generate the waiver. Try again." };
  }

  let stored;
  try {
    stored = await storeWaiverPdf(storage, bid.id, pdfBytes);
  } catch (err) {
    console.error("[waiver/staff-sign] store failed", { bidId: bid.id, err });
    return { ok: false, reason: "error", message: "Couldn't save the waiver. Try again." };
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc("record_bid_signature", {
    p_bid_id: bid.id,
    p_template_id: template.id,
    p_blob_url: stored.reference,
    p_blob_pathname: stored.path,
    p_pdf_sha256: stored.sha256,
    p_signed_name: input.signedName,
    p_signed_ip: input.signedIp,
    p_signed_user_agent: input.signedUserAgent,
    p_signer_user_id: null,
  });
  if (rpcErr) {
    await storage.remove(stored.path).catch(() => {});
    console.error("[waiver/staff-sign] RPC failed", { bidId: bid.id, message: rpcErr.message });
    return { ok: false, reason: "error", message: "Couldn't finalize the signature. Try again." };
  }

  const outcome = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as SignatureOutcome | undefined;
  if (!outcome) {
    await storage.remove(stored.path).catch(() => {});
    return { ok: false, reason: "error", message: "Couldn't finalize the signature. Try again." };
  }
  if (!outcome.first_stamp) {
    await storage.remove(stored.path).catch(() => {});
    return { ok: false, reason: "already_signed", message: "This waiver is already signed." };
  }

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

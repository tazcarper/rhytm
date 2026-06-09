import type { SupabaseClient } from "@supabase/supabase-js";
import type { WaiverStorage } from "@/lib/storage/waiver-storage";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { getActiveWaiverTemplate } from "./get-active-waiver-template";
import { renderWaiverPdf } from "./render-waiver-pdf";
import { storeWaiverPdf } from "./store-waiver-pdf";

// Records a standalone (no-booking) waiver — a walk-in signing at a
// property. Mirrors the render/store half of recordSignature but skips the
// bid RPC entirely: there's no booking to advance, so it just inserts the
// signed artifact. Takes injected infrastructure (service-role client +
// storage adapter), same as the bid path.

export interface RecordStandaloneInput {
  propertyId: string;
  signedName: string;
  signerEmail: string;
  signedIp: string | null;
  signedUserAgent: string | null;
  collectedByAdminId: string | null;
  // Set for QR scan-to-sign party waivers — associates the waiver with a
  // booking (multiple allowed). Null for a pure walk-in (no booking).
  bookingId?: string | null;
}

export type RecordStandaloneResult =
  | { ok: true }
  | { ok: false; reason: "property_missing" | "template_missing" | "error"; message: string };

interface PropertyRow {
  id: string;
  name: string;
  timezone: string;
}

export async function recordStandaloneSignature(
  deps: { supabase: SupabaseClient; storage: WaiverStorage },
  input: RecordStandaloneInput,
): Promise<RecordStandaloneResult> {
  const { supabase, storage } = deps;

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, timezone")
    .eq("id", input.propertyId)
    .maybeSingle<PropertyRow>();
  if (!property) {
    return { ok: false, reason: "property_missing", message: "We couldn't find that property." };
  }

  const template = await getActiveWaiverTemplate(supabase, input.propertyId);
  if (!template) {
    return {
      ok: false,
      reason: "template_missing",
      message: "No waiver is configured for this property yet. Please ask a staff member.",
    };
  }

  const signedAtIso = new Date().toISOString();
  const signedDateLabel = `${formatDateLongTz(signedAtIso, property.timezone)} at ${formatSlotLabelTz(
    signedAtIso,
    property.timezone,
  )} CT`;
  const auditLines = [
    `Signed electronically by ${input.signedName} (${input.signerEmail}) on ${signedDateLabel}.`,
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
    console.error("[waiver/record-standalone] render failed", { propertyId: input.propertyId, err });
    return { ok: false, reason: "error", message: "Couldn't generate the waiver. Try again." };
  }

  let stored;
  try {
    stored = await storeWaiverPdf(storage, `standalone/${input.propertyId}`, pdfBytes);
  } catch (err) {
    console.error("[waiver/record-standalone] store failed", { propertyId: input.propertyId, err });
    return { ok: false, reason: "error", message: "Couldn't save the waiver. Try again." };
  }

  const { error } = await supabase.from("waiver_documents").insert({
    bid_id: null,
    booking_id: input.bookingId ?? null,
    property_id: input.propertyId,
    waiver_template_id: template.id,
    blob_url: stored.reference,
    blob_pathname: stored.path,
    pdf_sha256: stored.sha256,
    signed_name: input.signedName,
    signer_email: input.signerEmail,
    signed_ip: input.signedIp,
    signed_user_agent: input.signedUserAgent,
    collected_by_admin_id: input.collectedByAdminId,
  });
  if (error) {
    await storage.remove(stored.path).catch(() => {});
    console.error("[waiver/record-standalone] insert failed", {
      propertyId: input.propertyId,
      message: error.message,
    });
    return { ok: false, reason: "error", message: "Couldn't finalize the signature. Try again." };
  }

  return { ok: true };
}

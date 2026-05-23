"use server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getEmbeddedSignUrl } from "@/src/services/dropbox-sign/get-embedded-sign-url";

// Thin Server Action wrapper for the customer-facing signature form.
// Validates the (slug, accessCode) pair via the same SECURITY DEFINER
// RPC the bid page uses (`validate_bid_access_code`) before returning
// the URL — never expose a sign URL based on slug alone.

export type GetSignUrlResult =
  | { ok: true; signUrl: string; expiresAt: number }
  | {
      ok: false;
      reason:
        | "bid_not_found"
        | "no_envelope"
        | "already_signed" // envelope is signed at Dropbox Sign; our DB will catch up via webhook
        | "declined"
        | "disabled"
        | "api_error";
      message: string;
    };

export async function getSignUrlAction(
  bidSlug: string,
  bidAccessCode: string,
): Promise<GetSignUrlResult> {
  if (!bidSlug.trim() || !bidAccessCode.trim()) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "We couldn't find this bid.",
    };
  }

  const supabase = createServiceRoleClient();

  // Same access-code gate as the bid-page read path.
  const { data: bidRows, error: bidErr } = await supabase.rpc(
    "validate_bid_access_code",
    { p_slug: bidSlug, p_code: bidAccessCode },
  );
  if (bidErr) {
    return {
      ok: false,
      reason: "api_error",
      message: "Couldn't open the signing form. Try again in a moment.",
    };
  }
  const bid = Array.isArray(bidRows) ? bidRows[0] : undefined;
  if (!bid) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "We couldn't find this bid.",
    };
  }
  if (!bid.dropbox_sign_envelope_id) {
    return {
      ok: false,
      reason: "no_envelope",
      message: "Your waiver isn't ready yet. Refresh in a moment.",
    };
  }

  const result = await getEmbeddedSignUrl({
    envelopeId: bid.dropbox_sign_envelope_id,
  });

  switch (result.kind) {
    case "available":
      return {
        ok: true,
        signUrl: result.signUrl,
        expiresAt: result.expiresAt,
      };
    case "already_signed":
      return {
        ok: false,
        reason: "already_signed",
        message:
          "Your signature is in. Refresh in a moment — we're finalizing your bid.",
      };
    case "declined":
      return {
        ok: false,
        reason: "declined",
        message:
          "This waiver was declined. Contact us to issue a fresh one.",
      };
    case "disabled":
      return {
        ok: false,
        reason: "disabled",
        message:
          "Signing isn't available right now. Contact us to finalize.",
      };
    case "error":
      return {
        ok: false,
        reason: "api_error",
        message:
          "Couldn't open the signing form. Try again in a moment.",
      };
  }
}

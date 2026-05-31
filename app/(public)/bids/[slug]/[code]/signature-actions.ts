"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";
import {
  recordSignature,
  type RecordSignatureResult,
} from "@/src/services/waiver/record-signature";
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

// --- Homegrown waiver signing (App 7 native path) ------------------------
// Thin Server Action: validate input, capture audit context (IP, UA,
// signed-in member id), delegate to the recordSignature service. Added
// ALONGSIDE getSignUrlAction (the Dropbox Sign path) — that vendor path is
// untouched and selectable via the WAIVER_PROVIDER switch in a later phase.

export interface SubmitWaiverInput {
  signedName: string;
  agreedConsent: boolean;
}

function firstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const candidate = forwardedFor.split(",")[0]?.trim() ?? "";
  // Loose IPv4/IPv6 shape guard so a malformed header can't fail the inet
  // cast in record_bid_signature; Vercel supplies a clean client IP.
  const looksLikeIp =
    candidate.length > 0 &&
    candidate.length <= 45 &&
    /^[0-9a-fA-F:.]+$/.test(candidate);
  return looksLikeIp ? candidate : null;
}

export async function submitWaiverSignatureAction(
  bidSlug: string,
  bidAccessCode: string,
  input: SubmitWaiverInput,
): Promise<RecordSignatureResult> {
  const signedName = input.signedName?.trim() ?? "";

  if (!bidSlug.trim() || !bidAccessCode.trim()) {
    return { ok: false, reason: "bid_not_found", message: "We couldn't find this bid." };
  }
  if (!signedName) {
    return { ok: false, reason: "error", message: "Please type your full legal name to sign." };
  }
  if (signedName.length > 120) {
    return { ok: false, reason: "error", message: "That name is too long." };
  }
  if (!input.agreedConsent) {
    return { ok: false, reason: "error", message: "Please check the consent box before signing." };
  }

  const supabase = createServiceRoleClient();
  const storage = createWaiverStorage(supabase);

  const requestHeaders = await headers();
  const signedIp = firstForwardedIp(requestHeaders.get("x-forwarded-for"));
  const signedUserAgent = requestHeaders.get("user-agent");

  // Stamp signer_user_id when a member is signed in; guests stay null.
  let signerUserId: string | null = null;
  try {
    const cookieClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    signerUserId = user?.id ?? null;
  } catch {
    signerUserId = null;
  }

  return recordSignature(
    { supabase, storage },
    {
      bidSlug,
      bidAccessCode,
      signedName,
      signedIp,
      signedUserAgent,
      signerUserId,
    },
  );
}

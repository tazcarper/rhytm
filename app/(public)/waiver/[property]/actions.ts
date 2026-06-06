"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";
import { checkRateLimit } from "@/src/services/security/rate-limit";
import {
  recordStandaloneSignature,
  type RecordStandaloneResult,
} from "@/src/services/waiver/record-standalone-signature";

export type SubmitStandaloneWaiverResult =
  | RecordStandaloneResult
  | { ok: false; reason: "invalid"; message: string };

function firstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const candidate = forwardedFor.split(",")[0]?.trim() ?? "";
  const looksLikeIp =
    candidate.length > 0 && candidate.length <= 45 && /^[0-9a-fA-F:.]+$/.test(candidate);
  return looksLikeIp ? candidate : null;
}

// Public walk-in waiver kiosk submit. Resolves the property by slug, then
// records a standalone (no-booking) waiver. Anonymous by design — a staff
// member opens /waiver/<property> on an iPad and the guest signs.
export async function submitStandaloneWaiverAction(
  propertySlug: string,
  input: { name: string; email: string; agreedConsent: boolean; honeypot?: string },
): Promise<SubmitStandaloneWaiverResult> {
  // Honeypot: hidden field real users never fill.
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, reason: "invalid", message: "Something went wrong. Please try again." };
  }

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!name || name.length > 120) {
    return { ok: false, reason: "invalid", message: "Please type your full legal name to sign." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return { ok: false, reason: "invalid", message: "Please enter a valid email address." };
  }
  if (!input.agreedConsent) {
    return { ok: false, reason: "invalid", message: "Please check the consent box to sign." };
  }

  const supabase = createServiceRoleClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", propertySlug)
    .maybeSingle<{ id: string }>();
  if (!property) {
    return { ok: false, reason: "invalid", message: "We couldn't find that property." };
  }

  const requestHeaders = await headers();
  const signedIp = firstForwardedIp(requestHeaders.get("x-forwarded-for"));
  const signedUserAgent = requestHeaders.get("user-agent");

  // Rate limit (fail-open). The kiosk is bursty single-IP at events (one
  // iPad, many guests), so the per-IP ceiling is generous; per-email is tight.
  if (signedIp && !(await checkRateLimit(`waiver:ip:${signedIp}`, 120, 600))) {
    return { ok: false, reason: "invalid", message: "Too many signatures from this device just now — wait a moment." };
  }
  if (!(await checkRateLimit(`waiver:email:${email}`, 5, 600))) {
    return { ok: false, reason: "invalid", message: "This email just signed — wait a few minutes before signing again." };
  }

  const storage = createWaiverStorage(supabase);
  return recordStandaloneSignature(
    { supabase, storage },
    {
      propertyId: property.id,
      signedName: name,
      signerEmail: email,
      signedIp,
      signedUserAgent,
      collectedByAdminId: null,
    },
  );
}

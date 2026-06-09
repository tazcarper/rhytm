"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";
import { checkRateLimit } from "@/src/services/security/rate-limit";
import { recordStaffBidSignature } from "@/src/services/waiver/record-staff-bid-signature";
import { recordStandaloneSignature } from "@/src/services/waiver/record-standalone-signature";

export type ScanSignResult = { ok: true } | { ok: false; message: string };

function safeIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const candidate = forwardedFor.split(",")[0]?.trim() ?? "";
  return candidate.length > 0 && candidate.length <= 45 && /^[0-9a-fA-F:.]+$/.test(candidate)
    ? candidate
    : null;
}

interface BookingTokenRow {
  id: string;
  property_id: string;
  bids: { id: string; signed_at: string | null } | { id: string; signed_at: string | null }[] | null;
}

// Public QR scan-to-sign. The token (from the QR) authorizes signing this
// booking's waiver. The FIRST signer signs the canonical bid waiver (marks
// the booking signed); everyone else records a party waiver tied to the
// booking. Anonymous — guests sign on their own phones.
export async function submitBookingWaiverScanAction(
  token: string,
  input: { name: string; email: string; agreedConsent: boolean; honeypot?: string },
): Promise<ScanSignResult> {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!name || name.length > 120) {
    return { ok: false, message: "Please type your full legal name to sign." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  if (!input.agreedConsent) {
    return { ok: false, message: "Please check the consent box to sign." };
  }
  if (!token) return { ok: false, message: "This link is invalid." };

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, property_id, bids ( id, signed_at )")
    .eq("waiver_sign_token", token)
    .maybeSingle<BookingTokenRow>();
  if (!booking) {
    return { ok: false, message: "This waiver link is no longer valid." };
  }

  const requestHeaders = await headers();
  const signedIp = safeIp(requestHeaders.get("x-forwarded-for"));
  const signedUserAgent = requestHeaders.get("user-agent");

  // Generous per-IP ceiling (a whole party scans from the property's wifi);
  // tight per-email.
  if (signedIp && !(await checkRateLimit(`scan:ip:${signedIp}`, 120, 600))) {
    return { ok: false, message: "Too many signatures from this network just now — wait a moment." };
  }
  if (!(await checkRateLimit(`scan:email:${email}`, 5, 600))) {
    return { ok: false, message: "This email just signed — wait a few minutes before signing again." };
  }

  const bid = Array.isArray(booking.bids) ? booking.bids[0] : booking.bids;
  const storage = createWaiverStorage(supabase);

  // First signer (bid unsigned) → canonical bid waiver, marks booking signed.
  if (bid && !bid.signed_at) {
    const result = await recordStaffBidSignature(
      { supabase, storage },
      { bidId: bid.id, signedName: name, signedIp, signedUserAgent },
    );
    if (result.ok) return { ok: true };
    if (result.reason !== "already_signed") return { ok: false, message: result.message };
    // Lost the race — fall through and record a party waiver instead.
  }

  const party = await recordStandaloneSignature(
    { supabase, storage },
    {
      propertyId: booking.property_id,
      bookingId: booking.id,
      signedName: name,
      signerEmail: email,
      signedIp,
      signedUserAgent,
      collectedByAdminId: null,
    },
  );
  return party.ok ? { ok: true } : { ok: false, message: party.message };
}

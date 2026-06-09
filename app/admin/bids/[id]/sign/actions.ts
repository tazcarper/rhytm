"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";
import { hasAdminAccess } from "@/lib/auth/portal";
import { recordStaffBidSignature } from "@/src/services/waiver/record-staff-bid-signature";

function safeIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const candidate = forwardedFor.split(",")[0]?.trim() ?? "";
  const looksLikeIp =
    candidate.length > 0 && candidate.length <= 45 && /^[0-9a-fA-F:.]+$/.test(candidate);
  return looksLikeIp ? candidate : null;
}

// On-site signing: a staff member collects a guest's waiver for a booking on
// an iPad. Authorized by staff identity — the caller must be staff AND able
// to read the bid (RLS scopes property managers to their property).
export async function signBidInPersonAction(
  bidId: string,
  input: { signedName: string; agreedConsent: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const signedName = input.signedName?.trim() ?? "";
  if (!signedName || signedName.length > 120) {
    return { ok: false, error: "Please type the guest's full legal name." };
  }
  if (!input.agreedConsent) {
    return { ok: false, error: "Please check the consent box before signing." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !hasAdminAccess(role)) {
    return { ok: false, error: "Not authorized." };
  }

  // Authorize against the bid via the caller's RLS scope.
  const { data: visible } = await supabase
    .from("bids")
    .select("id")
    .eq("id", bidId)
    .maybeSingle();
  if (!visible) {
    return { ok: false, error: "You can't act on this booking." };
  }

  const requestHeaders = await headers();
  const signedIp = safeIp(requestHeaders.get("x-forwarded-for"));
  const signedUserAgent = requestHeaders.get("user-agent");

  const admin = createServiceRoleClient();
  const storage = createWaiverStorage(admin);
  const result = await recordStaffBidSignature(
    { supabase: admin, storage },
    { bidId, signedName, signedIp, signedUserAgent },
  );
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath(`/admin/bids/${bidId}`);
  return { ok: true };
}

// Mint (idempotent) the booking's scan-to-sign token and return the signing
// URL. Staff-gated; the token authorizes anonymous signing of THIS booking's
// waiver at /sign-waiver/<token>. The QR itself is drawn client-side from
// this URL (qrcode.react) — no server-side image generation.
export async function getBookingWaiverQrAction(
  bidId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !hasAdminAccess(role)) {
    return { ok: false, error: "Not authorized." };
  }

  // RLS-scoped read authorizes the caller against this bid → its booking.
  const { data: bid } = await supabase
    .from("bids")
    .select("id, booking_id")
    .eq("id", bidId)
    .maybeSingle<{ id: string; booking_id: string }>();
  if (!bid) {
    return { ok: false, error: "You can't act on this booking." };
  }

  const admin = createServiceRoleClient();
  const { data: bookingRow } = await admin
    .from("bookings")
    .select("waiver_sign_token")
    .eq("id", bid.booking_id)
    .maybeSingle<{ waiver_sign_token: string | null }>();

  let token = bookingRow?.waiver_sign_token ?? null;
  if (!token) {
    token = randomBytes(32).toString("base64url");
    const { error } = await admin
      .from("bookings")
      .update({ waiver_sign_token: token })
      .eq("id", bid.booking_id);
    if (error) return { ok: false, error: "Couldn't create the QR link — try again." };
  }

  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");
  const origin = host ? `${proto}://${host}` : "";
  const url = `${origin}/sign-waiver/${token}`;
  return { ok: true, url };
}

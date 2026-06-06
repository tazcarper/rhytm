"use server";

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

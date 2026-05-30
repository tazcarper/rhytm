"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  confirmBid,
  denyBid,
  regenerateBidUrl,
  type RegenerateResult,
  type TransitionResult,
} from "@/src/services/admin/transition-bid";

function siteOriginFromHeaders(h: Headers): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function confirmBidAction(
  bidId: string,
): Promise<TransitionResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const staffId = userData.user?.id;
  if (!staffId) return { ok: false, error: "Sign in required." };

  const result = await confirmBid(supabase, bidId, staffId);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
  }
  return result;
}

export async function denyBidAction(
  bidId: string,
  reason: string,
): Promise<TransitionResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "A denial reason is required." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Denial reason is too long (max 2000)." };
  }

  const supabase = await createServerSupabaseClient();
  const result = await denyBid(supabase, bidId, trimmed);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
  }
  return result;
}

export async function regenerateBidUrlAction(
  bidId: string,
): Promise<RegenerateResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const h = await headers();
  const origin = siteOriginFromHeaders(h);

  const supabase = await createServerSupabaseClient();
  const result = await regenerateBidUrl(supabase, bidId, origin);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
  }
  return result;
}

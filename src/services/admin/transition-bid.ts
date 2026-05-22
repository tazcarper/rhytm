import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBidUrl, buildAbsoluteBidUrl } from "@/src/services/bids/bid-url";

export interface TransitionResult {
  ok: boolean;
  error?: string;
}

export interface RegenerateResult extends TransitionResult {
  bidPath?: string;
  accessCode?: string;
}

function friendlyTransitionError(message: string): string {
  if (/workflow|transition|guard/i.test(message)) {
    return `That status change isn't allowed from this bid's current state. ${message}`;
  }
  return message;
}

export async function confirmBid(
  supabase: SupabaseClient,
  bidId: string,
): Promise<TransitionResult> {
  const { error } = await supabase
    .from("bids")
    .update({ status: "confirmed" })
    .eq("id", bidId);

  if (error) {
    return { ok: false, error: friendlyTransitionError(error.message) };
  }
  return { ok: true };
}

export async function denyBid(
  supabase: SupabaseClient,
  bidId: string,
  reason: string,
): Promise<TransitionResult> {
  const { error } = await supabase
    .from("bids")
    .update({
      status: "denied",
      denial_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", bidId);

  if (error) {
    return { ok: false, error: friendlyTransitionError(error.message) };
  }
  return { ok: true };
}

function generateAccessCode(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function regenerateBidUrl(
  supabase: SupabaseClient,
  bidId: string,
  origin?: string,
): Promise<RegenerateResult> {
  const accessCode = generateAccessCode();

  const { error: rpcError } = await supabase.rpc("regenerate_bid_access_code", {
    p_bid_id: bidId,
    p_code: accessCode,
  });

  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  const { data: row, error: readError } = await supabase
    .from("bids")
    .select("slug")
    .eq("id", bidId)
    .single<{ slug: string }>();

  if (readError || !row) {
    return {
      ok: false,
      error: readError?.message ?? "Bid lookup failed after regenerate.",
    };
  }

  const bidPath = origin
    ? buildAbsoluteBidUrl(origin, row.slug, accessCode)
    : buildBidUrl(row.slug, accessCode);

  return { ok: true, bidPath, accessCode };
}

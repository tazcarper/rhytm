import { randomBytes } from "node:crypto";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBidUrl, buildAbsoluteBidUrl } from "@/src/services/bids/bid-url";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createSignatureEnvelope } from "@/src/services/dropbox-sign/create-envelope";
import { inngest } from "@/lib/inngest/client";
import { bidConfirmed } from "@/lib/inngest/events";

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
  staffId: string,
): Promise<TransitionResult> {
  const { error } = await supabase
    .from("bids")
    .update({ status: "confirmed" })
    .eq("id", bidId);

  if (error) {
    return { ok: false, error: friendlyTransitionError(error.message) };
  }

  // App 7: kick off envelope creation post-response. Failures here
  // (Dropbox Sign disabled, API error, etc.) do NOT roll back the
  // confirmation — the bid is still confirmed in our DB; the
  // signature flow is best-effort. Admin can retry manually if it
  // doesn't show up. Uses service-role since the cookie-scoped admin
  // client isn't reachable from `after()` (no per-request context).
  after(async () => {
    const result = await createSignatureEnvelope({
      supabase: createServiceRoleClient(),
      bidId,
    });
    if (!result.ok) {
      if (result.reason === "disabled") {
        // Expected during scaffolding / pre-activation. Quiet log.
        console.info(
          "[transition-bid/confirm] Dropbox Sign disabled, skipping envelope",
          { bidId },
        );
      } else {
        console.error(
          "[transition-bid/confirm] envelope creation failed",
          { bidId, reason: result.reason, message: result.message },
        );
      }
    }
  });

  // Fire the bid/confirmed Inngest event post-response. Best-effort:
  // the DB update is the source of truth for "this bid is confirmed";
  // event delivery feeds downstream workflows (bid-ready email, Q7
  // 48h unsigned follow-up timer, HubSpot stage advance). A failure
  // here logs and returns — confirming via the admin UI must not 5xx
  // because Inngest is down. Stable dedupe id keeps a replayed
  // `after()` callback from double-firing the downstream chain.
  after(() => fireBidConfirmedEventBestEffort({ bidId, staffId }));

  return { ok: true };
}

interface BidConfirmedEventArgs {
  bidId: string;
  staffId: string;
}

async function fireBidConfirmedEventBestEffort(
  args: BidConfirmedEventArgs,
): Promise<void> {
  try {
    await inngest.send({
      id: `bid-${args.bidId}-confirmed`,
      name: bidConfirmed.name,
      data: {
        bidId: args.bidId,
        confirmedByStaffId: args.staffId,
      },
    });
  } catch (err) {
    console.error(
      "[transition-bid/confirm] inngest bid/confirmed send failed",
      { bidId: args.bidId, err },
    );
  }
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

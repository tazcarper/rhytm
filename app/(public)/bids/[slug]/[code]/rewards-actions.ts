"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildBidUrl } from "@/src/services/bids/bid-url";
import {
  linkBookingToMemberNumber,
  type LinkMemberNumberResult,
} from "@/src/services/rewards/bid-rewards";
import { checkRateLimit, clientIpFrom } from "@/src/services/security/rate-limit";

// Guest enters their member number on the bid page so this booking earns
// points. Thin: verify the bid link, rate-limit guesses, delegate.

export async function linkMemberNumberAction(
  bidSlug: string,
  bidAccessCode: string,
  memberNumber: string,
  lastName: string,
): Promise<LinkMemberNumberResult> {
  const supabase = createServiceRoleClient();

  const { data: bidRows, error } = await supabase.rpc("validate_bid_access_code", {
    p_slug: bidSlug,
    p_code: bidAccessCode,
  });
  const bid = Array.isArray(bidRows)
    ? (bidRows[0] as { booking_id: string; status: string } | undefined)
    : undefined;
  if (error || !bid) {
    return { ok: false, message: "We couldn't find this bid." };
  }
  if (bid.status === "paid" || bid.status === "refunded") {
    return {
      ok: false,
      message: "This booking is already paid. Ask the property to add your points.",
    };
  }

  const ip = clientIpFrom((await headers()).get("x-forwarded-for")) ?? "unknown";
  const allowed = await checkRateLimit(`reward-link:${ip}`, 10, 60 * 60);
  if (!allowed) {
    return { ok: false, message: "Too many tries. Please wait a bit and try again." };
  }

  const result = await linkBookingToMemberNumber(supabase, {
    bookingId: bid.booking_id,
    memberNumber,
    lastName,
  });
  if (result.ok) revalidatePath(buildBidUrl(bidSlug, bidAccessCode));
  return result;
}

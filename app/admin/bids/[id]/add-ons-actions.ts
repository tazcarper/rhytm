"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  addBidAddOn,
  removeBidAddOn,
  AddBidAddOnInputSchema,
  RemoveBidAddOnInputSchema,
  type AddBidAddOnRawInput,
  type RemoveBidAddOnRawInput,
  type BidAddOnMutationResult,
} from "@/src/services/admin/update-bid-add-ons";
import { resolveStaffActor } from "@/src/services/admin/staff-identity";
import type { AdminBidStatus } from "@/src/services/admin/bids";

// Add-ons can only be changed while the bid is still being shaped — before
// the guest has committed money or signed. paid / signed / refunded / denied /
// expired are off-limits.
const ADD_ON_EDITABLE_STATUSES: ReadonlyArray<AdminBidStatus> = [
  "pending_review",
  "confirmed",
];

function firstIssueMessage(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  const issue = issues[0];
  return issue
    ? `${issue.path.map(String).join(".")}: ${issue.message}`
    : "Invalid input";
}

// Verifies the caller is staff and that the bid is real, belongs to the
// expected booking, and is in an add-on-editable state. The read runs under
// the caller's RLS scope, so it doubles as a "can this user even see this
// bid?" check before we reach for the RLS-bypassing service client.
async function authorizeAddOnEdit(
  bidId: string,
  expectedBookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "Sign in required." };

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? null;
  if (!hasAdminAccess(role)) {
    return { ok: false, error: "Not authorized." };
  }

  const { data: bid, error } = await supabase
    .from("bids")
    .select("status, booking_id")
    .eq("id", bidId)
    .maybeSingle<{ status: AdminBidStatus; booking_id: string }>();

  if (error) return { ok: false, error: error.message };
  if (!bid) return { ok: false, error: "Bid not found." };
  if (bid.booking_id !== expectedBookingId) {
    return { ok: false, error: "Booking mismatch." };
  }
  if (!ADD_ON_EDITABLE_STATUSES.includes(bid.status)) {
    return {
      ok: false,
      error: "Add-ons can only be changed while a bid is in review or confirmed.",
    };
  }
  return { ok: true };
}

export async function addBidAddOnAction(
  bidId: string,
  input: AddBidAddOnRawInput,
): Promise<BidAddOnMutationResult> {
  const parsed = AddBidAddOnInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error.issues) };
  }

  const auth = await authorizeAddOnEdit(bidId, parsed.data.bookingId);
  if (!auth.ok) return auth;

  // The actor stamps any auto-reversal audit event when an add-on edit removes
  // an in-force comp on the changed line.
  const actor = await resolveStaffActor(await createServerSupabaseClient());
  if (!actor) return { ok: false, error: "Sign in required." };

  const result = await addBidAddOn(createServiceRoleClient(), parsed.data, actor);
  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
  }
  return result;
}

export async function removeBidAddOnAction(
  bidId: string,
  input: RemoveBidAddOnRawInput,
): Promise<BidAddOnMutationResult> {
  const parsed = RemoveBidAddOnInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error.issues) };
  }

  const auth = await authorizeAddOnEdit(bidId, parsed.data.bookingId);
  if (!auth.ok) return auth;

  const actor = await resolveStaffActor(await createServerSupabaseClient());
  if (!actor) return { ok: false, error: "Sign in required." };

  const result = await removeBidAddOn(createServiceRoleClient(), parsed.data, actor);
  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
  }
  return result;
}

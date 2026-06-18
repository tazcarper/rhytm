"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStaffIdentity } from "@/src/services/admin/staff-identity";
import { WAIVE_ROLES } from "@/src/constants/admin/waive";
import {
  applyLineOverride,
  ApplyLineOverrideInputSchema,
  type ApplyLineOverrideRawInput,
  type ApplyLineOverrideResult,
} from "@/src/services/admin/apply-line-override";

// Per-line waive/comp Server Action. Mirrors the add-ons action's shape:
// authorize under the caller's RLS scope (which doubles as a "can this user
// even see this bid?" check), then perform the privileged write with the
// service role.
//
// Who may waive (design Q4): super_admin + admin (cross-property) and
// property_manager scoped to their own property. NOT concierge /
// membership_coordinator — hasAdminAccess() is too broad here, so we check the
// specific WAIVE_ROLES set (shared with the page, which hides the controls).
// Only on a bid still in pending_review.

function firstIssueMessage(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  const issue = issues[0];
  return issue
    ? `${issue.path.map(String).join(".")}: ${issue.message}`
    : "Invalid input";
}

interface AuthorizedActor {
  ok: true;
  actor: { id: string; email: string };
}
type AuthorizeResult = AuthorizedActor | { ok: false; error: string };

// Confirms the caller may waive a line on this bid: a waive-eligible role, the
// bid exists and matches the expected booking, is in pending_review, and — for
// a property_manager — belongs to their property. Returns the resolved actor.
async function authorizeWaive(
  bidId: string,
  expectedBookingId: string,
): Promise<AuthorizeResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "Sign in required." };

  const meta = (user.app_metadata ?? {}) as {
    role?: string;
    property_id?: string;
  };
  const role = meta.role ?? null;
  if (!role || !WAIVE_ROLES.includes(role)) {
    return { ok: false, error: "Not authorized to waive a line." };
  }

  // Read under the caller's RLS scope — confirms visibility AND lets us scope
  // a property_manager to their own property via the booking.
  const { data: bid, error } = await supabase
    .from("bids")
    .select("status, booking_id, bookings ( property_id )")
    .eq("id", bidId)
    .maybeSingle<{
      status: string;
      booking_id: string;
      bookings: { property_id: string } | null;
    }>();
  if (error) return { ok: false, error: error.message };
  if (!bid) return { ok: false, error: "Bid not found." };
  if (bid.booking_id !== expectedBookingId) {
    return { ok: false, error: "Booking mismatch." };
  }
  if (bid.status !== "pending_review") {
    return {
      ok: false,
      error: "A line can only be waived while the bid is in review.",
    };
  }
  if (
    role === "property_manager" &&
    bid.bookings?.property_id !== meta.property_id
  ) {
    return { ok: false, error: "This bid is not at your property." };
  }

  const identity = await getStaffIdentity(user.id);
  return {
    ok: true,
    actor: { id: user.id, email: identity?.email ?? user.email ?? "unknown" },
  };
}

export async function applyLineOverrideAction(
  bidId: string,
  input: ApplyLineOverrideRawInput,
): Promise<ApplyLineOverrideResult> {
  const parsed = ApplyLineOverrideInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error.issues) };
  }

  const auth = await authorizeWaive(bidId, parsed.data.bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const result = await applyLineOverride(
    createServiceRoleClient(),
    parsed.data,
    auth.actor,
  );

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
  }
  return result;
}

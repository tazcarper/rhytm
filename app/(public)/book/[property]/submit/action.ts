"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  createPublicBooking,
  type PublicBookingInput,
  type BookingFailureReason,
} from "@/src/services/bookings/create-public-booking";

export type SubmitBookingResult =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: BookingFailureReason; message: string };

// The form supplies everything except the member attribution fields —
// those are computed server-side from the auth session here.
export type SubmitBookingInput = Omit<
  PublicBookingInput,
  "memberUserId" | "audienceType" | "createdByAdminId"
>;

export async function submitBookingAction(
  input: SubmitBookingInput,
): Promise<SubmitBookingResult> {
  // Attribute the booking based on who's signed in:
  //   member → member_user_id + audience 'member' (surfaces on /member)
  //   staff  → created_by_admin_id (a staff member booking on behalf of a
  //            call-in / walk-up customer); the booking stays a 'public'
  //            guest booking, just attributed to the booker
  //   else   → anonymous self-service public booking
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  const isMember = role === "member";
  const isStaff = hasAdminAccess(role);

  const result = await createPublicBooking({
    ...input,
    memberUserId: isMember ? user!.id : null,
    audienceType: isMember ? "member" : "public",
    createdByAdminId: isStaff ? user!.id : null,
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message };
  }
  return { ok: true, redirectTo: result.bidPath };
}

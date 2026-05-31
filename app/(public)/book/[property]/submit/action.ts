"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  "memberUserId" | "audienceType"
>;

export async function submitBookingAction(
  input: SubmitBookingInput,
): Promise<SubmitBookingResult> {
  // If a signed-in member is going through the public funnel, attribute
  // the booking to them so it surfaces on /member/bookings. Only stamp
  // for the member role — admins/PMs booking on the public surface stay
  // anonymous (their on-behalf-of flow lives in /admin).
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMember = user?.app_metadata?.role === "member";

  const result = await createPublicBooking({
    ...input,
    memberUserId: isMember ? user!.id : null,
    audienceType: isMember ? "member" : "public",
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message };
  }
  return { ok: true, redirectTo: result.bidPath };
}

"use server";

import {
  createPublicBooking,
  type PublicBookingInput,
  type BookingFailureReason,
} from "@/src/services/bookings/create-public-booking";

export type SubmitBookingResult =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: BookingFailureReason; message: string };

export async function submitBookingAction(
  input: PublicBookingInput,
): Promise<SubmitBookingResult> {
  const result = await createPublicBooking(input);
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message };
  }
  return { ok: true, redirectTo: result.bidPath };
}

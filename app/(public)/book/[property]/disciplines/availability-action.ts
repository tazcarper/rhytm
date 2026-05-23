"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSlotAvailabilityForDate,
  type SlotAvailability,
} from "@/src/services/public/slots";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// Thin Server Action wrapper around `getSlotAvailabilityForDate`, called by
// <BookingBuilder> when the guest picks a date in the "When" step. Returns
// the per-slot availability map (slotStart → can-still-book) so the client
// can grey out reserved times. On error it returns `null` and the caller
// fails open (shows all configured slots) — the create path's Phase 2
// triggers still reject a genuinely-taken slot at submit.
export async function getSlotAvailabilityAction(args: {
  propertyId: string;
  dateISO: string;
  bookingType: BookingType;
  durationHours: number;
}): Promise<SlotAvailability | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await getSlotAvailabilityForDate(supabase, args);
  return data;
}

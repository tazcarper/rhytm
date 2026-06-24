"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSlotAvailabilityForDate,
  type SlotAvailability,
} from "@/src/services/public/slots";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// Thin Server Action over `getSlotAvailabilityForDate`, called by the shared
// <DateTimePicker> when a date is picked. Returns the per-slot availability map
// (slotStart → can-still-book) so the client can grey out reserved times. On
// error it returns `null` and the caller fails open (shows all configured
// slots) — the Phase 2 insert triggers still reject a genuinely-taken slot at
// submit/lock time.
//
// Lives here (not under the /book funnel route, which is hidden and slated for
// deletion) so both the funnel and the estimate front door can share it.
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

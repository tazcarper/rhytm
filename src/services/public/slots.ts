import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSlotLabel } from "./format";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// `time_slots` has a public-read RLS policy on `is_active = true`, so the
// cookie-aware server client suffices.
//
// `getSlotsForProperty` returns the CONFIGURED slot starts per day-of-week —
// the static skeleton of the calendar. It does not know what's booked.
// Live availability (which of those slots are already reserved on a SPECIFIC
// date) comes from `getSlotAvailabilityForDate`, which calls the
// `get_slot_availability` SECURITY DEFINER RPC — `bookings` has no anon
// SELECT policy, so the cross-check has to run inside the database.

export interface AvailableSlot {
  slotStart: string; // "HH:MM:SS"
  label: string; // "9 AM" / "1:30 PM"
}

// 0=Sun, 6=Sat → ordered list of slots. Days with no configured slots are absent.
export type SlotsByDayOfWeek = Record<number, ReadonlyArray<AvailableSlot>>;

export async function getSlotsForProperty(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<{ data: SlotsByDayOfWeek | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("time_slots")
    .select("day_of_week, slot_start")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("slot_start");

  if (error) return { data: null, error: { message: error.message } };

  const rows = (data ?? []) as Array<{ day_of_week: number; slot_start: string }>;
  const byDay: Record<number, AvailableSlot[]> = {};
  for (const row of rows) {
    (byDay[row.day_of_week] ??= []).push({
      slotStart: row.slot_start,
      label: formatSlotLabel(row.slot_start),
    });
  }
  return { data: byDay, error: null };
}

// Date string "YYYY-MM-DD" → day-of-week (0=Sun, 6=Sat). Interpreted at
// UTC for determinism regardless of server TZ; the slight wobble against
// the property's local day is acceptable for placeholder mode.
export function dayOfWeekFromISO(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// slotStart ("HH:MM:SS") → whether a new booking can still be placed there
// on the queried date. Slots absent from the map should be treated as
// available (fail-open) — the Phase 2 insert triggers are the real guard.
export type SlotAvailability = Record<string, boolean>;

// Live cross-check of a single date's slots against existing bookings via the
// `get_slot_availability` RPC. `durationHours` and `bookingType` shape the
// overlap window and the prospective capacity the same way the create path
// does, so the preview matches what the insert triggers will allow.
export async function getSlotAvailabilityForDate(
  supabase: SupabaseClient,
  args: {
    propertyId: string;
    dateISO: string;
    bookingType: BookingType;
    durationHours: number;
  },
): Promise<{ data: SlotAvailability | null; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("get_slot_availability", {
    p_property_id: args.propertyId,
    p_date: args.dateISO,
    p_booking_type: args.bookingType,
    p_duration_hours: args.durationHours,
  });

  if (error) return { data: null, error: { message: error.message } };

  const rows = (data ?? []) as Array<{ slot_start: string; is_available: boolean }>;
  const availability: SlotAvailability = {};
  for (const row of rows) {
    availability[row.slot_start] = row.is_available;
  }
  return { data: availability, error: null };
}

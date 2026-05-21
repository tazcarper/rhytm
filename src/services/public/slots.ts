import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSlotLabel } from "./format";

// `time_slots` has a public-read RLS policy on `is_active = true`, so the
// cookie-aware server client suffices.
//
// SCOPE NOTE (2.4): this service only returns the configured slot starts
// for the given day. It does NOT cross-check against existing `bookings`
// (no anon SELECT policy on bookings — would require service-role or a
// SECURITY DEFINER RPC) or assign instructors. The plan calls for both;
// they're deferred to a 2.4.x polish pass. The 2.6 create-booking action
// surfaces conflicts via Phase 2 triggers either way.

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

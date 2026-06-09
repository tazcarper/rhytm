import type { SupabaseClient } from "@supabase/supabase-js";

// The booking statuses an instructor sees in their upcoming list: staff has
// confirmed the event and it's live (awaiting the guest, signed, or deposit
// paid). pending_review / denied / cancelled / expired are excluded — there's
// nothing to prep for. fulfilled is past by definition and drops off via the
// start_time filter anyway.
const CONFIRMED_UPCOMING_STATUSES = [
  "awaiting_guest",
  "signed",
  "deposit_paid",
] as const;

export interface InstructorEventSummary {
  bookingId: string;
  bookingType: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  guestName: string;
  guestCount: number;
  activities: string[];
  propertyName: string;
  timezone: string;
}

type EventRow = {
  id: string;
  booking_type: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  guest_name: string;
  guest_count: number;
  properties: { name: string; timezone: string } | null;
  booking_disciplines: Array<{ services: { name: string } | null }> | null;
};

// Upcoming events assigned to the signed-in instructor, soonest first. RLS
// ("bookings: instructor reads assigned") already restricts rows to this
// instructor; this query layers the product filter (confirmed + future) on
// top. Returns [] for a non-instructor — they own no rows.
export async function getMyUpcomingEvents(
  supabase: SupabaseClient,
): Promise<InstructorEventSummary[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, booking_type, start_time, end_time, duration_hours,
      guest_name, guest_count,
      properties ( name, timezone ),
      booking_disciplines ( services ( name ) )
      `,
    )
    .gte("start_time", nowIso)
    .in("status", [...CONFIRMED_UPCOMING_STATUSES])
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Instructor upcoming events failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as EventRow[])
    .filter((row) => row.properties !== null)
    .map((row) => ({
      bookingId: row.id,
      bookingType: row.booking_type,
      startTime: row.start_time,
      endTime: row.end_time,
      durationHours: row.duration_hours,
      guestName: row.guest_name,
      guestCount: row.guest_count,
      activities: (row.booking_disciplines ?? [])
        .map((discipline) => discipline.services?.name)
        .filter((name): name is string => Boolean(name)),
      propertyName: row.properties!.name,
      timezone: row.properties!.timezone,
    }));
}

import type { SupabaseClient } from "@supabase/supabase-js";

// One signer who has put their name to a waiver for this event — the primary
// guest or a party member who signed on their own phone via the scan-to-sign
// QR. Names only exist once someone signs; before that the roster shows the
// party size and how many are still outstanding.
export interface GameplanSigner {
  name: string;
  isPrimary: boolean;
}

export interface InstructorGameplan {
  bookingId: string;
  bookingType: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  // Primary guest — who the instructor greets.
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestCount: number;
  // What the guest asked for at booking time, plus any schedule notes staff
  // added to the bid. Either may be null.
  specialRequests: string | null;
  scheduleNotes: string | null;
  activities: string[];
  // Roster of everyone who has signed so far + how many haven't.
  signers: GameplanSigner[];
  unsignedCount: number;
  // Where + how to find the place.
  property: {
    name: string;
    timezone: string;
    directions: string | null;
    parking: string | null;
    arrivalContact: string | null;
    mapUrl: string | null;
  };
}

type GameplanRow = {
  id: string;
  booking_type: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_count: number;
  guest_notes: string | null;
  properties: {
    name: string;
    timezone: string;
    directions: string | null;
    parking: string | null;
    arrival_contact: string | null;
    map_url: string | null;
  } | null;
  // One-to-one (booking_id is UNIQUE on bids) → PostgREST returns an object.
  // The nested waiver_documents is the primary/bid signer (linked via bid_id,
  // also one-to-one), null until they sign.
  bids: {
    schedule_notes: string | null;
    waiver_documents: { signed_name: string } | null;
  } | null;
  booking_disciplines: Array<{ services: { name: string } | null }> | null;
};

// The full pre-event briefing for a single booking. RLS scopes every read to
// the signed-in instructor's assigned bookings, so a booking belonging to a
// different instructor (or none) simply comes back null — the page 404s.
export async function getEventGameplan(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<InstructorGameplan | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, booking_type, start_time, end_time, duration_hours,
      guest_name, guest_email, guest_phone, guest_count, guest_notes,
      properties ( name, timezone, directions, parking, arrival_contact, map_url ),
      bids ( schedule_notes, waiver_documents ( signed_name ) ),
      booking_disciplines ( services ( name ) )
      `,
    )
    .eq("id", bookingId)
    .is("deleted_at", null)
    .maybeSingle<GameplanRow>();

  if (error) {
    throw new Error(`Instructor gameplan failed: ${error.message}`);
  }
  if (!data || !data.properties) {
    return null;
  }

  // Party guests who signed via the scan-to-sign QR — booking_id set, bid_id
  // null (the primary/bid signer is the embedded bids.waiver_documents above,
  // counted separately). Read through the instructor's RLS scope
  // ("waiver_documents: instructor reads assigned").
  const { data: partyRows, error: waiverError } = await supabase
    .from("waiver_documents")
    .select("signed_name, created_at")
    .eq("booking_id", bookingId)
    .is("bid_id", null)
    .order("created_at", { ascending: true });
  if (waiverError) {
    throw new Error(`Instructor gameplan waivers failed: ${waiverError.message}`);
  }

  const primaryWaiver = data.bids?.waiver_documents ?? null;
  const signers: GameplanSigner[] = [
    ...(primaryWaiver
      ? [{ name: primaryWaiver.signed_name, isPrimary: true }]
      : []),
    ...(partyRows ?? []).map((row) => ({
      name: row.signed_name as string,
      isPrimary: false,
    })),
  ];
  // Party size can lag reality (a guest brings a +1 who signs), so never
  // report a negative remainder.
  const unsignedCount = Math.max(0, data.guest_count - signers.length);

  return {
    bookingId: data.id,
    bookingType: data.booking_type,
    startTime: data.start_time,
    endTime: data.end_time,
    durationHours: data.duration_hours,
    guestName: data.guest_name,
    guestEmail: data.guest_email,
    guestPhone: data.guest_phone,
    guestCount: data.guest_count,
    specialRequests: data.guest_notes,
    scheduleNotes: data.bids?.schedule_notes ?? null,
    activities: (data.booking_disciplines ?? [])
      .map((discipline) => discipline.services?.name)
      .filter((name): name is string => Boolean(name)),
    signers,
    unsignedCount,
    property: {
      name: data.properties.name,
      timezone: data.properties.timezone,
      directions: data.properties.directions,
      parking: data.properties.parking,
      arrivalContact: data.properties.arrival_contact,
      mapUrl: data.properties.map_url,
    },
  };
}

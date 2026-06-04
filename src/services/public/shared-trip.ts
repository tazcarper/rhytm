import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingType } from "@/src/services/members/bookings";
import {
  parseFaq,
  parseGearList,
  type BookingFaqEntry,
  type BookingGearItem,
} from "@/src/services/members/booking-detail";

// Resolves a shared-trip bearer token to a trimmed, anonymous-safe trip
// overview for /trip/<token>. Read via a service-role client (the route is
// unauthenticated, so it can't ride member RLS) with an EXPLICIT column
// allowlist — deliberately no pricing, payment, contact info, bid access
// code, or raw IDs that would let a recipient back into the API.
//
// Finalized gate: a token only resolves once the trip is real — the bid is
// signed AND the deposit is paid. Pre-finalize (or unknown token) → null,
// which the route renders as a 404 so an unconfirmed trip can't leak.

export interface SharedTrip {
  hostName: string;
  shareNote: string | null;
  startTime: string;
  endTime: string;
  durationHours: number;
  bookingType: BookingType;
  guestCount: number;
  property: { name: string; timezone: string };
  instructor: { name: string } | null;
  scheduleNotes: string | null;
  gearList: BookingGearItem[];
  faq: BookingFaqEntry[];
  disciplines: string[]; // service names only
  addOns: string[]; // add-on names only
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Pricing/payment fields below are read ONLY to evaluate the finalized
// gate — they are never returned in SharedTrip.
const SHARED_TRIP_SELECT = `
  start_time, end_time, duration_hours, booking_type, guest_count,
  guest_name, share_note, deposit_amount, amount_paid,
  properties ( name, timezone ),
  instructors ( name ),
  bids ( schedule_notes, gear_list, faq, signed_at ),
  booking_disciplines ( services ( name ) ),
  booking_add_ons ( add_ons ( name ) )
`;

interface SharedTripRow {
  start_time: string;
  end_time: string;
  duration_hours: number;
  booking_type: BookingType;
  guest_count: number;
  guest_name: string;
  share_note: string | null;
  deposit_amount: string | number | null;
  amount_paid: string | number | null;
  properties: { name: string; timezone: string } | { name: string; timezone: string }[] | null;
  instructors: { name: string } | { name: string }[] | null;
  bids:
    | Array<{ schedule_notes: string | null; gear_list: unknown; faq: unknown; signed_at: string | null }>
    | { schedule_notes: string | null; gear_list: unknown; faq: unknown; signed_at: string | null }
    | null;
  booking_disciplines: Array<{ services: { name: string } | { name: string }[] | null }> | null;
  booking_add_ons: Array<{ add_ons: { name: string } | { name: string }[] | null }> | null;
}

export async function getSharedTrip(
  admin: SupabaseClient,
  token: string,
): Promise<SharedTrip | null> {
  if (!token) return null;

  const { data, error } = await admin
    .from("bookings")
    .select(SHARED_TRIP_SELECT)
    .eq("share_token", token)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as SharedTripRow;
  const bid = pickOne(row.bids);

  // Finalized gate: signed + deposit paid.
  const depositAmount = toNumber(row.deposit_amount);
  const amountPaid = toNumber(row.amount_paid) ?? 0;
  const finalized =
    !!bid?.signed_at && depositAmount !== null && amountPaid >= depositAmount;
  if (!finalized) return null;

  const property = pickOne(row.properties);
  const instructor = pickOne(row.instructors);

  const disciplines = (row.booking_disciplines ?? []).flatMap((d): string[] => {
    const service = pickOne(d.services);
    return service ? [service.name] : [];
  });
  const addOns = (row.booking_add_ons ?? []).flatMap((a): string[] => {
    const addOn = pickOne(a.add_ons);
    return addOn ? [addOn.name] : [];
  });

  return {
    hostName: row.guest_name,
    shareNote: row.share_note,
    startTime: row.start_time,
    endTime: row.end_time,
    durationHours: row.duration_hours,
    bookingType: row.booking_type,
    guestCount: row.guest_count,
    property: {
      name: property?.name ?? "—",
      timezone: property?.timezone ?? "America/Chicago",
    },
    instructor: instructor ? { name: instructor.name } : null,
    scheduleNotes: bid?.schedule_notes ?? null,
    gearList: parseGearList(bid?.gear_list),
    faq: parseFaq(bid?.faq),
    disciplines,
    addOns,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

// Member-portal bookings service. Returns the household's bookings for
// /member/bookings and the explicit-scope variant used by App 3.8
// (admin preview-as-member).
//
// Why two entry points: the page wrapper passes data into pure
// components (App 3.8 reuse contract). getMyBookings is the
// /member entry — RLS does the household scoping via
// current_household_user_ids(). getBookingsForMember is the
// preview-as-member entry — admin RLS sees everything, so the
// caller passes the target member's user_id set explicitly to narrow.

export type BookingType =
  | "plan_a_visit"
  | "private_lesson"
  | "host_an_occasion";

export type BookingStatus =
  | "pending_review"
  | "awaiting_guest"
  | "denied"
  | "signed"
  | "deposit_paid"
  | "fulfilled"
  | "cancelled"
  | "expired";

export type BidStatus =
  | "pending_review"
  | "confirmed"
  | "denied"
  | "signed"
  | "paid"
  | "expired"
  | "refunded";

export interface MemberBookingRow {
  id: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  property: { name: string; slug: string; timezone: string };
  bookingType: BookingType;
  status: BookingStatus;
  guestCount: number;
  bookedBy: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  isMine: boolean;
  instructor: { name: string } | null;
  bid: { slug: string; status: BidStatus } | null;
  pricing: {
    confirmedPrice: number | null;
    estimatedPrice: number | null;
    depositAmount: number | null;
    amountPaid: number;
  };
}

export interface MemberBookingsResult {
  data: MemberBookingRow[] | null;
  error: { message: string } | null;
}

// PostgREST embeds come back as a single object or a one-element array
// depending on the FK shape. Matches the pickOne helper in memberships.ts.
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface BookingsQueryRow {
  id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  booking_type: BookingType;
  status: BookingStatus;
  guest_count: number;
  member_user_id: string | null;
  // Postgres numeric(10,2) comes back as a string through PostgREST.
  // Match the admin services' typing — see src/services/admin/refund-deposit.ts.
  confirmed_price: string | number | null;
  estimated_price: string | number | null;
  deposit_amount: string | number | null;
  amount_paid: string | number | null;
  properties:
    | { name: string; slug: string; timezone: string }
    | { name: string; slug: string; timezone: string }[]
    | null;
  instructors: { name: string } | { name: string }[] | null;
  bids:
    | Array<{ slug: string; status: BidStatus }>
    | { slug: string; status: BidStatus }
    | null;
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

const BOOKINGS_SELECT = `
  id, start_time, end_time, duration_hours, booking_type, status,
  guest_count, member_user_id,
  confirmed_price, estimated_price, deposit_amount, amount_paid,
  properties ( name, slug, timezone ),
  instructors ( name ),
  bids ( slug, status )
`;

// /member entry. RLS handles household scoping via the new
// current_household_user_ids()-based policy. We pass currentUserId so
// the service can stamp isMine on each row + look up booker attribution.
export async function getMyBookings(
  supabase: SupabaseClient,
  currentUserId: string,
): Promise<MemberBookingsResult> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKINGS_SELECT)
    .is("deleted_at", null)
    .order("start_time", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return normalize(supabase, data as unknown as BookingsQueryRow[], currentUserId);
}

// /admin preview-as-member entry. Admin RLS sees every booking, so the
// caller passes the target member's resolved auth user_ids. Pass
// currentUserId as the admin's own id (or null) — every row will have
// isMine=false from the member's perspective; the admin UI may want to
// remap "isMine" to "bookedByPrimary" depending on the design.
export async function getBookingsForMember(
  supabase: SupabaseClient,
  userIds: string[],
  currentUserId: string | null,
): Promise<MemberBookingsResult> {
  if (userIds.length === 0) {
    return { data: [], error: null };
  }
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKINGS_SELECT)
    .in("member_user_id", userIds)
    .is("deleted_at", null)
    .order("start_time", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return normalize(
    supabase,
    data as unknown as BookingsQueryRow[],
    currentUserId,
  );
}

// Second query: resolve booker names for every distinct member_user_id
// in the result set, then stitch into the rows. We don't have a FK
// from bookings.member_user_id → people.user_id (intentionally —
// see plan doc 4.1 service shape note), so PostgREST can't embed.
// Two round-trips beats adding an FK on a hot table.
async function normalize(
  supabase: SupabaseClient,
  rows: BookingsQueryRow[],
  currentUserId: string | null,
): Promise<MemberBookingsResult> {
  const userIds = Array.from(
    new Set(rows.map((row) => row.member_user_id).filter((id): id is string => !!id)),
  );

  const bookers = new Map<
    string,
    { displayName: string | null; firstName: string | null; lastName: string | null }
  >();

  if (userIds.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("user_id, first_name, last_name, display_name")
      .in("user_id", userIds);

    if (peopleError) {
      return { data: null, error: { message: peopleError.message } };
    }

    for (const person of people ?? []) {
      if (person.user_id) {
        bookers.set(person.user_id, {
          displayName: person.display_name ?? null,
          firstName: person.first_name,
          lastName: person.last_name,
        });
      }
    }
  }

  const normalized: MemberBookingRow[] = rows.map((row): MemberBookingRow => {
    const property = pickOne(row.properties);
    const instructor = pickOne(row.instructors);
    const bid = pickOne(row.bids);
    const booker = row.member_user_id ? bookers.get(row.member_user_id) ?? null : null;

    return {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      durationHours: row.duration_hours,
      bookingType: row.booking_type,
      status: row.status,
      guestCount: row.guest_count,
      property: {
        name: property?.name ?? "—",
        slug: property?.slug ?? "",
        timezone: property?.timezone ?? "America/Chicago",
      },
      bookedBy: booker,
      isMine: row.member_user_id !== null && row.member_user_id === currentUserId,
      instructor: instructor ? { name: instructor.name } : null,
      bid: bid ? { slug: bid.slug, status: bid.status } : null,
      pricing: {
        confirmedPrice: toNumber(row.confirmed_price),
        estimatedPrice: toNumber(row.estimated_price),
        depositAmount: toNumber(row.deposit_amount),
        amountPaid: toNumber(row.amount_paid) ?? 0,
      },
    };
  });

  return { data: normalized, error: null };
}

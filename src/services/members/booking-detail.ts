import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BidStatus,
  BookingStatus,
  BookingType,
} from "./bookings";

// Detail-view shape for a single booking on /member/bookings/[id].
// Returned to the page wrapper; rendered by the booking-detail
// section components. RLS scopes the read to the caller's household.
//
// For App 3.8 preview-as-member, the parallel entry
// getBookingDetailById(client, bookingId) trusts admin RLS to allow
// any booking and returns the same shape — same components on top.

export interface BookingGearItem {
  name: string;
  description: string | null;
  quantity: number | null;
  required: boolean;
}

export interface BookingFaqEntry {
  question: string;
  answer: string;
}

export interface BookingDiscipline {
  serviceId: string;
  serviceName: string;
}

export interface BookingAddOn {
  serviceId: string;
  serviceName: string;
  addOnId: string;
  addOnName: string;
  quantity: number;
  unitPrice: number;
}

export interface BookingDetail {
  id: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  property: { name: string; slug: string; timezone: string };
  bookingType: BookingType;
  status: BookingStatus;
  guestCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestNotes: string | null;
  bookedBy: { firstName: string | null; lastName: string | null } | null;
  isMine: boolean;
  instructor: { name: string } | null;
  pricing: {
    confirmedPrice: number | null;
    estimatedPrice: number | null;
    depositAmount: number | null;
    amountPaid: number;
  };
  bid: {
    slug: string;
    status: BidStatus;
    scheduleNotes: string | null;
    gearList: BookingGearItem[];
    faq: BookingFaqEntry[];
    signedAt: string | null;
    expiresAt: string | null;
  } | null;
  disciplines: BookingDiscipline[];
  addOns: BookingAddOn[];
  shareToken: string | null;
  shareNote: string | null;
}

export interface BookingDetailResult {
  data: BookingDetail | null;
  error: { message: string } | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Tolerant gear-list parser. The bids.gear_list column is jsonb with no
// schema enforcement at the DB layer — staff edit it through the admin
// UI. Accept anything iterable; fall back to a name-only entry if a
// single string lands in the array. Filter unparseable junk.
// Exported so the public shared-trip service reuses the same parsing.
export function parseGearList(raw: unknown): BookingGearItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): BookingGearItem[] => {
    if (typeof entry === "string") {
      return [{ name: entry, description: null, quantity: null, required: false }];
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name : null;
      if (!name) return [];
      return [
        {
          name,
          description:
            typeof obj.description === "string" ? obj.description : null,
          quantity: typeof obj.quantity === "number" ? obj.quantity : null,
          required: obj.required === true,
        },
      ];
    }
    return [];
  });
}

export function parseFaq(raw: unknown): BookingFaqEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): BookingFaqEntry[] => {
    if (!entry || typeof entry !== "object") return [];
    const obj = entry as Record<string, unknown>;
    const question = typeof obj.question === "string" ? obj.question : null;
    const answer = typeof obj.answer === "string" ? obj.answer : null;
    if (!question || !answer) return [];
    return [{ question, answer }];
  });
}

const BOOKING_DETAIL_SELECT = `
  id, start_time, end_time, duration_hours, booking_type, status,
  guest_count, guest_name, guest_email, guest_phone, guest_notes,
  member_user_id, share_token, share_note,
  confirmed_price, estimated_price, deposit_amount, amount_paid,
  properties ( name, slug, timezone ),
  instructors ( name ),
  bids ( slug, status, schedule_notes, gear_list, faq, signed_at, expires_at ),
  booking_disciplines ( service_id, services ( name ) ),
  booking_add_ons (
    service_id, add_on_id, quantity, unit_price_at_booking,
    services ( name ),
    add_ons ( name )
  )
`;

interface BookingDetailQueryRow {
  id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  booking_type: BookingType;
  status: BookingStatus;
  guest_count: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_notes: string | null;
  member_user_id: string | null;
  share_token: string | null;
  share_note: string | null;
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
    | Array<{
        slug: string;
        status: BidStatus;
        schedule_notes: string | null;
        gear_list: unknown;
        faq: unknown;
        signed_at: string | null;
        expires_at: string | null;
      }>
    | {
        slug: string;
        status: BidStatus;
        schedule_notes: string | null;
        gear_list: unknown;
        faq: unknown;
        signed_at: string | null;
        expires_at: string | null;
      }
    | null;
  booking_disciplines: Array<{
    service_id: string;
    services: { name: string } | { name: string }[] | null;
  }> | null;
  booking_add_ons: Array<{
    service_id: string;
    add_on_id: string;
    quantity: number;
    unit_price_at_booking: string | number | null;
    services: { name: string } | { name: string }[] | null;
    add_ons: { name: string } | { name: string }[] | null;
  }> | null;
}

// /member entry. RLS narrows the booking to the caller's household.
// Returns null when the booking doesn't exist OR RLS hides it.
export async function getMyBookingDetail(
  supabase: SupabaseClient,
  bookingId: string,
  currentUserId: string,
): Promise<BookingDetailResult> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_DETAIL_SELECT)
    .eq("id", bookingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  if (!data) {
    return { data: null, error: null };
  }

  const row = data as unknown as BookingDetailQueryRow;
  return normalizeDetail(supabase, row, currentUserId);
}

async function normalizeDetail(
  supabase: SupabaseClient,
  row: BookingDetailQueryRow,
  currentUserId: string | null,
): Promise<BookingDetailResult> {
  const property = pickOne(row.properties);
  const instructor = pickOne(row.instructors);
  const bid = pickOne(row.bids);

  // Resolve booker name via people lookup (no FK from
  // bookings.member_user_id → people.user_id, matches the list service).
  let bookedBy: BookingDetail["bookedBy"] = null;
  if (row.member_user_id) {
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("user_id", row.member_user_id)
      .maybeSingle();
    if (personError) {
      return { data: null, error: { message: personError.message } };
    }
    bookedBy = person
      ? { firstName: person.first_name, lastName: person.last_name }
      : null;
  }

  const disciplines: BookingDiscipline[] = (row.booking_disciplines ?? [])
    .flatMap((d): BookingDiscipline[] => {
      const service = pickOne(d.services);
      if (!service) return [];
      return [{ serviceId: d.service_id, serviceName: service.name }];
    });

  const addOns: BookingAddOn[] = (row.booking_add_ons ?? []).flatMap(
    (a): BookingAddOn[] => {
      const service = pickOne(a.services);
      const addOn = pickOne(a.add_ons);
      if (!service || !addOn) return [];
      return [
        {
          serviceId: a.service_id,
          serviceName: service.name,
          addOnId: a.add_on_id,
          addOnName: addOn.name,
          quantity: a.quantity,
          unitPrice: toNumber(a.unit_price_at_booking) ?? 0,
        },
      ];
    },
  );

  const detail: BookingDetail = {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    durationHours: row.duration_hours,
    property: {
      name: property?.name ?? "—",
      slug: property?.slug ?? "",
      timezone: property?.timezone ?? "America/Chicago",
    },
    bookingType: row.booking_type,
    status: row.status,
    guestCount: row.guest_count,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    guestNotes: row.guest_notes,
    bookedBy,
    isMine: row.member_user_id !== null && row.member_user_id === currentUserId,
    instructor: instructor ? { name: instructor.name } : null,
    pricing: {
      confirmedPrice: toNumber(row.confirmed_price),
      estimatedPrice: toNumber(row.estimated_price),
      depositAmount: toNumber(row.deposit_amount),
      amountPaid: toNumber(row.amount_paid) ?? 0,
    },
    bid: bid
      ? {
          slug: bid.slug,
          status: bid.status,
          scheduleNotes: bid.schedule_notes,
          gearList: parseGearList(bid.gear_list),
          faq: parseFaq(bid.faq),
          signedAt: bid.signed_at,
          expiresAt: bid.expires_at,
        }
      : null,
    disciplines,
    addOns,
    shareToken: row.share_token,
    shareNote: row.share_note,
  };

  return { data: detail, error: null };
}

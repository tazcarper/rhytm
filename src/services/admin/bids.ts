import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminBidStatus =
  | "pending_review"
  | "confirmed"
  | "denied"
  | "signed"
  | "paid"
  | "expired"
  | "refunded";

export type AdminBookingType =
  | "plan_a_visit"
  | "private_lesson"
  | "host_an_occasion";

export const ADMIN_BID_STATUSES: ReadonlyArray<AdminBidStatus> = [
  "pending_review",
  "confirmed",
  "signed",
  "paid",
  "refunded",
  "denied",
  "expired",
];

export interface AdminBidListFilters {
  status?: AdminBidStatus;
  propertyId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminBidListRow {
  id: string;
  slug: string;
  status: AdminBidStatus;
  createdAt: string;
  bookingId: string;
  bookingType: AdminBookingType;
  startTime: string;
  durationHours: number;
  guestName: string;
  guestEmail: string;
  guestCount: number;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  propertyTimezone: string;
  estimatedPrice: number | null;
  confirmedPrice: number | null;
  // App 6 Path A. effectiveQuote = confirmedPrice ?? estimatedPrice —
  // used together with amountPaid + depositAmount to render the
  // "Paid in full / Deposit paid / Partial payment" badge in the
  // bids list.
  effectiveQuote: number | null;
  depositAmount: number | null;
  amountPaid: number;
}

export interface AdminBidListResult {
  rows: AdminBidListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

type BidsRow = {
  id: string;
  slug: string;
  status: AdminBidStatus;
  created_at: string;
  booking_id: string;
  bookings: {
    booking_type: AdminBookingType;
    start_time: string;
    duration_hours: number;
    guest_name: string;
    guest_email: string;
    guest_count: number;
    estimated_price: number | string | null;
    confirmed_price: number | string | null;
    deposit_amount: number | string | null;
    amount_paid: number | string | null;
    property_id: string;
    properties: {
      name: string;
      slug: string;
      timezone: string;
    };
  };
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

export async function getAdminBidsList(
  supabase: SupabaseClient,
  filters: AdminBidListFilters = {},
): Promise<AdminBidListResult> {
  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let query = supabase
    .from("bids")
    .select(
      `
      id, slug, status, created_at, booking_id,
      bookings!inner (
        booking_type, start_time, duration_hours,
        guest_name, guest_email, guest_count,
        estimated_price, confirmed_price, deposit_amount, amount_paid,
        property_id,
        properties!inner ( name, slug, timezone )
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.propertyId) {
    query = query.eq("bookings.property_id", filters.propertyId);
  }
  if (filters.from) {
    query = query.gte("bookings.start_time", `${filters.from}T00:00:00Z`);
  }
  if (filters.to) {
    query = query.lte("bookings.start_time", `${filters.to}T23:59:59Z`);
  }
  if (filters.q) {
    const safeSearchTerm = filters.q.replace(/[%(),]/g, "").trim();
    if (safeSearchTerm) {
      query = query.or(
        `guest_name.ilike.%${safeSearchTerm}%,guest_email.ilike.%${safeSearchTerm}%`,
        { referencedTable: "bookings" },
      );
    }
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Admin bids list failed: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as BidsRow[]).map(
    (row): AdminBidListRow => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      createdAt: row.created_at,
      bookingId: row.booking_id,
      bookingType: row.bookings.booking_type,
      startTime: row.bookings.start_time,
      durationHours: row.bookings.duration_hours,
      guestName: row.bookings.guest_name,
      guestEmail: row.bookings.guest_email,
      guestCount: row.bookings.guest_count,
      propertyId: row.bookings.property_id,
      propertyName: row.bookings.properties.name,
      propertySlug: row.bookings.properties.slug,
      propertyTimezone: row.bookings.properties.timezone,
      estimatedPrice: toNumber(row.bookings.estimated_price),
      confirmedPrice: toNumber(row.bookings.confirmed_price),
      effectiveQuote:
        toNumber(row.bookings.confirmed_price) ??
        toNumber(row.bookings.estimated_price),
      depositAmount: toNumber(row.bookings.deposit_amount),
      amountPaid: toNumber(row.bookings.amount_paid) ?? 0,
    }),
  );

  const totalCount = count ?? rows.length;
  return {
    rows,
    totalCount,
    page,
    pageSize,
    hasMore: rangeFrom + rows.length < totalCount,
  };
}

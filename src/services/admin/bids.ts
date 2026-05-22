import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminBidStatus =
  | "pending_review"
  | "confirmed"
  | "denied"
  | "signed"
  | "paid"
  | "expired";

export type AdminBookingType =
  | "plan_a_visit"
  | "private_lesson"
  | "host_an_occasion";

export const ADMIN_BID_STATUSES: ReadonlyArray<AdminBidStatus> = [
  "pending_review",
  "confirmed",
  "signed",
  "paid",
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
    estimated_price: number | null;
    confirmed_price: number | null;
    property_id: string;
    properties: {
      name: string;
      slug: string;
      timezone: string;
    };
  };
};

export async function getAdminBidsList(
  supabase: SupabaseClient,
  filters: AdminBidListFilters = {},
): Promise<AdminBidListResult> {
  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let q = supabase
    .from("bids")
    .select(
      `
      id, slug, status, created_at, booking_id,
      bookings!inner (
        booking_type, start_time, duration_hours,
        guest_name, guest_email, guest_count,
        estimated_price, confirmed_price,
        property_id,
        properties!inner ( name, slug, timezone )
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.propertyId) {
    q = q.eq("bookings.property_id", filters.propertyId);
  }
  if (filters.from) {
    q = q.gte("bookings.start_time", `${filters.from}T00:00:00Z`);
  }
  if (filters.to) {
    q = q.lte("bookings.start_time", `${filters.to}T23:59:59Z`);
  }
  if (filters.q) {
    const safe = filters.q.replace(/[%(),]/g, "").trim();
    if (safe) {
      q = q.or(
        `guest_name.ilike.%${safe}%,guest_email.ilike.%${safe}%`,
        { referencedTable: "bookings" },
      );
    }
  }

  const { data, count, error } = await q;
  if (error) {
    throw new Error(`Admin bids list failed: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as BidsRow[]).map(
    (r): AdminBidListRow => ({
      id: r.id,
      slug: r.slug,
      status: r.status,
      createdAt: r.created_at,
      bookingId: r.booking_id,
      bookingType: r.bookings.booking_type,
      startTime: r.bookings.start_time,
      durationHours: r.bookings.duration_hours,
      guestName: r.bookings.guest_name,
      guestEmail: r.bookings.guest_email,
      guestCount: r.bookings.guest_count,
      propertyId: r.bookings.property_id,
      propertyName: r.bookings.properties.name,
      propertySlug: r.bookings.properties.slug,
      propertyTimezone: r.bookings.properties.timezone,
      estimatedPrice: r.bookings.estimated_price,
      confirmedPrice: r.bookings.confirmed_price,
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

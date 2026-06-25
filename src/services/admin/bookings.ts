import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminBookingType } from "@/src/services/admin/bids";

export type { AdminBookingType };

export type AdminBookingStatus =
  | "pending_review"
  | "awaiting_guest"
  | "denied"
  | "signed"
  | "deposit_paid"
  | "fulfilled"
  | "cancelled"
  | "expired";

export const ADMIN_BOOKING_STATUSES: ReadonlyArray<AdminBookingStatus> = [
  "pending_review",
  "awaiting_guest",
  "signed",
  "deposit_paid",
  "fulfilled",
  "denied",
  "cancelled",
  "expired",
];

export const ADMIN_BOOKING_TYPES: ReadonlyArray<AdminBookingType> = [
  "plan_a_visit",
  "private_lesson",
  "host_an_occasion",
];

export interface AdminBookingListFilters {
  status?: AdminBookingStatus;
  propertyId?: string;
  type?: AdminBookingType;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminBookingListRow {
  id: string;
  status: AdminBookingStatus;
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
  createdAt: string;
  bidId: string | null;
}

export interface AdminBookingListResult {
  rows: AdminBookingListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

type BookingsRow = {
  id: string;
  status: AdminBookingStatus;
  booking_type: AdminBookingType;
  start_time: string;
  duration_hours: number;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  created_at: string;
  property_id: string;
  properties: {
    name: string;
    slug: string;
    timezone: string;
  };
  bids: Array<{ id: string }> | { id: string } | null;
};

export async function getAdminBookingsList(
  supabase: SupabaseClient,
  filters: AdminBookingListFilters = {},
): Promise<AdminBookingListResult> {
  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let query = supabase
    .from("bookings")
    .select(
      `
      id, status, booking_type, start_time, duration_hours,
      guest_name, guest_email, guest_count, created_at,
      property_id,
      properties!inner ( name, slug, timezone ),
      bids ( id )
    `,
      { count: "exact" },
    )
    .order("start_time", { ascending: true })
    .range(rangeFrom, rangeTo)
    // Soft-deleted bookings are gone from the schedule (list + calendar both
    // read through here). They're recoverable from the bids "Deleted" view.
    .is("deleted_at", null);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }
  if (filters.type) {
    query = query.eq("booking_type", filters.type);
  }
  if (filters.from) {
    query = query.gte("start_time", `${filters.from}T00:00:00Z`);
  }
  if (filters.to) {
    query = query.lte("start_time", `${filters.to}T23:59:59Z`);
  }
  if (filters.q) {
    const safeSearchTerm = filters.q.replace(/[%(),]/g, "").trim();
    if (safeSearchTerm) {
      query = query.or(
        `guest_name.ilike.%${safeSearchTerm}%,guest_email.ilike.%${safeSearchTerm}%`,
      );
    }
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Admin bookings list failed: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as BookingsRow[]).map(
    (row): AdminBookingListRow => {
      const bid = Array.isArray(row.bids) ? row.bids[0] : row.bids;
      return {
        id: row.id,
        status: row.status,
        bookingType: row.booking_type,
        startTime: row.start_time,
        durationHours: row.duration_hours,
        guestName: row.guest_name,
        guestEmail: row.guest_email,
        guestCount: row.guest_count,
        propertyId: row.property_id,
        propertyName: row.properties.name,
        propertySlug: row.properties.slug,
        propertyTimezone: row.properties.timezone,
        createdAt: row.created_at,
        bidId: bid?.id ?? null,
      };
    },
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

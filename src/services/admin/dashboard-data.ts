import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminBidListRow,
  AdminBidStatus,
  AdminBookingType,
} from "./bids";

// Row shape returned by the dashboard's nested PostgREST select. Mirrors
// the shape from `getAdminBidsList` so the consumers can share a single
// row type. Kept private to this module — the public surface is the
// `AdminBidListRow` type from `./bids`.
type DashboardBidRow = {
  id: string;
  slug: string;
  status: AdminBidStatus;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
  paid_at: string | null;
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

const SELECT = `
  id, slug, status, created_at, updated_at, signed_at, paid_at, booking_id,
  bookings!inner (
    booking_type, start_time, duration_hours,
    guest_name, guest_email, guest_count,
    estimated_price, confirmed_price, deposit_amount, amount_paid,
    property_id,
    properties!inner ( name, slug, timezone )
  )
`;

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

function toRow(r: DashboardBidRow): AdminBidListRow {
  const estimated = toNumber(r.bookings.estimated_price);
  const confirmed = toNumber(r.bookings.confirmed_price);
  return {
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
    estimatedPrice: estimated,
    confirmedPrice: confirmed,
    effectiveQuote: confirmed ?? estimated,
    depositAmount: toNumber(r.bookings.deposit_amount),
    amountPaid: toNumber(r.bookings.amount_paid) ?? 0,
    signedAt: r.signed_at,
    paidAt: r.paid_at,
  };
}

export interface DashboardActivityRow extends AdminBidListRow {
  updatedAt: string;
}

export interface PropertyColumn {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  rows: AdminBidListRow[];
}

export interface AdminDashboardData {
  pendingBidCount: number;
  recentPending: AdminBidListRow[];
  confirmedNext24hCount: number;
  confirmedTodayByProperty: PropertyColumn[];
  confirmedTomorrowByProperty: PropertyColumn[];
  upcomingWeekCount: number;
  upcomingByProperty: PropertyColumn[];
  recentActivity: DashboardActivityRow[];
}

// All 3 properties share America/Chicago today, so the "is this today
// or tomorrow" bucketing uses a single timezone. If a property ever
// adopts a different timezone, this needs to read `propertyTimezone`
// per row instead.
const DASHBOARD_TIMEZONE = "America/Chicago";

function ctDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const PENDING_LIMIT = 5;
const TIMELINE_LIMIT = 15;
const WEEK_LIMIT = 30;
const ACTIVITY_LIMIT = 10;

export async function getAdminDashboardData(
  supabase: SupabaseClient,
): Promise<AdminDashboardData> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const nowIso = now.toISOString();
  const in24hIso = in24h.toISOString();
  const in7dIso = in7d.toISOString();

  const [pending, confirmedSoon, upcoming, activity, properties] =
    await Promise.all([
      supabase
        .from("bids")
        .select(SELECT, { count: "exact" })
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .range(0, PENDING_LIMIT - 1),
      supabase
        .from("bids")
        .select(SELECT, { count: "exact" })
        .eq("status", "confirmed")
        .gte("bookings.start_time", nowIso)
        .lte("bookings.start_time", in24hIso)
        .order("start_time", { ascending: true, referencedTable: "bookings" })
        .range(0, TIMELINE_LIMIT - 1),
      supabase
        .from("bids")
        .select(SELECT, { count: "exact" })
        .in("status", ["confirmed", "signed", "paid"])
        .gte("bookings.start_time", nowIso)
        .lte("bookings.start_time", in7dIso)
        .order("start_time", { ascending: true, referencedTable: "bookings" })
        .range(0, WEEK_LIMIT - 1),
      supabase
        .from("bids")
        .select(SELECT)
        .order("updated_at", { ascending: false })
        .range(0, ACTIVITY_LIMIT - 1),
      supabase
        .from("properties")
        .select("id, name, slug")
        .order("name", { ascending: true }),
    ]);

  if (pending.error) {
    throw new Error(`Dashboard pending bids: ${pending.error.message}`);
  }
  if (confirmedSoon.error) {
    throw new Error(`Dashboard confirmed-soon: ${confirmedSoon.error.message}`);
  }
  if (upcoming.error) {
    throw new Error(`Dashboard upcoming week: ${upcoming.error.message}`);
  }
  if (activity.error) {
    throw new Error(`Dashboard activity: ${activity.error.message}`);
  }
  if (properties.error) {
    throw new Error(`Dashboard properties: ${properties.error.message}`);
  }

  const upcomingRows = ((upcoming.data ?? []) as unknown as DashboardBidRow[]).map(
    toRow,
  );
  const confirmedRows = (
    (confirmedSoon.data ?? []) as unknown as DashboardBidRow[]
  ).map(toRow);

  const todayCt = ctDateOf(now.toISOString());
  const tomorrowCt = ctDateOf(in24h.toISOString());

  const confirmedToday = confirmedRows.filter(
    (r) => ctDateOf(r.startTime) === todayCt,
  );
  const confirmedTomorrow = confirmedRows.filter(
    (r) => ctDateOf(r.startTime) === tomorrowCt,
  );

  const propertyList = (properties.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  const groupByProperty = (rows: AdminBidListRow[]): PropertyColumn[] =>
    propertyList.map((p) => ({
      propertyId: p.id,
      propertyName: p.name,
      propertySlug: p.slug,
      rows: rows.filter((r) => r.propertyId === p.id),
    }));

  return {
    pendingBidCount: pending.count ?? 0,
    recentPending: ((pending.data ?? []) as unknown as DashboardBidRow[]).map(toRow),
    confirmedNext24hCount: confirmedSoon.count ?? 0,
    confirmedTodayByProperty: groupByProperty(confirmedToday),
    confirmedTomorrowByProperty: groupByProperty(confirmedTomorrow),
    upcomingWeekCount: upcoming.count ?? 0,
    upcomingByProperty: groupByProperty(upcomingRows),
    recentActivity: ((activity.data ?? []) as unknown as DashboardBidRow[]).map(
      (r) => ({ ...toRow(r), updatedAt: r.updated_at }),
    ),
  };
}

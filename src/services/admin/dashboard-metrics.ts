import type { SupabaseClient } from "@supabase/supabase-js";

// Trend + money metrics for the admin dashboard home. Kept separate from
// dashboard-data.ts (queue/schedule feed) on purpose — this module's single
// job is aggregate numbers and day-bucketed series for the KPI cards and
// charts. See docs/dashboard-redesign-plan.md.

const METRICS_TIMEZONE = "America/Chicago";
const TREND_DAYS = 30;
const OUTLOOK_DAYS = 14;
// Well above launch-scale volume; guards the unbounded selects.
const ROW_CAP = 2000;

export interface TrendPoint {
  /** en-CA date key in club time, e.g. "2026-07-08" */
  date: string;
  /** Short axis label, e.g. "Jul 8" */
  label: string;
  value: number;
}

export interface PropertySeries {
  slug: string;
  name: string;
}

export interface OutlookPoint {
  date: string;
  label: string;
  /** Booking count per property slug for this day. */
  counts: Record<string, number>;
}

export interface AdminDashboardMetrics {
  /** Dollars collected across bids that reached paid in the last 30 days. */
  collected30d: number;
  paidCount30d: number;
  bidsCreated30d: number;
  /** New bids per day, last 30 days (zero-filled). */
  bidTrend: TrendPoint[];
  /** Confirmed/signed/paid bookings per property per day, next 14 days. */
  outlook: OutlookPoint[];
  outlookSeries: PropertySeries[];
  outlookTotal: number;
}

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: METRICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Zero-filled day scaffold covering [start, start + days). */
function dayScaffold(start: Date, days: number): Array<{ date: string; label: string }> {
  const scaffold: Array<{ date: string; label: string }> = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start.getTime() + offset * 24 * 3600 * 1000);
    scaffold.push({ date: dayKey(day.toISOString()), label: dayLabel(day) });
  }
  return scaffold;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : value;
}

export async function getAdminDashboardMetrics(
  supabase: SupabaseClient,
): Promise<AdminDashboardMetrics> {
  const now = new Date();
  const trendStart = new Date(
    now.getTime() - (TREND_DAYS - 1) * 24 * 3600 * 1000,
  );
  const outlookEnd = new Date(
    now.getTime() + OUTLOOK_DAYS * 24 * 3600 * 1000,
  );

  const [created, paid, upcoming, properties] = await Promise.all([
    supabase
      .from("bids")
      .select("created_at")
      .is("deleted_at", null)
      .gte("created_at", trendStart.toISOString())
      .limit(ROW_CAP),
    supabase
      .from("bids")
      .select("paid_at, bookings!inner ( amount_paid )")
      .is("deleted_at", null)
      .not("paid_at", "is", null)
      .gte("paid_at", trendStart.toISOString())
      .limit(ROW_CAP),
    supabase
      .from("bids")
      .select("bookings!inner ( start_time, properties!inner ( slug ) )")
      .in("status", ["confirmed", "signed", "paid"])
      .is("deleted_at", null)
      .gte("bookings.start_time", now.toISOString())
      .lte("bookings.start_time", outlookEnd.toISOString())
      .limit(ROW_CAP),
    supabase
      .from("properties")
      .select("name, slug")
      .order("name", { ascending: true }),
  ]);

  if (created.error) {
    throw new Error(`Dashboard metrics (created): ${created.error.message}`);
  }
  if (paid.error) {
    throw new Error(`Dashboard metrics (paid): ${paid.error.message}`);
  }
  if (upcoming.error) {
    throw new Error(`Dashboard metrics (upcoming): ${upcoming.error.message}`);
  }
  if (properties.error) {
    throw new Error(
      `Dashboard metrics (properties): ${properties.error.message}`,
    );
  }

  const createdRows = (created.data ?? []) as Array<{ created_at: string }>;
  const paidRows = (paid.data ?? []) as unknown as Array<{
    paid_at: string;
    bookings: { amount_paid: number | string | null };
  }>;
  const upcomingRows = (upcoming.data ?? []) as unknown as Array<{
    bookings: { start_time: string; properties: { slug: string } };
  }>;
  const propertyRows = (properties.data ?? []) as Array<{
    name: string;
    slug: string;
  }>;

  // New-bid trend, zero-filled per day.
  const createdByDay = new Map<string, number>();
  for (const row of createdRows) {
    const key = dayKey(row.created_at);
    createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1);
  }
  const bidTrend: TrendPoint[] = dayScaffold(trendStart, TREND_DAYS).map(
    (day) => ({ ...day, value: createdByDay.get(day.date) ?? 0 }),
  );

  // Money collected.
  const collected30d = paidRows.reduce(
    (sum, row) => sum + toNumber(row.bookings.amount_paid),
    0,
  );

  // Next-14-days outlook, bucketed day × property.
  const outlookSeries: PropertySeries[] = propertyRows.map((p) => ({
    slug: p.slug,
    name: p.name,
  }));
  const outlookByDay = new Map<string, Record<string, number>>();
  for (const row of upcomingRows) {
    const key = dayKey(row.bookings.start_time);
    const slug = row.bookings.properties.slug;
    const bucket = outlookByDay.get(key) ?? {};
    bucket[slug] = (bucket[slug] ?? 0) + 1;
    outlookByDay.set(key, bucket);
  }
  const outlook: OutlookPoint[] = dayScaffold(now, OUTLOOK_DAYS).map((day) => {
    const bucket = outlookByDay.get(day.date) ?? {};
    const counts: Record<string, number> = {};
    for (const series of outlookSeries) {
      counts[series.slug] = bucket[series.slug] ?? 0;
    }
    return { ...day, counts };
  });

  return {
    collected30d,
    paidCount30d: paidRows.length,
    bidsCreated30d: createdRows.length,
    bidTrend,
    outlook,
    outlookSeries,
    outlookTotal: upcomingRows.length,
  };
}

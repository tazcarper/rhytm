import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedCountsByEvent } from "@/src/services/admin/events";

// Aggregate numbers and time-bucketed series for the events page's trend
// chart + KPI row. Kept separate from events.ts (CRUD/list) on purpose —
// this module's single job is aggregation, same split as
// dashboard-metrics.ts vs. dashboard-data.ts.

const METRICS_TIMEZONE = "America/Chicago";
// Well above launch-scale volume; guards the unbounded selects.
const ROW_CAP = 2000;

export type EventsTrendRange = "1w" | "1m" | "3m" | "6m" | "1y";
type Granularity = "day" | "week" | "month";

const RANGE_CONFIG: Record<
  EventsTrendRange,
  { days: number; granularity: Granularity }
> = {
  "1w": { days: 7, granularity: "day" },
  "1m": { days: 30, granularity: "day" },
  "3m": { days: 90, granularity: "week" },
  "6m": { days: 180, granularity: "week" },
  "1y": { days: 365, granularity: "month" },
};

export const EVENTS_TREND_RANGES: ReadonlyArray<{
  value: EventsTrendRange;
  label: string;
}> = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

export function isEventsTrendRange(value: string): value is EventsTrendRange {
  return value in RANGE_CONFIG;
}

export interface EventsTrendPoint {
  /** Bucket identity — a day/week-start (YYYY-MM-DD) or month (YYYY-MM) key. */
  date: string;
  /** Short axis label, e.g. "Jul 8" or "Jan". */
  label: string;
  /** Confirmed signup count (summed guest_count) per property slug. */
  counts: Record<string, number>;
}

export interface PropertySeries {
  slug: string;
  name: string;
}

export interface EventsSignupTrend {
  points: EventsTrendPoint[];
  series: PropertySeries[];
  total: number;
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: METRICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(date);
}

function monthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: METRICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TIMEZONE,
    month: "short",
  }).format(date);
}

interface Bucket {
  date: string;
  label: string;
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 3600 * 1000;

function buildDailyBuckets(now: Date, days: number): Bucket[] {
  const buckets: Bucket[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getTime() - offset * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    buckets.push({ date: dayKey(start), label: dayLabel(start), start, end });
  }
  return buckets;
}

function buildWeeklyBuckets(now: Date, days: number): Bucket[] {
  const weeks = Math.ceil(days / 7);
  const buckets: Bucket[] = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getTime() - (offset * 7 + 6) * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    buckets.push({ date: dayKey(start), label: dayLabel(start), start, end });
  }
  return buckets;
}

// 12 calendar months ending with the current month. Anchored to the 15th of
// each month (not the 1st) so the METRICS_TIMEZONE conversion never rolls a
// UTC-midnight instant into the adjacent month — a real risk on the 1st.
function buildMonthlyBuckets(now: Date, months: number): Bucket[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? now.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? now.getMonth() + 1);

  const buckets: Bucket[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const mid = new Date(Date.UTC(year, month - 1 - offset, 15));
    const rangeStart = new Date(Date.UTC(year, month - 1 - offset, 1));
    const rangeEnd = new Date(Date.UTC(year, month - offset, 1));
    buckets.push({
      date: monthKey(mid),
      label: monthLabel(mid),
      start: rangeStart,
      end: rangeEnd,
    });
  }
  return buckets;
}

function buildBuckets(
  range: EventsTrendRange,
  now: Date,
): { trendStart: Date; granularity: Granularity; buckets: Bucket[] } {
  const config = RANGE_CONFIG[range];
  if (config.granularity === "day") {
    const buckets = buildDailyBuckets(now, config.days);
    return { trendStart: buckets[0].start, granularity: "day", buckets };
  }
  if (config.granularity === "week") {
    const buckets = buildWeeklyBuckets(now, config.days);
    return { trendStart: buckets[0].start, granularity: "week", buckets };
  }
  const buckets = buildMonthlyBuckets(now, 12);
  return { trendStart: buckets[0].start, granularity: "month", buckets };
}

// Day/month buckets are matched by direct key (cheap, exact); week buckets
// have no single-format key so they're matched by instant range instead.
function findBucketIndex(
  iso: string,
  granularity: Granularity,
  buckets: ReadonlyArray<Bucket>,
): number {
  const date = new Date(iso);
  if (granularity === "day") {
    const key = dayKey(date);
    return buckets.findIndex((bucket) => bucket.date === key);
  }
  if (granularity === "month") {
    const key = monthKey(date);
    return buckets.findIndex((bucket) => bucket.date === key);
  }
  const time = date.getTime();
  return buckets.findIndex(
    (bucket) => time >= bucket.start.getTime() && time < bucket.end.getTime(),
  );
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : value;
}

type RegistrationTrendRow = {
  created_at: string;
  guest_count: number;
  events: { properties: { slug: string } };
};

/**
 * Confirmed signups (guest_count), bucketed by signup date and stacked by
 * property — the events page's main trend chart. Range picks both the
 * lookback window and the bucket granularity (day/week/month) so a 1-year
 * view isn't 365 unreadable bars.
 */
export async function getEventsSignupTrend(
  supabase: SupabaseClient,
  range: EventsTrendRange,
): Promise<EventsSignupTrend> {
  const now = new Date();
  const { trendStart, granularity, buckets } = buildBuckets(range, now);

  const [registrationsResult, propertiesResult] = await Promise.all([
    supabase
      .from("event_registrations")
      .select(
        "created_at, guest_count, events!inner ( is_template, properties!inner ( slug ) )",
      )
      .eq("status", "confirmed")
      .eq("events.is_template", false)
      .gte("created_at", trendStart.toISOString())
      .limit(ROW_CAP),
    supabase.from("properties").select("name, slug").order("name", { ascending: true }),
  ]);

  if (registrationsResult.error) {
    throw new Error(`Events signup trend: ${registrationsResult.error.message}`);
  }
  if (propertiesResult.error) {
    throw new Error(`Events signup trend (properties): ${propertiesResult.error.message}`);
  }

  const series: PropertySeries[] = (propertiesResult.data ?? []).map((property) => ({
    slug: property.slug,
    name: property.name,
  }));
  const rows = (registrationsResult.data ?? []) as unknown as RegistrationTrendRow[];

  const bucketCounts: Array<Record<string, number>> = buckets.map(() => ({}));
  let total = 0;
  for (const row of rows) {
    const index = findBucketIndex(row.created_at, granularity, buckets);
    if (index === -1) continue;
    const slug = row.events.properties.slug;
    bucketCounts[index][slug] = (bucketCounts[index][slug] ?? 0) + row.guest_count;
    total += row.guest_count;
  }

  const points: EventsTrendPoint[] = buckets.map((bucket, index) => {
    const counts: Record<string, number> = {};
    for (const propertySeries of series) {
      counts[propertySeries.slug] = bucketCounts[index][propertySeries.slug] ?? 0;
    }
    return { date: bucket.date, label: bucket.label, counts };
  });

  return { points, series, total };
}

export interface EventsBusinessMetrics {
  /** Dated, published, non-template events starting from now on. */
  upcomingCount: number;
  /** Confirmed signups (guest_count) in the last 30 days. */
  signups30d: number;
  /** Share of those 30-day signups at the member rate, or null if there were none. */
  memberSharePct: number | null;
  /** Mean confirmed-capacity fill across upcoming published events, or null if none. */
  avgFillRatePct: number | null;
  /** Sum of price_quoted across confirmed registrations for upcoming, non-cancelled events. */
  revenueUpcoming: number;
  /** Upcoming events currently at status = sold_out. */
  soldOutCount: number;
}

export async function getEventsBusinessMetrics(
  supabase: SupabaseClient,
): Promise<EventsBusinessMetrics> {
  const now = new Date();
  const recentStart = new Date(now.getTime() - 29 * DAY_MS);

  const [upcomingEventsResult, recentRegistrationsResult, upcomingRegistrationsResult, soldOutResult] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, max_capacity")
        .eq("is_template", false)
        .eq("status", "published")
        .not("start_at", "is", null)
        .gte("start_at", now.toISOString())
        .limit(ROW_CAP),
      supabase
        .from("event_registrations")
        .select("guest_count, is_member_rate")
        .eq("status", "confirmed")
        .gte("created_at", recentStart.toISOString())
        .limit(ROW_CAP),
      supabase
        .from("event_registrations")
        .select("price_quoted, events!inner ( is_template, status, start_at )")
        .eq("status", "confirmed")
        .eq("events.is_template", false)
        .neq("events.status", "cancelled")
        .gte("events.start_at", now.toISOString())
        .limit(ROW_CAP),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("is_template", false)
        .eq("status", "sold_out")
        .not("start_at", "is", null)
        .gte("start_at", now.toISOString()),
    ]);

  if (upcomingEventsResult.error) {
    throw new Error(`Events metrics (upcoming): ${upcomingEventsResult.error.message}`);
  }
  if (recentRegistrationsResult.error) {
    throw new Error(`Events metrics (signups): ${recentRegistrationsResult.error.message}`);
  }
  if (upcomingRegistrationsResult.error) {
    throw new Error(`Events metrics (revenue): ${upcomingRegistrationsResult.error.message}`);
  }
  if (soldOutResult.error) {
    throw new Error(`Events metrics (sold out): ${soldOutResult.error.message}`);
  }

  const upcomingEvents = (upcomingEventsResult.data ?? []) as Array<{
    id: string;
    max_capacity: number;
  }>;
  const confirmedByEvent = await confirmedCountsByEvent(
    supabase,
    upcomingEvents.map((event) => event.id),
  );
  const fillRates = upcomingEvents
    .filter((event) => event.max_capacity > 0)
    .map((event) => Math.min(1, (confirmedByEvent.get(event.id) ?? 0) / event.max_capacity));
  const avgFillRatePct =
    fillRates.length > 0
      ? Math.round((fillRates.reduce((sum, rate) => sum + rate, 0) / fillRates.length) * 100)
      : null;

  const recentRegistrations = (recentRegistrationsResult.data ?? []) as Array<{
    guest_count: number;
    is_member_rate: boolean;
  }>;
  const signups30d = recentRegistrations.reduce((sum, row) => sum + row.guest_count, 0);
  const memberGuests = recentRegistrations.reduce(
    (sum, row) => sum + (row.is_member_rate ? row.guest_count : 0),
    0,
  );
  const memberSharePct = signups30d > 0 ? Math.round((memberGuests / signups30d) * 100) : null;

  const upcomingRegistrations = (upcomingRegistrationsResult.data ?? []) as unknown as Array<{
    price_quoted: string | number | null;
  }>;
  const revenueUpcoming = upcomingRegistrations.reduce(
    (sum, row) => sum + toNumber(row.price_quoted),
    0,
  );

  return {
    upcomingCount: upcomingEvents.length,
    signups30d,
    memberSharePct,
    avgFillRatePct,
    revenueUpcoming,
    soldOutCount: soldOutResult.count ?? 0,
  };
}

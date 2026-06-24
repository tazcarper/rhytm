import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminBookingsList,
  type AdminBookingListRow,
  type AdminBookingStatus,
} from "@/src/services/admin/bookings";
import type { AdminProperty } from "@/src/services/admin/properties";

// ---------------------------------------------------------------------------
// Density model (v1: active-booking count buckets).
//
// "Full" in the schema is per time-slot, not per day (check_property_capacity,
// max_concurrent_groups = 1 everywhere), and `time_slots` aren't seeded yet
// (blocked on client Q2 / operating hours), so true slot-utilization can't
// ship today. We bucket by the *count* of active bookings instead. The whole
// metric lives behind computeDayDensity() so it can swap to slot-utilization
// later with no UI change — the colors/legend/cell markup stay the same.
// ---------------------------------------------------------------------------

export type Density = "empty" | "light" | "busy" | "full";

export interface DayCell {
  /** Active bookings on this day (aggregate, or single-property when filtered). */
  total: number;
  /** Active bookings per property id — present even at 0 for known properties. */
  byProperty: Record<string, number>;
  density: Density;
}

// Statuses that do NOT belong on the schedule calendar of committed events.
// Two kinds: "this isn't happening" terminals (cancelled/denied/expired), and
// pending_review — a soft/provisional request whose slot isn't locked yet
// (the /request-estimate front door, plan §6/§10-D). A pending_review request
// must not clutter the schedule; it appears once staff lock + confirm it
// (status advances to awaiting_guest). /book bookings sit at pending_review
// until the guest signs, so this also keeps unconfirmed /book holds off the
// calendar — consistent with "calendar of confirmed events".
const INACTIVE_STATUSES: ReadonlySet<AdminBookingStatus> = new Set([
  "pending_review",
  "cancelled",
  "denied",
  "expired",
]);

// Count → density, evaluated highest-min first. Tune here; nothing else
// references the raw numbers.
export const DENSITY_THRESHOLDS: ReadonlyArray<{ min: number; density: Density }> =
  [
    { min: 5, density: "full" },
    { min: 3, density: "busy" },
    { min: 1, density: "light" },
    { min: 0, density: "empty" },
  ];

function densityForCount(activeCount: number): Density {
  for (const bucket of DENSITY_THRESHOLDS) {
    if (activeCount >= bucket.min) return bucket.density;
  }
  return "empty";
}

/** YYYY-MM-DD for a Date, in UTC — used only for the fetch month bounds. */
function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Per-timezone YYYY-MM-DD formatter cache. Buckets a booking's start_time into
// the calendar date it falls on *in its property's timezone* (all
// America/Chicago today, but this survives a second zone without an audit).
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dateKeyInTz(iso: string, timezone: string): string {
  let formatter = dateKeyFormatters.get(timezone);
  if (!formatter) {
    // en-CA renders YYYY-MM-DD, which matches react-day-picker's CalendarDay.isoDate.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateKeyFormatters.set(timezone, formatter);
  }
  return formatter.format(new Date(iso));
}

/** The calendar date (YYYY-MM-DD, property timezone) a booking falls on. */
export function bookingCalendarDate(row: AdminBookingListRow): string {
  return dateKeyInTz(row.startTime, row.propertyTimezone);
}

export interface MonthBookingsParams {
  /** Limit to one property; omit for all properties. */
  propertyId?: string;
  /** Full year, e.g. 2026. */
  year: number;
  /** 1-based month, 1 = January … 12 = December. */
  month: number;
  /** How many consecutive months to fetch starting at {month} (default 1). */
  monthCount?: number;
}

/**
 * All bookings whose start_time falls within {monthCount} consecutive months
 * starting at the given month. Thin wrapper over getAdminBookingsList with
 * month bounds + a high page size (a couple of months across three properties
 * stays well under 1000). A single contiguous query (rather than one per
 * month) so no booking is fetched twice and double-counted in density.
 *
 * The fetch window is padded one day on each side: getAdminBookingsList filters
 * on UTC bounds, but we bucket by property timezone (CT is UTC-5/-6), so a
 * booking late on the last CT day of the span lands on the next UTC day. The
 * padding guarantees it's fetched; computeDayDensity then buckets it precisely.
 */
export async function getAdminMonthBookings(
  supabase: SupabaseClient,
  { propertyId, year, month, monthCount = 1 }: MonthBookingsParams,
): Promise<AdminBookingListRow[]> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  // day 0 of the month after the span = last day of the span. Date.UTC
  // normalizes a month index past 11 into the next year, so this is rollover-safe.
  const monthEnd = new Date(Date.UTC(year, month - 1 + monthCount, 0));
  const fromDate = new Date(monthStart);
  fromDate.setUTCDate(fromDate.getUTCDate() - 1);
  const toDate = new Date(monthEnd);
  toDate.setUTCDate(toDate.getUTCDate() + 1);

  const result = await getAdminBookingsList(supabase, {
    propertyId,
    from: utcDateKey(fromDate),
    to: utcDateKey(toDate),
    pageSize: 1000,
  });
  return result.rows;
}

/**
 * Pure: bucket bookings into per-day density cells keyed by YYYY-MM-DD (in each
 * booking's property timezone). Only active bookings count. `properties` seeds
 * every cell's byProperty map with a 0 baseline for known properties so the UI
 * can render a per-property count consistently.
 */
export function computeDayDensity(
  rows: ReadonlyArray<AdminBookingListRow>,
  properties: ReadonlyArray<Pick<AdminProperty, "id">>,
): Map<string, DayCell> {
  const knownPropertyIds = properties.map((property) => property.id);
  const cellsByDate = new Map<string, DayCell>();

  for (const row of rows) {
    if (INACTIVE_STATUSES.has(row.status)) continue;
    const dateKey = dateKeyInTz(row.startTime, row.propertyTimezone);

    let cell = cellsByDate.get(dateKey);
    if (!cell) {
      const byProperty: Record<string, number> = {};
      for (const propertyId of knownPropertyIds) byProperty[propertyId] = 0;
      cell = { total: 0, byProperty, density: "empty" };
      cellsByDate.set(dateKey, cell);
    }

    cell.total += 1;
    cell.byProperty[row.propertyId] =
      (cell.byProperty[row.propertyId] ?? 0) + 1;
  }

  for (const cell of cellsByDate.values()) {
    cell.density = densityForCount(cell.total);
  }
  return cellsByDate;
}

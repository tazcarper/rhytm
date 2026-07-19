import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedCountsByEvent, type EventStatus } from "@/src/services/admin/events";
import type { AdminProperty } from "@/src/services/admin/properties";

// ---------------------------------------------------------------------------
// Density model for the events calendar: bucketed by *event count* per day,
// not signup volume — this view answers "what's happening where," the
// signups trend chart on the same page already covers volume. Mirrors
// bookings-calendar.ts's shape (Density/DayCell/computeDayDensity), tuned
// for events running fewer-per-day than bookings.
// ---------------------------------------------------------------------------

export type EventDensity = "empty" | "light" | "busy" | "full";

export interface EventDayCell {
  /** Event count on this day (aggregate, or single-property when filtered). */
  total: number;
  /** Event count per property id — present even at 0 for known properties. */
  byProperty: Record<string, number>;
  density: EventDensity;
}

export interface AdminEventCalendarRow {
  id: string;
  title: string;
  /** Guaranteed non-null — the query only fetches dated events. */
  startAt: string;
  status: EventStatus;
  type: string | null;
  discipline: string | null;
  maxCapacity: number;
  confirmedCount: number;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  propertyTimezone: string;
}

const DENSITY_THRESHOLDS: ReadonlyArray<{ min: number; density: EventDensity }> =
  [
    { min: 3, density: "full" },
    { min: 2, density: "busy" },
    { min: 1, density: "light" },
    { min: 0, density: "empty" },
  ];

function densityForCount(count: number): EventDensity {
  for (const bucket of DENSITY_THRESHOLDS) {
    if (count >= bucket.min) return bucket.density;
  }
  return "empty";
}

// Per-timezone YYYY-MM-DD formatter cache — same technique as
// bookings-calendar.ts's dateKeyInTz.
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dateKeyInTz(iso: string, timezone: string): string {
  let formatter = dateKeyFormatters.get(timezone);
  if (!formatter) {
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

/** The calendar date (YYYY-MM-DD, property timezone) an event falls on. */
export function eventCalendarDate(row: AdminEventCalendarRow): string {
  return dateKeyInTz(row.startAt, row.propertyTimezone);
}

export interface MonthEventsParams {
  /** Limit to one property; omit for all properties. */
  propertyId?: string;
  /** Full year, e.g. 2026. */
  year: number;
  /** 1-based month, 1 = January … 12 = December. */
  month: number;
  /** How many consecutive months to fetch starting at {month} (default 1). */
  monthCount?: number;
}

const LIST_COLUMNS =
  "id, title, start_at, status, type, discipline, max_capacity, property_id, properties ( name, slug, timezone )";

type MonthEventRow = {
  id: string;
  title: string;
  start_at: string;
  status: EventStatus;
  type: string | null;
  discipline: string | null;
  max_capacity: number;
  property_id: string;
  properties:
    | { name: string; slug: string; timezone: string }
    | { name: string; slug: string; timezone: string }[]
    | null;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Dated, non-template, non-cancelled events whose start_at falls within
 * {monthCount} consecutive months starting at the given month. Queries
 * `events` directly (not getEventsList, which has no date bound and always
 * fetches every event) — one contiguous query so no event is double-counted.
 *
 * The fetch window is padded one day on each side: bounds are UTC, but
 * events bucket by property timezone (CT is UTC-5/-6), so an event late on
 * the last CT day of the span could land on the next UTC day. The padding
 * guarantees it's fetched; computeEventDayDensity buckets it precisely.
 */
export async function getAdminMonthEvents(
  supabase: SupabaseClient,
  { propertyId, year, month, monthCount = 1 }: MonthEventsParams,
): Promise<AdminEventCalendarRow[]> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  // day 0 of the month after the span = last day of the span. Date.UTC
  // normalizes a month index past 11 into the next year, so this is rollover-safe.
  const monthEnd = new Date(Date.UTC(year, month - 1 + monthCount, 0));
  const fromDate = new Date(monthStart);
  fromDate.setUTCDate(fromDate.getUTCDate() - 1);
  const toDate = new Date(monthEnd);
  // +1 day to land on the day after monthEnd, +1 more so the exclusive `lt`
  // bound includes the entirety of that padded day.
  toDate.setUTCDate(toDate.getUTCDate() + 2);

  let query = supabase
    .from("events")
    .select(LIST_COLUMNS)
    .eq("is_template", false)
    .not("start_at", "is", null)
    .neq("status", "cancelled")
    .gte("start_at", fromDate.toISOString())
    .lt("start_at", toDate.toISOString())
    .order("start_at", { ascending: true });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load events for the calendar: ${error.message}`);

  const rows = (data ?? []) as unknown as MonthEventRow[];
  const confirmedByEvent = await confirmedCountsByEvent(
    supabase,
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const property = pickOne(row.properties);
    return {
      id: row.id,
      title: row.title,
      startAt: row.start_at,
      status: row.status,
      type: row.type,
      discipline: row.discipline,
      maxCapacity: row.max_capacity,
      confirmedCount: confirmedByEvent.get(row.id) ?? 0,
      propertyId: row.property_id,
      propertyName: property?.name ?? "—",
      propertySlug: property?.slug ?? "unknown",
      propertyTimezone: property?.timezone ?? "America/Chicago",
    };
  });
}

/**
 * Pure: bucket events into per-day density cells keyed by YYYY-MM-DD (in
 * each event's property timezone). `properties` seeds every cell's
 * byProperty map with a 0 baseline for known properties so the UI can render
 * a per-property count consistently.
 */
export function computeEventDayDensity(
  rows: ReadonlyArray<AdminEventCalendarRow>,
  properties: ReadonlyArray<Pick<AdminProperty, "id">>,
): Map<string, EventDayCell> {
  const knownPropertyIds = properties.map((property) => property.id);
  const cellsByDate = new Map<string, EventDayCell>();

  for (const row of rows) {
    const dateKey = eventCalendarDate(row);

    let cell = cellsByDate.get(dateKey);
    if (!cell) {
      const byProperty: Record<string, number> = {};
      for (const propertyId of knownPropertyIds) byProperty[propertyId] = 0;
      cell = { total: 0, byProperty, density: "empty" };
      cellsByDate.set(dateKey, cell);
    }

    cell.total += 1;
    cell.byProperty[row.propertyId] = (cell.byProperty[row.propertyId] ?? 0) + 1;
  }

  for (const cell of cellsByDate.values()) {
    cell.density = densityForCount(cell.total);
  }
  return cellsByDate;
}

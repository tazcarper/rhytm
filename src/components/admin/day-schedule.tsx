import Link from "next/link";
import { cn } from "@/lib/ui";
import type { AdminBookingType, AdminBidListRow } from "@/src/services/admin/bids";
import type { AdminBookingListRow } from "@/src/services/admin/bookings";
import { PropertyPill } from "./property-pill";
import s from "./day-schedule.module.css";

/**
 * The hourly grid's view model — one block on the timeline. Decoupled from any
 * source row so the dashboard (bid rows) and the bookings calendar (booking
 * rows) can both feed it via the adapters below. `href` is resolved by the
 * adapter, so DaySchedule owns no routing knowledge.
 */
export interface ScheduleBlock {
  id: string;
  startTime: string;
  durationHours: number;
  guestName: string;
  guestCount: number;
  bookingType: AdminBookingType;
  href: string;
  /** A provisional slot not yet locked in (booking status pending_review).
      Rendered distinctly so it reads apart from confirmed events — and so the
      schedule reconciles with the calendar count, which excludes pending. */
  pending: boolean;
}

/** Dashboard bid rows → blocks: the row id *is* the bid id. Dashboard already
    scopes to confirmed bids, so nothing here is pending. */
export function bidRowToScheduleBlock(row: AdminBidListRow): ScheduleBlock {
  return {
    id: row.id,
    startTime: row.startTime,
    durationHours: row.durationHours,
    guestName: row.guestName,
    guestCount: row.guestCount,
    bookingType: row.bookingType,
    href: `/admin/bids/${row.id}`,
    pending: false,
  };
}

/** Booking rows → blocks: link to the bid detail when one exists, else the
    no-bid booking detail (the future admin-created-booking case). */
export function bookingRowToScheduleBlock(row: AdminBookingListRow): ScheduleBlock {
  return {
    id: row.id,
    startTime: row.startTime,
    durationHours: row.durationHours,
    guestName: row.guestName,
    guestCount: row.guestCount,
    bookingType: row.bookingType,
    href: row.bidId ? `/admin/bids/${row.bidId}` : `/admin/bookings/${row.id}`,
    pending: row.status === "pending_review",
  };
}

interface DayScheduleProps {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  rows: ReadonlyArray<ScheduleBlock>;
  /** YYYY-MM-DD in the property's timezone — used to draw the "now" line
      only if the date matches today. */
  dateInTz: string;
  /** Today's date in the same timezone, also YYYY-MM-DD. */
  todayInTz: string;
}

const DEFAULT_DAY_START = 7;
const DEFAULT_DAY_END = 20;
const HOUR_HEIGHT = 72;
// A block needs roughly this many pixels to show all three lines (time +
// guest + activity meta) without clipping; below it we drop the meta line.
const META_MIN_HEIGHT = 64;

const SLUG_TO_BLOCK: Record<string, string> = {
  "horseshoe-bay": "block_hsb",
  "hog-heaven": "block_hog",
  packsaddle: "block_pack",
};

function hourInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h + m / 60;
}

function formatHourLabel(hour: number): string {
  const h12 = ((hour - 1) % 12) + 1;
  const ampm = hour < 12 || hour === 24 ? "AM" : "PM";
  return `${h12} ${ampm}`;
}

function formatRangeLabel(startHour: number, durationHours: number): string {
  const endHour = startHour + durationHours;
  return `${formatHourLabel(Math.floor(startHour))}${
    startHour % 1 ? ":" + String(Math.round((startHour % 1) * 60)).padStart(2, "0") : ""
  } – ${formatHourLabel(Math.floor(endHour))}${
    endHour % 1 ? ":" + String(Math.round((endHour % 1) * 60)).padStart(2, "0") : ""
  } CT`;
}

const BOOKING_TYPE_SHORT: Record<AdminBookingType, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Lesson",
  host_an_occasion: "Occasion",
};

/** A block plus the time-band layout the timeline needs to place it. */
interface PlacedBlock {
  row: ScheduleBlock;
  start: number;
  end: number;
  /** 0-based column within its overlap cluster. */
  column: number;
  /** Total columns in its overlap cluster (so all share one width). */
  columns: number;
}

/**
 * Side-by-side layout for overlapping blocks. Greedy interval-graph coloring:
 * blocks are swept by start time into clusters of mutual overlap; within a
 * cluster each block takes the first free column, and every block in the
 * cluster is told the cluster's column count so they render at equal width.
 * Non-overlapping blocks stay full width (columns === 1).
 */
function layoutBlocks(
  rows: ReadonlyArray<ScheduleBlock>,
  tz: string,
): PlacedBlock[] {
  const placed: PlacedBlock[] = rows
    .map((row) => {
      const start = hourInTz(row.startTime, tz);
      return { row, start, end: start + row.durationHours, column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: PlacedBlock[] = [];
  let clusterEnd = -Infinity;
  // Per-column running end time; reset at each cluster boundary.
  const columnEnds: number[] = [];

  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length;
    cluster = [];
    columnEnds.length = 0;
  };

  for (const block of placed) {
    if (block.start >= clusterEnd) closeCluster();

    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(block.end);
    } else {
      columnEnds[column] = block.end;
    }
    block.column = column;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  closeCluster();

  return placed;
}

export function DaySchedule({
  propertyName,
  propertySlug,
  rows,
  dateInTz,
  todayInTz,
}: DayScheduleProps) {
  const tz = "America/Chicago"; // all properties today

  // Auto-fit the time band around the bookings, with a 7 AM–8 PM default.
  let earliest = DEFAULT_DAY_START;
  let latest = DEFAULT_DAY_END;
  for (const row of rows) {
    const start = hourInTz(row.startTime, tz);
    const end = start + row.durationHours;
    if (start < earliest) earliest = Math.floor(start);
    if (end > latest) latest = Math.ceil(end);
  }
  const hourCount = latest - earliest;
  const gridHeight = hourCount * HOUR_HEIGHT;
  const hours: number[] = [];
  for (let h = earliest; h <= latest; h++) hours.push(h);

  // Now line — only draw if this schedule is today.
  let nowOffset: number | null = null;
  if (dateInTz === todayInTz) {
    const nowHour = hourInTz(new Date().toISOString(), tz);
    if (nowHour >= earliest && nowHour <= latest) {
      nowOffset = (nowHour - earliest) * HOUR_HEIGHT;
    }
  }

  const blockVariant = SLUG_TO_BLOCK[propertySlug] ?? "block_neutral";
  const placed = layoutBlocks(rows, tz);
  const pendingCount = rows.reduce((count, row) => count + (row.pending ? 1 : 0), 0);
  const confirmedCount = rows.length - pendingCount;

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <PropertyPill name={propertyName} slug={propertySlug} withDot />
        <span className={s.headCount}>
          {pendingCount > 0
            ? `${confirmedCount} confirmed · ${pendingCount} pending`
            : `${rows.length} ${rows.length === 1 ? "booking" : "bookings"}`}
        </span>
      </div>
      <div
        className={s.grid}
        style={{ ["--grid-height" as string]: `${gridHeight}px` }}
      >
        {hours.map((h) => (
          <span
            key={`label-${h}`}
            className={s.hourLabel}
            style={{ ["--top" as string]: `${(h - earliest) * HOUR_HEIGHT}px` }}
          >
            {formatHourLabel(h)}
          </span>
        ))}
        {hours.map((h) => (
          <span
            key={`line-${h}`}
            className={s.hourLine}
            style={{ ["--top" as string]: `${(h - earliest) * HOUR_HEIGHT}px` }}
          />
        ))}
        {nowOffset !== null && (
          <span
            className={s.nowLine}
            style={{ ["--top" as string]: `${nowOffset}px` }}
            aria-label="Current time"
          />
        )}
        {rows.length === 0 && <p className={s.empty}>Nothing scheduled.</p>}
        {placed.map(({ row, start, column, columns }) => {
          const top = (start - earliest) * HOUR_HEIGHT;
          const height = Math.max(
            row.durationHours * HOUR_HEIGHT - 4,
            HOUR_HEIGHT - 4,
          );
          const isShort = height < META_MIN_HEIGHT;
          return (
            <Link
              key={row.id}
              href={row.href}
              className={cn(
                s.block,
                s[blockVariant] ?? s.block_neutral,
                isShort && s.short,
                row.pending && s.pending,
              )}
              style={{
                ["--top" as string]: `${top}px`,
                ["--block-height" as string]: `${height}px`,
                ["--col" as string]: column,
                ["--cols" as string]: columns,
              }}
            >
              <span className={s.blockTime}>
                {formatRangeLabel(start, row.durationHours)}
                {row.pending && <span className={s.pendingTag}>Pending</span>}
              </span>
              <span className={s.blockGuest}>{row.guestName}</span>
              <span className={s.blockMeta}>
                {BOOKING_TYPE_SHORT[row.bookingType]} ·{" "}
                {row.guestCount}{" "}
                {row.guestCount === 1 ? "guest" : "guests"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

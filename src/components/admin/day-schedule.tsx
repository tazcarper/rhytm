import Link from "next/link";
import { cn } from "@/lib/ui";
import type { AdminBidListRow } from "@/src/services/admin/bids";
import { PropertyPill } from "./property-pill";
import s from "./day-schedule.module.css";

interface DayScheduleProps {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  rows: ReadonlyArray<AdminBidListRow>;
  /** YYYY-MM-DD in the property's timezone — used to draw the "now" line
      only if the date matches today. */
  dateInTz: string;
  /** Today's date in the same timezone, also YYYY-MM-DD. */
  todayInTz: string;
}

const DEFAULT_DAY_START = 7;
const DEFAULT_DAY_END = 20;
const HOUR_HEIGHT = 56;

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

const BOOKING_TYPE_SHORT: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Lesson",
  host_an_occasion: "Occasion",
};

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

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <PropertyPill name={propertyName} slug={propertySlug} withDot />
        <span className={s.headCount}>
          {rows.length} {rows.length === 1 ? "booking" : "bookings"}
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
        {rows.map((row) => {
          const start = hourInTz(row.startTime, tz);
          const top = (start - earliest) * HOUR_HEIGHT;
          const height = Math.max(
            row.durationHours * HOUR_HEIGHT - 4,
            HOUR_HEIGHT - 4,
          );
          const isShort = row.durationHours < 2;
          return (
            <Link
              key={row.id}
              href={`/admin/bids/${row.id}`}
              className={cn(
                s.block,
                s[blockVariant] ?? s.block_neutral,
                isShort && s.short,
              )}
              style={{
                ["--top" as string]: `${top}px`,
                ["--block-height" as string]: `${height}px`,
              }}
            >
              <span className={s.blockTime}>
                {formatRangeLabel(start, row.durationHours)}
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

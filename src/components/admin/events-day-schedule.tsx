import Link from "next/link";
import { PropertyPill } from "@/src/components/admin/property-pill";
import { EventStatusBadge } from "@/src/components/admin/event-status-badge";
import { humanizeEnum } from "@/src/components/admin/humanize";
import type { AdminEventCalendarRow } from "@/src/services/admin/events-calendar";
import { formatSlotLabelTz } from "@/src/services/public/format";
import dashboard from "@/src/components/admin/dashboard.module.css";

interface EventsDayScheduleProps {
  propertyName: string;
  propertySlug: string;
  rows: ReadonlyArray<AdminEventCalendarRow>;
}

// Day-detail list for the events calendar — a simple sorted list rather than
// DaySchedule's hourly grid: events don't reliably have a filled-in end_at,
// and there are typically a handful per property per day, so a time-block
// gantt would be more visual complexity than the data supports. Same
// per-property "column" shape as DaySchedule, reusing dashboard.module.css's
// existing column classes (the same ones PropertyColumnView uses on the
// dashboard home for the week-ahead list).
export function EventsDaySchedule({
  propertyName,
  propertySlug,
  rows,
}: EventsDayScheduleProps) {
  return (
    <div className={dashboard.column}>
      <div className={dashboard.columnHead}>
        <PropertyPill name={propertyName} slug={propertySlug} withDot />
        <span className={dashboard.columnCount}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className={dashboard.columnEmpty}>No events this day.</p>
      ) : (
        <ul className={dashboard.columnList}>
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/events/${row.id}`} className={dashboard.columnRow}>
                <div className={dashboard.columnWhen}>
                  {formatSlotLabelTz(row.startAt, row.propertyTimezone)}
                </div>
                <div className={dashboard.columnGuest}>{row.title}</div>
                <div className={dashboard.columnMeta}>
                  <EventStatusBadge status={row.status} />
                  <span>
                    {row.confirmedCount} / {row.maxCapacity} booked
                  </span>
                  {row.type && <span>{humanizeEnum(row.type)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

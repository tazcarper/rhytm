import Link from "next/link";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { AdminBookingListRow } from "@/src/services/admin/bookings";
import { BookingStatusBadge } from "./booking-status-badge";
import { PropertyPill } from "./property-pill";
import s from "./queue-list.module.css";

const BOOKING_TYPE_LABEL: Record<AdminBookingListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function BookingListTable({
  rows,
}: {
  rows: ReadonlyArray<AdminBookingListRow>;
}) {
  if (rows.length === 0) {
    return (
      <div className={s.tableWrap}>
        <p className={s.empty}>No bookings match these filters.</p>
      </div>
    );
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Status</th>
            <th>Booking</th>
            <th>Property</th>
            <th>Guest</th>
            <th>Created</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tz = row.propertyTimezone;
            const dateLabel = formatDateLongTz(row.startTime, tz);
            const timeLabel = formatSlotLabelTz(row.startTime, tz);
            const href = row.bidId
              ? `/admin/bids/${row.bidId}`
              : `/admin/bookings/${row.id}`;

            return (
              <tr key={row.id}>
                <td>
                  <div className={s.when}>
                    <span className={s.whenDate}>{dateLabel}</span>
                    <span className={s.whenTime}>{timeLabel} CT</span>
                  </div>
                </td>
                <td>
                  <BookingStatusBadge status={row.status} />
                </td>
                <td>
                  <div className={s.bookingType}>
                    <span className={s.bookingTypeLabel}>
                      {BOOKING_TYPE_LABEL[row.bookingType]}
                    </span>
                    <span className={s.bookingTypeMeta}>
                      {row.guestCount}{" "}
                      {row.guestCount === 1 ? "guest" : "guests"} ·{" "}
                      {row.durationHours}h
                    </span>
                  </div>
                </td>
                <td>
                  <PropertyPill name={row.propertyName} slug={row.propertySlug} />
                </td>
                <td>
                  <div className={s.guest}>
                    <span className={s.guestName}>{row.guestName}</span>
                    <span className={s.guestEmail}>{row.guestEmail}</span>
                  </div>
                </td>
                <td className={s.createdAt}>{formatRelative(row.createdAt)}</td>
                <td>
                  <Link href={href} className={s.viewLink}>
                    {row.bidId ? "View bid →" : "View →"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

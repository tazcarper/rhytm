"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { MemberBooking } from "@/src/services/admin/members";
import { BookingStatusBadge, bookingStatusLabel } from "./booking-status-badge";
import type { AdminBookingStatus } from "@/src/services/admin/bookings";
import { PropertyPill } from "./property-pill";
import s from "./queue-list.module.css";

const BOOKING_TYPE_LABEL: Record<string, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

function bookingWhen(iso: string, timezone: string): string {
  return `${formatDateLongTz(iso, timezone)} · ${formatSlotLabelTz(
    iso,
    timezone,
  )} CT`;
}

// All of a member's bookings across every property, filterable in the
// browser (the per-member set is small, so no server round-trips).
export function MemberBookings({
  bookings,
}: {
  bookings: ReadonlyArray<MemberBooking>;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [status, setStatus] = useState("");
  const [bookingType, setBookingType] = useState("");

  // Filter options come from the bookings actually present, so dropdowns
  // never offer an empty result.
  const propertyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const booking of bookings) byId.set(booking.propertyId, booking.propertyName);
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [bookings]);

  const statusOptions = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.status))),
    [bookings],
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.bookingType))),
    [bookings],
  );

  const filtered = bookings.filter(
    (booking) =>
      (!propertyId || booking.propertyId === propertyId) &&
      (!status || booking.status === status) &&
      (!bookingType || booking.bookingType === bookingType),
  );

  const hasFilter = propertyId !== "" || status !== "" || bookingType !== "";

  if (bookings.length === 0) {
    return <p className={s.empty}>No bookings yet.</p>;
  }

  return (
    <>
      <div className={s.inlineFilters}>
        {propertyOptions.length > 1 && (
          <label className={s.field}>
            <span className={s.fieldLabel}>Property</span>
            <select
              className={s.select}
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">All properties</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={s.field}>
          <span className={s.fieldLabel}>Status</span>
          <select
            className={s.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {bookingStatusLabel(value as AdminBookingStatus)}
              </option>
            ))}
          </select>
        </label>

        {typeOptions.length > 1 && (
          <label className={s.field}>
            <span className={s.fieldLabel}>Type</span>
            <select
              className={s.select}
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              <option value="">All types</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {BOOKING_TYPE_LABEL[value] ?? value}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className={s.empty}>No bookings match these filters.</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Type</th>
                <th>Property</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => {
                const href = booking.bidId
                  ? `/admin/bids/${booking.bidId}`
                  : `/admin/bookings/${booking.id}`;
                return (
                  <tr key={booking.id}>
                    <td>{bookingWhen(booking.startTime, booking.propertyTimezone)}</td>
                    <td>
                      <BookingStatusBadge
                        status={booking.status as AdminBookingStatus}
                      />
                    </td>
                    <td>
                      {BOOKING_TYPE_LABEL[booking.bookingType] ??
                        booking.bookingType}
                    </td>
                    <td>
                      <PropertyPill
                        name={booking.propertyName}
                        slug={booking.propertySlug}
                      />
                    </td>
                    <td>
                      <Link href={href} className={s.viewLink}>
                        {booking.bidId ? "View bid →" : "View →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasFilter && (
        <p className={s.filterSummary}>
          Showing {filtered.length} of {bookings.length} bookings
        </p>
      )}
    </>
  );
}

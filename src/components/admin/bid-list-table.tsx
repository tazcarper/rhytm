"use client";

import type { MouseEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { AdminBidListRow } from "@/src/services/admin/bids";
import { BidStatusBadge } from "./bid-status-badge";
import { BidProgress } from "./bid-progress";
import { BidRestoreButton } from "./bid-delete-controls";
import { PropertyPill } from "./property-pill";
import s from "./queue-list.module.css";

const BOOKING_TYPE_LABEL: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

function formatRelative(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function BidListTable({ rows }: { rows: ReadonlyArray<AdminBidListRow> }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className={s.tableWrap}>
        <p className={s.empty}>No bids match these filters.</p>
      </div>
    );
  }

  // Row click navigates to the bid detail. We skip the navigation if
  // the click landed on an inner link/button (e.g. the property pill
  // or the View link) — those handle their own destinations and we
  // don't want to double-fire. Keyboard accessibility via Enter/Space
  // mirrors anchor behavior.
  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, href: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;
    router.push(href);
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    href: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target as HTMLElement;
      if (target.closest("a, button, input, select, textarea")) return;
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Booking</th>
            <th>When</th>
            <th>Property</th>
            <th>Status</th>
            <th>Created</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tz = row.propertyTimezone;
            const dateLabel = formatDateLongTz(row.startTime, tz);
            const timeLabel = formatSlotLabelTz(row.startTime, tz);

            const href = `/admin/bids/${row.id}`;
            return (
              <tr
                key={row.id}
                className={s.clickableRow}
                role="link"
                tabIndex={0}
                aria-label={`Open bid for ${row.guestName}`}
                onClick={(e) => handleRowClick(e, href)}
                onKeyDown={(e) => handleRowKeyDown(e, href)}
              >
                <td>
                  <div className={s.guest}>
                    <span className={s.guestName}>{row.guestName}</span>
                    <span className={s.guestEmail}>{row.guestEmail}</span>
                  </div>
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
                  <div className={s.when}>
                    <span className={s.whenDate}>{dateLabel}</span>
                    <span className={s.whenTime}>{timeLabel} CT</span>
                  </div>
                </td>
                <td>
                  <PropertyPill name={row.propertyName} slug={row.propertySlug} />
                </td>
                <td>
                  <div className={s.statusCell}>
                    <BidStatusBadge status={row.status} display="stage" />
                    <BidProgress
                      status={row.status}
                      signedAt={row.signedAt}
                      amountPaid={row.amountPaid}
                      depositAmount={row.depositAmount}
                      effectiveQuote={row.effectiveQuote}
                    />
                  </div>
                </td>
                <td className={s.createdAt}>{formatRelative(row.createdAt)}</td>
                <td>
                  {row.deletedAt ? (
                    <BidRestoreButton bidId={row.id} bookingId={row.bookingId} />
                  ) : (
                    <Link href={`/admin/bids/${row.id}`} className={s.viewLink}>
                      View →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

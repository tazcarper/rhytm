"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/ui";
import {
  ADMIN_BID_STATUSES,
  type AdminBidListRow,
  type AdminBidStatus,
} from "@/src/services/admin/bids";
import type { DashboardActivityRow } from "@/src/services/admin/dashboard-data";
import { bidStatusLabel } from "./bid-status-badge";
import { PropertyPill } from "./property-pill";
import s from "./dashboard.module.css";

// How many rows the feed shows at once. The page fetches a wider window so a
// status filter still surfaces recent matches that aren't in the newest few.
const DISPLAY_MAX = 12;

const BOOKING_TYPE_SHORT: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Lesson",
  host_an_occasion: "Occasion",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function statusClass(status: AdminBidStatus): string {
  return s[`status_${status}`] ?? "";
}

function ActivityRow({ row }: { row: DashboardActivityRow }) {
  return (
    <li>
      <Link
        href={`/admin/bids/${row.id}`}
        className={cn(s.activityRow, statusClass(row.status))}
        aria-label={`${bidStatusLabel(row.status)} bid for ${row.guestName}`}
      >
        <div className={s.activityMain}>
          <span className={s.activityGuest}>{row.guestName}</span>
          <span className={s.activityType}>
            {BOOKING_TYPE_SHORT[row.bookingType]}
          </span>
        </div>
        <span className={s.activityProperty}>
          <PropertyPill name={row.propertyName} slug={row.propertySlug} />
        </span>
        <span className={s.activityTime}>{formatRelative(row.updatedAt)}</span>
      </Link>
    </li>
  );
}

// Recent activity with clickable status filters. The colored chips double as
// the legend (each color matches the row's left stripe) and as a multi-select
// filter: click any to narrow, click again to clear it; none selected = all.
export function ActivityFeed({ rows }: { rows: DashboardActivityRow[] }) {
  const [active, setActive] = useState<ReadonlySet<AdminBidStatus>>(new Set());

  function toggle(status: AdminBidStatus) {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // Only offer chips for statuses that actually appear in the window, so the
  // control doesn't list filters that can never match anything right now.
  const presentStatuses = ADMIN_BID_STATUSES.filter((status) =>
    rows.some((row) => row.status === status),
  );

  const filtered =
    active.size === 0 ? rows : rows.filter((row) => active.has(row.status));
  const shown = filtered.slice(0, DISPLAY_MAX);

  // When exactly one status is selected, link straight to that filtered queue.
  const singleStatus = active.size === 1 ? [...active][0] : null;

  return (
    <>
      <div className={s.cardHead}>
        <div className={s.cardHeadText}>
          <h2 className={s.cardTitle}>Recent activity</h2>
          <p className={s.cardDesc}>
            The latest status change on every bid, newest first. Use the chips
            to focus on one stage.
          </p>
        </div>
      </div>

      <div className={s.activityFilters} role="group" aria-label="Filter by status">
        <button
          type="button"
          className={cn(s.filterChip, active.size === 0 && s.filterChipActive)}
          aria-pressed={active.size === 0}
          onClick={() => setActive(new Set())}
        >
          All
        </button>
        {presentStatuses.map((status) => (
          <button
            key={status}
            type="button"
            className={cn(
              s.filterChip,
              s.legendItem,
              statusClass(status),
              active.has(status) && s.filterChipActive,
            )}
            aria-pressed={active.has(status)}
            onClick={() => toggle(status)}
          >
            <span className={s.legendStripe} aria-hidden="true" />
            {bidStatusLabel(status)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={s.miniEmpty}>No activity matches this filter.</p>
      ) : (
        <ul className={s.activityList}>
          {shown.map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      {singleStatus && (
        <div className="mt-3">
          <Link
            href={`/admin/bids?status=${singleStatus}`}
            className={s.cardLink}
          >
            See all {bidStatusLabel(singleStatus).toLowerCase()} in queue →
          </Link>
        </div>
      )}
    </>
  );
}

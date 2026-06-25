"use client";

import Link from "next/link";
import { cn } from "@/lib/ui";
import {
  BID_STATUS_GROUPS,
  type AdminBidListFilters,
  type AdminBidStatus,
} from "@/src/services/admin/bids";
import { buildBidsHref } from "./bid-filter-params";
import s from "./queue-list.module.css";

// Workflow-group filters. Primary buckets answer "which pile / does it need
// me?". When "Active" is selected, a secondary row refines down to a single
// status, so the grouping never hides detail you might want.

interface BidFiltersGroupsProps {
  current: AdminBidListFilters;
  basePath: string;
}

const ACTIVE_REFINE: ReadonlyArray<{
  status: AdminBidStatus | undefined;
  label: string;
}> = [
  { status: undefined, label: "All active" },
  { status: "confirmed", label: "Awaiting guest" },
  { status: "signed", label: "Signed" },
  { status: "paid", label: "Paid" },
];

export function BidFiltersGroups({ current, basePath }: BidFiltersGroupsProps) {
  const noGroupSelected = !current.statusGroup && !current.onlyDeleted;

  // Every group change resets the exact-status sub-refine and pagination,
  // so each bucket opens clean. Leaving the Deleted view also clears it.
  function groupHref(statusGroup: AdminBidListFilters["statusGroup"]): string {
    return buildBidsHref(basePath, current, {
      statusGroup,
      status: undefined,
      onlyDeleted: undefined,
      page: undefined,
    });
  }

  // The Deleted view is orthogonal to the workflow groups: it clears the
  // group/status refine and lists only soft-deleted bids (each restorable).
  const deletedHref = buildBidsHref(basePath, current, {
    statusGroup: undefined,
    status: undefined,
    onlyDeleted: true,
    page: undefined,
  });

  return (
    <div className={s.layoutStack}>
      <div className={s.statusPills}>
        <Link
          href={groupHref(undefined)}
          className={cn(s.pill, noGroupSelected && s.pillActive)}
        >
          All
        </Link>
        {BID_STATUS_GROUPS.map((group) => (
          <Link
            key={group.key}
            href={groupHref(group.key)}
            className={cn(
              s.pill,
              !current.onlyDeleted &&
                current.statusGroup === group.key &&
                s.pillActive,
            )}
          >
            {group.label}
          </Link>
        ))}
        <Link
          href={deletedHref}
          className={cn(s.pill, current.onlyDeleted && s.pillActive)}
        >
          Deleted
        </Link>
      </div>

      {current.statusGroup === "active" && (
        <div className={s.refineRow}>
          <span className={s.refineLabel}>Refine</span>
          {ACTIVE_REFINE.map((item) => (
            <Link
              key={item.label}
              href={buildBidsHref(basePath, current, {
                statusGroup: "active",
                status: item.status,
                page: undefined,
              })}
              className={cn(
                s.refinePill,
                current.status === item.status && s.refinePillActive,
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

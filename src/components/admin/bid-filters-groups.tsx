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
  const noGroupSelected = !current.statusGroup;

  // Every group change resets the exact-status sub-refine and pagination,
  // so each bucket opens clean.
  function groupHref(statusGroup: AdminBidListFilters["statusGroup"]): string {
    return buildBidsHref(basePath, current, {
      statusGroup,
      status: undefined,
      page: undefined,
    });
  }

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
              current.statusGroup === group.key && s.pillActive,
            )}
          >
            {group.label}
          </Link>
        ))}
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

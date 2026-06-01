"use client";

import type { ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui";
import {
  BID_STATUS_GROUPS,
  type AdminBidListFilters,
} from "@/src/services/admin/bids";
import { buildBidsHref, type BidFilterUi } from "./bid-filter-params";
import s from "./queue-list.module.css";

// Layout 2 — stage + independent signals. One row of stage buckets, plus
// two dropdowns for the orthogonal completion axes (signature, payment).
// This mirrors the data model: a bid can be signed-but-unpaid or
// paid-but-unsigned, so the two facts get their own controls instead of
// being flattened onto one status line. Changing a stage keeps the signal
// filters set — they compose.

interface BidFiltersSignalsProps {
  current: AdminBidListFilters;
  filterUi: BidFilterUi;
  basePath: string;
}

export function BidFiltersSignals({
  current,
  filterUi,
  basePath,
}: BidFiltersSignalsProps) {
  const router = useRouter();
  const noStageSelected = !current.statusGroup;

  function stageHref(statusGroup: AdminBidListFilters["statusGroup"]): string {
    return buildBidsHref(basePath, current, {
      filterUi,
      statusGroup,
      status: undefined,
      page: undefined,
    });
  }

  function handleSignatureChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    router.push(
      buildBidsHref(basePath, current, {
        filterUi,
        signature: value === "" ? undefined : (value as "signed" | "unsigned"),
        page: undefined,
      }),
    );
  }

  function handlePaymentChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    router.push(
      buildBidsHref(basePath, current, {
        filterUi,
        payment: value === "" ? undefined : (value as "paid" | "unpaid"),
        page: undefined,
      }),
    );
  }

  return (
    <div className={s.layoutStack}>
      <div className={s.statusPills}>
        <Link
          href={stageHref(undefined)}
          className={cn(s.pill, noStageSelected && s.pillActive)}
        >
          All
        </Link>
        {BID_STATUS_GROUPS.map((group) => (
          <Link
            key={group.key}
            href={stageHref(group.key)}
            className={cn(
              s.pill,
              current.statusGroup === group.key && s.pillActive,
            )}
          >
            {group.label}
          </Link>
        ))}
      </div>

      <div className={s.signalRow}>
        <label className={s.field}>
          <span className={s.fieldLabel}>Signature</span>
          <select
            className={s.select}
            value={current.signature ?? ""}
            onChange={handleSignatureChange}
          >
            <option value="">Any</option>
            <option value="signed">Signed</option>
            <option value="unsigned">Not signed</option>
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Payment</span>
          <select
            className={s.select}
            value={current.payment ?? ""}
            onChange={handlePaymentChange}
          >
            <option value="">Any</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Deposit due</option>
          </select>
        </label>
      </div>
    </div>
  );
}

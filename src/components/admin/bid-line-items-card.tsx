"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card } from "@/lib/ui";
import { formatMoneyExact } from "@/src/services/public/format";
import type { BidLineItem } from "@/src/services/bids/bid-line-items";
import {
  latestOverridesByLine,
  summarizeOverrides,
  type BidLineOverride,
} from "@/src/services/admin/overrides";
import { applyLineOverrideAction } from "@/app/admin/bids/[id]/override-actions";
import { WaiveDialog } from "./waive-dialog";
import kv from "./bid-detail.module.css";
import s from "./bid-line-items-card.module.css";

// Itemized quote breakdown (Phase 0) + per-line waive/comp controls (Phase 1).
// Read-only when the bid is past review or the viewer can't waive; otherwise
// each line gets a Waive action, comped lines show their discount and a Reverse
// action, and a discount + net-total summary appears once any comp is in force.
interface BidLineItemsCardProps {
  bidId: string;
  bookingId: string;
  lineItems: BidLineItem[];
  overrides: BidLineOverride[];
  // pending_review AND a waive-eligible role (enforced again server-side).
  canWaive: boolean;
}

export function BidLineItemsCard({
  bidId,
  bookingId,
  lineItems,
  overrides,
  canWaive,
}: BidLineItemsCardProps) {
  const router = useRouter();
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [isReversing, startReverse] = useTransition();

  if (lineItems.length === 0) return null;

  const latest = latestOverridesByLine(overrides);
  const { totalDelta } = summarizeOverrides(overrides);
  const subtotal = lineItems.reduce((sum, line) => sum + line.lineAmount, 0);
  const netTotal = Math.round((subtotal + totalDelta) * 100) / 100;
  const hasDiscount = totalDelta < -0.005;

  const handleApplied = (depositExceedsTotal?: boolean) => {
    setOpenLineId(null);
    setNotice(
      depositExceedsTotal
        ? "Comp applied. The deposit now exceeds the new total — lower it in the Pricing card."
        : null,
    );
    router.refresh();
  };

  // A reversing entry restores a line to its original amount; it is itself an
  // appended override (no edit/delete). Reuses applyLineOverride with
  // newAmount = the line's original.
  const reverse = (lineItemId: string, originalAmount: number) => {
    setReverseError(null);
    startReverse(async () => {
      const result = await applyLineOverrideAction(bidId, {
        bookingId,
        lineItemId,
        newAmount: originalAmount,
        reason: "Reversing the prior comp on this line.",
        customerFacingLabel: null,
      });
      if (!result.ok) {
        setReverseError(result.error ?? "Couldn't reverse the comp.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card padding="loose" elevation="soft" className={kv.section}>
      <h2 className={kv.sectionTitle}>Quote breakdown</h2>

      <ul className={kv.lineItems}>
        {lineItems.map((line) => {
          const override = latest.get(line.id);
          const comped = override !== undefined && override.delta < -0.005;
          const isOpen = openLineId === line.id;

          return (
            <li key={line.id} className={s.row}>
              <div className={s.rowMain}>
                <span className={kv.lineItemLabel}>
                  {line.label}
                  {line.taxStatus === "exempt" && (
                    <span className={kv.lineItemTag}> · tax-exempt</span>
                  )}
                  {comped && override.customerFacingLabel && (
                    <span className={s.compLabel}> · {override.customerFacingLabel}</span>
                  )}
                </span>

                <div className={s.amountAndActions}>
                  <div className={s.amounts}>
                    {comped ? (
                      <>
                        <span className={kv.priceStruck}>
                          ${formatMoneyExact(line.lineAmount)}
                        </span>
                        <span className={s.compedAmount}>
                          ${formatMoneyExact(override.newAmount)}
                        </span>
                      </>
                    ) : (
                      <span className={kv.lineItemAmount}>
                        ${formatMoneyExact(line.lineAmount)}
                      </span>
                    )}
                  </div>

                  {canWaive && (
                    <div className={s.rowActions}>
                      {comped ? (
                        <button
                          type="button"
                          className={s.waiveLink}
                          onClick={() => reverse(line.id, line.lineAmount)}
                          disabled={isReversing}
                        >
                          Reverse
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={s.waiveLink}
                          onClick={() => setOpenLineId(isOpen ? null : line.id)}
                        >
                          {isOpen ? "Close" : "Waive"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isOpen && (
                <WaiveDialog
                  bidId={bidId}
                  bookingId={bookingId}
                  lineItemId={line.id}
                  lineLabel={line.label}
                  originalAmount={line.lineAmount}
                  onClose={() => setOpenLineId(null)}
                  onApplied={(result) => handleApplied(result.depositExceedsTotal)}
                />
              )}
            </li>
          );
        })}

        <li className={`${kv.lineItem} ${kv.lineItemSubtotal}`}>
          <span className={kv.lineItemLabel}>Subtotal</span>
          <span className={kv.lineItemAmount}>${formatMoneyExact(subtotal)}</span>
        </li>

        {hasDiscount && (
          <>
            <li className={`${kv.lineItem} ${s.discountLine}`}>
              <span className={kv.lineItemLabel}>Comps applied</span>
              <span className={s.lineAmount}>−${formatMoneyExact(Math.abs(totalDelta))}</span>
            </li>
            <li className={`${kv.lineItem} ${s.netTotal}`}>
              <span className={kv.lineItemLabel}>Net total</span>
              <span className={kv.lineItemAmount}>${formatMoneyExact(netTotal)}</span>
            </li>
          </>
        )}
      </ul>

      {notice && (
        <Alert variant="warn" title="Check the deposit">
          {notice}
        </Alert>
      )}
      {reverseError && (
        <Alert variant="error" title="Couldn't reverse">
          {reverseError}
        </Alert>
      )}
    </Card>
  );
}

import { cn } from "@/lib/ui";
import type { AdminBidStatus } from "@/src/services/admin/bids";
import s from "./queue-list.module.css";

// Per-row lifecycle progress. Surfaces the two independent completion
// criteria — waiver signed, and payment — as discrete checkpoints, so an
// admin reads "how far along is this?" at a glance instead of decoding it
// from a single status chip.
//
// Signing and paying are independent in the data model (App 6 allows
// pay-then-sign or sign-then-pay), so they're separate checkpoints, never
// a strict sequence. The deposit checkpoint only appears when a deposit is
// actually required.

interface BidProgressInputs {
  status: AdminBidStatus;
  signedAt: string | null;
  amountPaid: number;
  depositAmount: number | null;
  effectiveQuote: number | null;
}

interface Checkpoint {
  label: string;
  done: boolean;
  // Closed-but-unsuccessful bids (denied / expired) will never reach these
  // milestones — render them muted rather than as pending work.
  muted: boolean;
}

// Small epsilon so floating-point cents comparisons don't miss an exact
// full payment (mirrors payment-status-badge.tsx).
const CENTS_EPSILON = 0.005;

export function bidCheckpoints({
  status,
  signedAt,
  amountPaid,
  depositAmount,
  effectiveQuote,
}: BidProgressInputs): Checkpoint[] {
  const isClosed = status === "denied" || status === "expired";
  const depositRequired = depositAmount !== null && depositAmount > 0;
  const paidInFull =
    effectiveQuote !== null && amountPaid + CENTS_EPSILON >= effectiveQuote;
  const depositMet =
    depositRequired && amountPaid + CENTS_EPSILON >= depositAmount;

  const checkpoints: Checkpoint[] = [
    { label: "Signed", done: signedAt !== null, muted: isClosed },
  ];
  if (depositRequired) {
    checkpoints.push({
      label: "Deposit",
      done: depositMet || paidInFull,
      muted: isClosed,
    });
  }
  checkpoints.push({
    label: "Paid in full",
    done: paidInFull,
    muted: isClosed,
  });
  return checkpoints;
}

export function BidProgress(inputs: BidProgressInputs) {
  // A refund reverses the financial milestones — stale check marks would
  // mislead, so show a dedicated note instead.
  if (inputs.status === "refunded") {
    return <span className={s.progressNote}>Deposit refunded</span>;
  }

  const checkpoints = bidCheckpoints(inputs);
  return (
    <ul className={s.progress} aria-label="Completion progress">
      {checkpoints.map((checkpoint) => (
        <li
          key={checkpoint.label}
          className={cn(
            s.checkpoint,
            checkpoint.done && s.checkpointDone,
            checkpoint.muted && s.checkpointMuted,
          )}
        >
          <span className={s.checkpointMark} aria-hidden="true">
            {checkpoint.done ? "☑" : "☐"}
          </span>
          {checkpoint.label}
        </li>
      ))}
    </ul>
  );
}

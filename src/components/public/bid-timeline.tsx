import type { CSSProperties } from "react";
import type { BidStatus } from "@/src/services/bids/get-bid";
import s from "./bid-timeline.module.css";

// Three-dot horizontal progress bar on the public bid page. Visual style
// mirrors the booking funnel's StepProgress (see step-progress.tsx) so
// the public surface reads as one product. Presentational only — no
// click-to-jump; the bid status comes from the DB.
//
// After App 6 the bid status is no longer a strict linear sequence —
// signing and paying are independent events. The timeline reads two
// signals: whether the signature step is done, and whether the payment
// step is done. Either step can be "current" while the other is
// pending; both being complete is the "All set" terminal.
//
// Step sets:
//   pending_review → Submitted ✓, Under review (current), Confirmed
//   active path    → Sign waiver, Pay deposit, All set
//                    (sign / pay current/complete state driven by status
//                     + signedAt — see buildSteps below)
//
// denied / expired / refunded are off-path; the bid page does not render
// this component for those statuses.

type DotState = "complete" | "current" | "pending";

interface BidTimelineStep {
  label: string;
  state: DotState;
}

interface BidTimelineProps {
  status: BidStatus;
  signedAt: string | null;
  // When false (no deposit required), the "Pay your deposit" step is
  // dropped and signing the waiver alone reaches "All set".
  requiresDeposit: boolean;
  // Quote-only estimate bids (plan §8a): no waiver, no deposit. The active
  // path collapses to "Confirmed → All set" with no sign/pay steps.
  requiresWaiver: boolean;
}

function buildSteps(
  status: BidStatus,
  signedAt: string | null,
  requiresDeposit: boolean,
  requiresWaiver: boolean,
): BidTimelineStep[] {
  if (status === "pending_review") {
    return [
      { label: "Submitted", state: "complete" },
      { label: "Under review", state: "current" },
      { label: "Confirmed", state: "pending" },
    ];
  }

  // No waiver (and no deposit): reaching the active path IS fully set — there
  // is nothing to sign or pay (plan §8a).
  if (!requiresWaiver) {
    return [
      { label: "Confirmed", state: "complete" },
      { label: "All set", state: "complete" },
    ];
  }

  // Active path — sign + pay are independent signals after App 6.
  //   signed = bid.status==='signed' OR bids.signed_at IS NOT NULL
  //     (the second arm covers "paid first, signed later" — App 7 stamps
  //      signed_at without changing status away from 'paid')
  //   paid   = bid.status==='paid'
  const signedDone = status === "signed" || signedAt !== null;
  const paidDone = status === "paid";

  // No deposit: a two-step path where the signature is the only action and
  // "All set" follows from it alone (the bid never reaches 'paid').
  if (!requiresDeposit) {
    return [
      {
        label: "Sign your waiver",
        state: signedDone ? "complete" : "current",
      },
      {
        label: "All set",
        state: signedDone ? "complete" : "pending",
      },
    ];
  }

  // Deposit required: "All set" is reached only when BOTH are done.
  const finalized = signedDone && paidDone;
  return [
    {
      label: "Sign your waiver",
      state: signedDone ? "complete" : "current",
    },
    {
      label: "Pay your deposit",
      state: paidDone ? "complete" : "current",
    },
    {
      label: "All set",
      state: finalized ? "complete" : "pending",
    },
  ];
}

export function BidTimeline({
  status,
  signedAt,
  requiresDeposit,
  requiresWaiver,
}: BidTimelineProps) {
  const steps = buildSteps(status, signedAt, requiresDeposit, requiresWaiver);
  // Track-fill fraction: 0 → 1 across (steps.length - 1) segments. The
  // current step counts as half-filled so the line reaches its dot but
  // not past it.
  const lastCompleteIdx = steps.reduce(
    (acc, step, i) => (step.state === "complete" ? i : acc),
    -1,
  );
  const currentIdx = steps.findIndex((s) => s.state === "current");
  const reachedIdx =
    currentIdx >= 0 ? currentIdx : lastCompleteIdx >= 0 ? lastCompleteIdx : 0;
  const total = steps.length;
  const progress = total <= 1 ? 0 : reachedIdx / (total - 1);

  return (
    <nav className={s.bar} aria-label="Bid progress">
      <ol
        className={s.list}
        style={{ "--progress": progress } as CSSProperties}
      >
        {steps.map((step, i) => (
          <li key={step.label} className={s.item}>
            <span
              className={s.dot}
              data-state={step.state}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {step.state === "complete" ? "✓" : i + 1}
            </span>
            <span className={s.label} data-state={step.state}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

import type { CSSProperties } from "react";
import type { BidStatus } from "@/src/services/bids/get-bid";
import s from "./bid-timeline.module.css";

// Three-dot horizontal progress bar on the public bid page. Visual style
// mirrors the booking funnel's StepProgress (see step-progress.tsx) so
// the public surface reads as one product. Presentational only — no
// click-to-jump; the bid status comes from the DB.
//
// Two step sets keyed off the bid status:
//   pending_review → Submitted ✓, Under review (current), Confirmed
//   confirmed      → Sign waiver (current), Pay deposit, All set
//   signed         → Sign waiver ✓, Pay deposit (current), All set
//   paid           → Sign waiver ✓, Pay deposit ✓, All set ✓
//
// denied / expired are off-path; the bid page does not render this
// component for those statuses.

type DotState = "complete" | "current" | "pending";

interface BidTimelineStep {
  label: string;
  state: DotState;
}

interface BidTimelineProps {
  status: BidStatus;
}

function buildSteps(status: BidStatus): BidTimelineStep[] {
  if (status === "pending_review") {
    return [
      { label: "Submitted", state: "complete" },
      { label: "Under review", state: "current" },
      { label: "Confirmed", state: "pending" },
    ];
  }

  // Active path — confirmed / signed / paid share a step set; only the
  // current/complete split changes.
  const signedDone = status === "signed" || status === "paid";
  const paidDone = status === "paid";

  return [
    {
      label: "Sign your waiver",
      state: signedDone ? "complete" : "current",
    },
    {
      label: "Pay your deposit",
      state: paidDone ? "complete" : signedDone ? "current" : "pending",
    },
    {
      label: "All set",
      state: paidDone ? "complete" : "pending",
    },
  ];
}

export function BidTimeline({ status }: BidTimelineProps) {
  const steps = buildSteps(status);
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

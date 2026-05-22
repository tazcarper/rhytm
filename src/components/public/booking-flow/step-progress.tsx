"use client";

import type { CSSProperties } from "react";
import s from "./step-progress.module.css";

export interface StepProgressItem {
  /** Short label shown under the dot, e.g. "Disciplines". */
  label: string;
  /** Whether this step has been satisfied (selection / valid input). Used to
   *  decide whether forward-jumps are allowed and to render the checkmark. */
  isComplete: boolean;
}

interface StepProgressProps {
  steps: ReadonlyArray<StepProgressItem>;
  /** 1-indexed currently visible step. */
  current: number;
  /** Called with the 1-indexed target step when a dot is clicked. Parent
   *  decides whether to honor the jump. */
  onJump: (target: number) => void;
  /** Optional predicate to disable specific dots (e.g. forward jumps when
   *  prior steps are incomplete). Defaults to all enabled. */
  canJumpTo?: (target: number) => boolean;
}

// Three-dot themed stepper. The filled progress line lives in a single
// pseudo-element on the list, sized by a --progress CSS variable so the
// transition is one smooth fill instead of three independent segments.
export function StepProgress({
  steps,
  current,
  onJump,
  canJumpTo,
}: StepProgressProps) {
  const total = steps.length;
  const progress = total <= 1 ? 0 : (current - 1) / (total - 1);

  return (
    <nav className={s.bar} aria-label="Booking builder progress">
      <ol
        className={s.list}
        style={{ "--progress": progress } as CSSProperties}
      >
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === current;
          // Visual state tracks position only — past = complete, future =
          // pending. `step.isComplete` gates the ✓ glyph and forward jumps,
          // but a future step shouldn't render filled just because its
          // validation predicate happens to be `true` by default.
          const enabled = canJumpTo ? canJumpTo(stepNum) : true;
          const state: "current" | "complete" | "pending" = isCurrent
            ? "current"
            : stepNum < current
              ? "complete"
              : "pending";

          return (
            <li key={step.label} className={s.item}>
              <button
                type="button"
                className={s.dotBtn}
                onClick={() => onJump(stepNum)}
                disabled={!enabled || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                data-state={state}
              >
                <span className={s.dot} aria-hidden="true">
                  {stepNum < current && step.isComplete ? "✓" : stepNum}
                </span>
                <span className={s.label}>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

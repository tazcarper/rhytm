"use client";

import { useEffect, useState } from "react";
import { Eye, Hammer, Rocket, Sparkles } from "lucide-react";
import {
  BUILD_STEPS,
  isWorkingStep,
  type BuildStep,
} from "@/src/services/ai/build-steps";
import s from "./build-orbit.module.css";

// Where a Claude build is, one step at a time (Taz, 2026-11-09): the step's
// icon in a green bubble, with moons circling it while Claude or the test
// site is working. When the step moves on, the bubble flips over (on its y axis) to show
// the next icon. Each icon has its own little animation: the hammer hits,
// sparkles pop, the eye blinks, the rocket fires. Used on feature request
// cards and in the AI helper's chat.
// children: one plain sentence about what's happening (see buildStepText).

const LABEL: Record<BuildStep, string> = {
  requested: "Not started yet",
  building: "Building",
  preview: "Setting up preview",
  ready: "Ready to try",
  live: "Live",
};

// How long the flip takes (matches the CSS).
const FLIP_MS = 1100;

function StepIcon({ step }: { step: BuildStep }) {
  switch (step) {
    case "requested":
      return (
        <span className={s.icon}>
          <Hammer aria-hidden size={24} strokeWidth={2.2} />
        </span>
      );
    case "building":
      return (
        <span className={`${s.icon} ${s.hammer}`}>
          <Hammer aria-hidden size={24} strokeWidth={2.2} />
          <span className={`${s.spark} ${s.spark1}`} />
          <span className={`${s.spark} ${s.spark2}`} />
        </span>
      );
    case "preview":
      return (
        <span className={`${s.icon} ${s.sparkles}`}>
          <Sparkles aria-hidden size={24} strokeWidth={2.2} />
          <span className={`${s.star} ${s.star1}`} />
          <span className={`${s.star} ${s.star2}`} />
          <span className={`${s.star} ${s.star3}`} />
        </span>
      );
    case "ready":
      return (
        <span className={`${s.icon} ${s.eye}`}>
          <Eye aria-hidden size={24} strokeWidth={2.2} />
        </span>
      );
    case "live":
      return (
        <span className={`${s.icon} ${s.rocket}`}>
          <span className={s.flame} />
          <Rocket aria-hidden size={24} strokeWidth={2.2} />
        </span>
      );
  }
}

function Face({ step, back = false }: { step: BuildStep; back?: boolean }) {
  return (
    <span
      className={`${s.face} ${back ? s.back : ""} ${step === "requested" ? s.idleFace : ""}`}
    >
      <StepIcon step={step} />
    </span>
  );
}

export function BuildOrbit({
  step,
  className = "",
  children,
}: {
  step: BuildStep;
  className?: string;
  children?: React.ReactNode;
}) {
  // The bubble shows `shown`. When the step changes it flips over to the
  // new step on its back face, then settles with the new step in front.
  const [shown, setShown] = useState(step);
  const [flipTo, setFlipTo] = useState<BuildStep | null>(null);
  useEffect(() => {
    if (step === shown) return;
    setFlipTo(step);
    const timer = setTimeout(() => {
      setShown(step);
      setFlipTo(null);
    }, FLIP_MS);
    return () => clearTimeout(timer);
  }, [step, shown]);

  // Moons follow the step being shown, so they change as the flip lands.
  const current = flipTo ?? shown;
  const motion = isWorkingStep(current)
    ? s.working
    : current === "ready"
      ? s.calm
      : s.noMoons;
  const number = BUILD_STEPS.findIndex((item) => item.key === step) + 1;
  return (
    <div className={`${s.wrap} ${className}`}>
      <div className={`${s.stage} ${motion}`} aria-hidden>
        <span className={`${s.orbit} ${s.orbit1}`} />
        <span className={`${s.orbit} ${s.orbit2}`} />
        <span className={`${s.orbit} ${s.orbit3}`} />
        {/* A new key on settling restarts the card with no rotation. */}
        <span key={shown} className={`${s.card} ${flipTo ? s.flipping : ""}`}>
          <Face step={shown} />
          {flipTo && <Face step={flipTo} back />}
        </span>
      </div>
      <div className="min-w-0" aria-live="polite">
        <p key={`label-${step}`} className={s.label}>
          {LABEL[step]}
        </p>
        {number > 0 && step !== "live" && (
          <p key={`count-${step}`} className={s.count}>
            Step {number} of {BUILD_STEPS.length}
          </p>
        )}
        {children && <div className={s.text}>{children}</div>}
      </div>
    </div>
  );
}

// One plain sentence on what is happening now. Features and fixes go
// through the same steps; only the words differ.
export function buildStepText(
  step: BuildStep,
  {
    isFix,
    setAside = false,
    fixingFeedback = false,
  }: { isFix: boolean; setAside?: boolean; fixingFeedback?: boolean },
): string {
  switch (step) {
    case "requested":
      if (setAside)
        return isFix
          ? "This fix was set aside and never went live. You can ask Claude to try again."
          : "This version was set aside and never went live. You can ask Claude to build it again.";
      return "Nothing is being built yet. Press Build it and Claude starts right away.";
    case "building":
      if (fixingFeedback)
        return "Claude is working on what you sent. The test site updates when it's done.";
      return isFix
        ? "Claude is looking into the problem and fixing it. This usually takes 10 to 30 minutes and updates by itself."
        : "Claude is building it. This usually takes 10 to 30 minutes and updates by itself.";
    case "preview":
      return "Claude has finished. A test copy of the site is being set up with it, which takes a few minutes.";
    case "ready":
      return isFix
        ? "The fix is ready to try on a test copy of the site. It isn't on the real site yet."
        : "It's ready to try on a test copy of the site. It isn't on the real site yet.";
    case "live":
      return isFix
        ? "Done. The fix is on the real site."
        : "Done. It's on the real site, and drafts waiting on it can be published.";
  }
}

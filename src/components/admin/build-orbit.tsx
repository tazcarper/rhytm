"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Hammer, Rocket, Sparkles } from "lucide-react";
import {
  BUILD_STEPS,
  isWorkingStep,
  type BuildStep,
} from "@/src/services/ai/build-steps";
import s from "./build-orbit.module.css";

// Where a Claude build is, one step at a time (Taz, 2026-11-09): the step's
// icon as a planet with moons circling it while Claude or the test site is
// working. When the step moves on, the old planet shrinks away and the next
// one pops in. Used on feature request cards and in the AI helper's chat.
// children: one plain sentence about what's happening (see buildStepText).

const LABEL: Record<BuildStep, string> = {
  requested: "Not started yet",
  building: "Building",
  preview: "Setting up preview",
  ready: "Ready to try",
  live: "Live",
};

const ICON: Record<BuildStep, React.ReactNode> = {
  requested: <Hammer aria-hidden size={24} strokeWidth={2.2} />,
  building: <Hammer aria-hidden size={24} strokeWidth={2.2} />,
  preview: <Sparkles aria-hidden size={24} strokeWidth={2.2} />,
  ready: <Eye aria-hidden size={24} strokeWidth={2.2} />,
  live: <Rocket aria-hidden size={24} strokeWidth={2.2} />,
};

// How long the old planet takes to shrink away (matches the CSS).
const LEAVE_MS = 400;

function Planet({
  step,
  leaving = false,
}: {
  step: BuildStep;
  leaving?: boolean;
}) {
  const motion = isWorkingStep(step)
    ? s.working
    : step === "ready"
      ? s.calm
      : step === "requested"
        ? s.idle
        : "";
  const hasMoons = step !== "requested" && step !== "live";
  return (
    <div
      className={`${s.planet} ${motion} ${leaving ? s.leaving : s.entering}`}
      aria-hidden
    >
      {hasMoons && (
        <>
          <span className={`${s.orbit} ${s.orbit1}`} />
          <span className={`${s.orbit} ${s.orbit2}`} />
          <span className={`${s.orbit} ${s.orbit3}`} />
        </>
      )}
      <span className={s.core}>{ICON[step]}</span>
    </div>
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
  // Keep the previous step on screen while it shrinks away.
  const previous = useRef(step);
  const [leaving, setLeaving] = useState<{
    step: BuildStep;
    id: number;
  } | null>(null);
  useEffect(() => {
    if (previous.current === step) return;
    const old = previous.current;
    previous.current = step;
    setLeaving({ step: old, id: Date.now() });
    const timer = setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const number = BUILD_STEPS.findIndex((item) => item.key === step) + 1;
  return (
    <div className={`${s.wrap} ${className}`}>
      <div className={s.stage}>
        {leaving && (
          <Planet key={`leaving-${leaving.id}`} step={leaving.step} leaving />
        )}
        <Planet key={step} step={step} />
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

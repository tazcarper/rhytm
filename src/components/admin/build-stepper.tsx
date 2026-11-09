import { Check, Eye, Hammer, Rocket } from "lucide-react";
import {
  BUILD_STEPS,
  isWorkingStep,
  type BuildStep,
} from "@/src/services/ai/build-steps";
import s from "./build-stepper.module.css";

// Where a Claude build is, as five steps: Ready to start → Building →
// Setting up preview → Ready to try → Live. Used on feature request cards
// and in the AI helper's chat. The current step is animated while Claude
// or Vercel is working on it.

const CURRENT_ICON: Record<BuildStep, React.ReactNode> = {
  requested: <Hammer aria-hidden size={14} strokeWidth={2.4} />,
  building: <Hammer aria-hidden size={14} strokeWidth={2.4} />,
  preview: <Eye aria-hidden size={14} strokeWidth={2.4} />,
  ready: <Eye aria-hidden size={14} strokeWidth={2.4} />,
  live: <Rocket aria-hidden size={14} strokeWidth={2.4} />,
};

export function BuildStepper({
  step,
  className = "",
}: {
  step: BuildStep;
  className?: string;
}) {
  const currentIndex = BUILD_STEPS.findIndex((item) => item.key === step);
  return (
    <div className={className}>
      <ol className={s.steps} aria-label="Build progress">
        {BUILD_STEPS.map((item, index) => {
          // Live is the end: it shows as done, not as in progress.
          const done =
            index < currentIndex || (index === currentIndex && step === "live");
          const current = index === currentIndex && !done;
          const working = current && isWorkingStep(step);
          const state = done
            ? s.done
            : current
              ? `${s.current} ${working ? s.working : ""}`
              : "";
          return (
            <li
              key={item.key}
              className={`${s.step} ${state}`}
              aria-current={current ? "step" : undefined}
            >
              <span className={s.dot}>
                {done ? (
                  <Check aria-hidden size={15} strokeWidth={3} />
                ) : current ? (
                  CURRENT_ICON[item.key]
                ) : null}
              </span>
              <span className={s.label}>
                {item.label}
                {current && (
                  <span className="sr-only">
                    {working ? " (in progress)" : " (current step)"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// One plain sentence under the tracker on what's happening now. Features
// and fixes go through the same steps; only the words differ.
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

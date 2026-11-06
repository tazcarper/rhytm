"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import {
  approveBuildAction,
  buildFeatureRequestAction,
  sendBuildFeedbackAction,
} from "@/app/admin/events/feature-request-actions";
import type { FeatureBuild } from "@/src/services/ai/capability-requests";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";
import { BUILD_ACTIONS, BuildActionIcon } from "./build-actions";

// The Build it control on a feature request card: the button, then where
// Claude's build has got to, written for staff who never open GitHub:
// building → try it on the preview (link + steps) → live.

type BuildStage = "building" | "open" | "merged" | "closed";

// New features and problem fixes go through the same steps; only the
// words differ.
const FEATURE_TEXT: Record<BuildStage, string> = {
  building: "Claude is building it. This usually takes 10 to 30 minutes, and this page keeps itself up to date.",
  open: "It's built and ready for you to try on a test copy of the site. It isn't on the real site yet.",
  merged: "Done. It's on the real site, and drafts waiting on it can be published.",
  closed: "This version was set aside and never went live. You can ask Claude to build it again.",
};
const FIX_TEXT: Record<BuildStage, string> = {
  building: "Claude is looking into the problem and fixing it. This usually takes 10 to 30 minutes, and this page keeps itself up to date.",
  open: "The fix is ready for you to try on a test copy of the site. It isn't on the real site yet.",
  merged: "Done. The fix is on the real site.",
  closed: "This fix was set aside and never went live. You can ask Claude to try again.",
};

// Shown until Claude posts its first checklist (it takes a minute or two
// to start up).
const STARTING: BuildProgress = { state: "working", steps: [], updatedAt: "" };

// How often the page re-checks while Claude is working.
const REFRESH_MS = 20_000;

// Claude's checklist from GitHub, ticked off as it goes.
function ProgressList({ progress, title }: { progress: BuildProgress; title: string }) {
  const firstOpen = progress.steps.findIndex((step) => !step.done);
  return (
    <div className="mt-4 rounded-[4px] border border-rule bg-white px-5 py-4">
      <p className="m-0 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">{title}</p>
      {progress.steps.length === 0 ? (
        <p className="m-0 mt-3 text-body leading-body text-olive">Claude is getting started and will list its steps here.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {progress.steps.map((step, index) => {
            const current = progress.state === "working" && index === firstOpen;
            return (
              <li key={index} className="flex items-start gap-3 text-body leading-body">
                <span
                  aria-hidden
                  className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] leading-none ${
                    step.done ? "border-olive bg-olive text-white" : current ? "border-olive" : "border-rule-strong"
                  }`}
                >
                  {step.done ? "✓" : current ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-olive" /> : null}
                </span>
                <span className={`min-w-0 break-words ${step.done ? "text-gray" : current ? "font-semibold text-olive-darker" : "text-olive"}`}>
                  {step.text}
                  {current && <span className="sr-only"> (working on this now)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {progress.state === "error" && (
        <p className="m-0 mt-3 text-body font-semibold text-accent-error">
          Claude ran into a problem and stopped. Ask your developer to take a look.
        </p>
      )}
    </div>
  );
}

// Re-renders the page every so often while Claude works, so the checklist
// and stage move along without a manual refresh.
function useRefreshWhile(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);
}

function stageOf(build: FeatureBuild): BuildStage {
  return build.pullRequest?.state ?? "building";
}

function StepBox({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-olive text-micro font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-body font-semibold leading-[28px] text-olive-darker">{title}</p>
        <div className="mt-1 max-w-[70ch] text-body leading-body text-olive">{children}</div>
      </div>
    </li>
  );
}

// Step 3: put it live (with a second click to confirm), or send notes back
// to Claude, which fixes the same build and updates the test site.
function ApproveOrFix({ requestId }: { requestId: string }) {
  const [mode, setMode] = useState<"choose" | "confirm" | "feedback" | "approved" | "sent">("choose");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const approve = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveBuildAction({ id: requestId });
      if (result.ok) setMode("approved");
      else setError(result.error);
    });
  };
  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendBuildFeedbackAction({ id: requestId, feedback });
      if (result.ok) setMode("sent");
      else setError(result.error);
    });
  };

  if (mode === "approved") {
    return (
      <p className="m-0 font-semibold text-olive-darker">
        Published. It&apos;ll be on the real site in a few minutes, and this card will change to &ldquo;Done&rdquo;.
      </p>
    );
  }
  if (mode === "sent") {
    return (
      <p className="m-0 text-olive-darker">
        Sent to Claude. It&apos;s fixing it now; the test site updates in about 10 to 30 minutes. Then try it again
        with the Preview it here button above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "choose" && (
        <>
          <span>If it works the way you want, publish it to the real site. If not, tell Claude what to change.</span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={BUILD_ACTIONS.publish.variant}
              size="sm"
              leading={<BuildActionIcon action="publish" />}
              onClick={() => setMode("confirm")}
            >
              {BUILD_ACTIONS.publish.label}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setMode("feedback")}>
              Something&apos;s not right
            </Button>
          </div>
        </>
      )}
      {mode === "confirm" && (
        <>
          <span className="font-semibold text-olive-darker">
            This puts the new feature on the real site, where guests can see it. Go ahead?
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" loading={isPending} onClick={approve}>
              Yes, publish it
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setMode("choose")}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {mode === "feedback" && (
        <>
          <label className="flex flex-col gap-1">
            <span>What&apos;s wrong, or what should change? Write it the way you&apos;d tell a coworker.</span>
            <textarea
              value={feedback}
              onChange={(evt) => setFeedback(evt.target.value)}
              rows={4}
              maxLength={4000}
              className="rounded-[2px] border border-rule-strong bg-white px-3 py-2.5 text-body leading-body text-olive-darker"
              placeholder="e.g. The new price shows on the event page, but the sign-up total still uses the old one."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" loading={isPending} disabled={feedback.trim().length < 3} onClick={send}>
              Send to Claude
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setMode("choose")}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {error && <p className="m-0 font-semibold text-accent-error">{error}</p>}
    </div>
  );
}

// What to do while the build's pull request is open: open the preview,
// follow Claude's steps, then approve it.
function TryItSteps({ requestId, build }: { requestId: string; build: FeatureBuild }) {
  const previewAdmin = build.previewUrl ? `${build.previewUrl}/admin/events` : null;
  return (
    <ol className="m-0 mt-4 flex list-none flex-col gap-6 rounded-[4px] bg-paper-warm px-5 py-5">
      <StepBox number={1} title="Preview it">
        {previewAdmin ? (
          <>
            <Button asChild variant={BUILD_ACTIONS.preview.variant} size="sm">
              <a href={previewAdmin} target="_blank" rel="noreferrer" className="mt-1 !inline-flex items-center gap-2 no-underline">
                <BuildActionIcon action="preview" />
                {BUILD_ACTIONS.preview.label}
              </a>
            </Button>
            <span className="mt-3 block">
              It&apos;s a copy of your site with the new feature added. It has its own test data, so nothing you do
              there changes the real site or reaches guests.
            </span>
          </>
        ) : (
          <>The test site is still being set up. Refresh this page in a minute or two.</>
        )}
      </StepBox>
      <StepBox number={2} title="Try it out">
        {build.testSteps.length > 0 ? (
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 marker:text-gray">
            {build.testSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        ) : (
          <>Do what you originally asked the helper for, and check it works the way you expect.</>
        )}
      </StepBox>
      <StepBox number={3} title="Publish it, or tell Claude what to fix">
        <ApproveOrFix requestId={requestId} />
      </StepBox>
    </ol>
  );
}

export function FeatureBuildControl({
  requestId,
  build,
  canBuild,
  isFix = false,
  progress = null,
}: {
  requestId: string;
  build: FeatureBuild | null;
  canBuild: boolean;
  isFix?: boolean;
  progress?: BuildProgress | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stage: BuildStage | null = started ? "building" : build ? stageOf(build) : null;
  const showButton = stage === null || stage === "closed";
  const stageText = isFix ? FIX_TEXT : FEATURE_TEXT;
  // While building, show whatever Claude has posted. Once it's on the test
  // site, only show it again while Claude is fixing staff feedback.
  const fixingFeedback = stage === "open" && progress?.state === "working";
  const showProgress = progress !== null && (stage === "building" || fixingFeedback);
  useRefreshWhile(stage === "building" || fixingFeedback);

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) setStarted(true);
      else setError(result.error);
    });
  };

  return (
    <div className="mt-6">
      {stage && (
        <p className="m-0 max-w-[70ch] text-body leading-body text-olive">
          {fixingFeedback
            ? "Claude is working on what you sent. The test site updates when it's done."
            : stage === "building" && progress && progress.state !== "working"
              ? "Claude has finished. The preview is being set up; the Preview it here button appears in a few minutes."
              : stageText[stage]}
        </p>
      )}
      {showProgress && progress && (
        <ProgressList progress={progress} title={fixingFeedback ? "What Claude is fixing" : "What Claude is doing"} />
      )}
      {stage === "building" && !progress && (
        <ProgressList progress={STARTING} title="What Claude is doing" />
      )}
      {stage === "open" && build && !fixingFeedback && <TryItSteps requestId={requestId} build={build} />}
      <div className="mt-4 flex flex-wrap items-center gap-3 empty:hidden">
        {showButton &&
          (canBuild ? (
            <Button
              type="button"
              variant={BUILD_ACTIONS.build.variant}
              size="sm"
              loading={isPending}
              leading={<BuildActionIcon action="build" />}
              onClick={start}
            >
              {stage ? "Build it again" : BUILD_ACTIONS.build.label}
            </Button>
          ) : (
            <p className="m-0 text-micro text-gray">Automatic building isn&apos;t switched on yet. Ask your developer.</p>
          ))}
        {error && <p className="m-0 text-body font-semibold text-accent-error">Couldn&apos;t start it: {error}</p>}
      </div>
    </div>
  );
}

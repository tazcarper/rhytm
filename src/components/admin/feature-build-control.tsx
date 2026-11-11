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
import type { BuildRisk } from "@/src/services/ai/build-risk";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";
import {
  buildStepOf,
  isWorkingStep,
  type BuildStep,
} from "@/src/services/ai/build-steps";
import { BUILD_ACTIONS, BuildActionIcon } from "./build-actions";
import { BuildOrbit, buildStepText } from "./build-orbit";

// The Build it control on a feature request card: the step tracker
// (see BuildOrbit), the Build it button, Claude's checklist while it
// works, and how to try and publish the build once it's on the test site.

// Shown until Claude posts its first checklist (it takes a minute or two
// to start up).
const STARTING: BuildProgress = { state: "working", steps: [], updatedAt: "" };

// How often the page re-checks while Claude is working.
const REFRESH_MS = 20_000;

// Claude's checklist from GitHub, ticked off as it goes.
export function ProgressList({
  progress,
  title,
}: {
  progress: BuildProgress;
  title: string;
}) {
  const firstOpen = progress.steps.findIndex((step) => !step.done);
  return (
    <div className="mt-4 rounded-[4px] border border-rule bg-white px-5 py-4">
      <p className="m-0 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">
        {title}
      </p>
      {progress.steps.length === 0 ? (
        <p className="m-0 mt-3 text-body leading-body text-olive">
          Claude is getting started and will list its steps here.
        </p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {progress.steps.map((step, index) => {
            const current = progress.state === "working" && index === firstOpen;
            return (
              <li
                key={index}
                className="flex items-start gap-3 text-body leading-body"
              >
                <span
                  aria-hidden
                  className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] leading-none ${
                    step.done
                      ? "border-olive bg-olive text-white"
                      : current
                        ? "border-olive"
                        : "border-rule-strong"
                  }`}
                >
                  {step.done ? (
                    "✓"
                  ) : current ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-olive" />
                  ) : null}
                </span>
                <span
                  className={`min-w-0 break-words ${step.done ? "text-gray" : current ? "font-semibold text-olive-darker" : "text-olive"}`}
                >
                  {step.text}
                  {current && (
                    <span className="sr-only"> (working on this now)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {progress.state === "error" && (
        <p className="m-0 mt-3 text-body font-semibold text-accent-error">
          Claude ran into a problem and stopped. Ask your developer to take a
          look.
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

function StepBox({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive text-[15px] font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[20px] font-semibold leading-[32px] text-olive-darker">
          {title}
        </p>
        <div className="mt-2 max-w-[70ch] text-[17px] leading-[1.6] text-olive">
          {children}
        </div>
      </div>
    </li>
  );
}

// What makes a build need care, or the owner, before it goes live (see
// build-risk.ts).
function RiskNote({ risk, isOwner }: { risk: BuildRisk; isOwner: boolean }) {
  const ownerOnly = risk.level === "owner";
  return (
    <div className="rounded-[4px] border border-accent-error/40 bg-accent-error/5 px-4 py-3">
      <p className="m-0 font-semibold text-olive-darker">
        {ownerOnly && !isOwner ? "Only the site owner can publish this one" : "Check this one carefully before you publish"}
      </p>
      <p className="m-0 mt-1">
        {ownerOnly
          ? "It changes something that can't easily be undone:"
          : "It touches something guests or payments rely on, so try every part of it on the test site first:"}
      </p>
      <ul className="m-0 mt-1 list-disc pl-5">
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {ownerOnly && !isOwner && (
        <p className="m-0 mt-2">
          You can still try it on the test site and tell Claude what to fix. Let the owner know when it works.
        </p>
      )}
    </div>
  );
}

// Step 3: put it live (with a second click to confirm), or send notes back
// to Claude, which fixes the same build and updates the test site. A
// risky build says why, and an owner-level one only the owner can publish.
function ApproveOrFix({
  requestId,
  risk,
  isOwner,
  isUndo,
}: {
  requestId: string;
  risk: BuildRisk | null;
  isOwner: boolean;
  isUndo: boolean;
}) {
  const canPublish = risk?.level !== "owner" || isOwner;
  const [mode, setMode] = useState<
    "choose" | "confirm" | "feedback" | "approved" | "sent"
  >("choose");
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
        Published. It&apos;ll be on the real site in a few minutes, and this
        card will change to &ldquo;Done&rdquo;.
      </p>
    );
  }
  if (mode === "sent") {
    return (
      <p className="m-0 text-olive-darker">
        Sent to Claude. It&apos;s fixing it now; the test site updates in about
        10 to 30 minutes. Then try it again with the Preview it here button
        above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "choose" && (
        <>
          {risk && risk.level !== "normal" && <RiskNote risk={risk} isOwner={isOwner} />}
          <span>
            {canPublish
              ? "If it works the way you want, publish it to the real site. If not, tell Claude what to change."
              : "If something isn't right, tell Claude what to change."}
          </span>
          <div className="flex flex-wrap gap-2">
            {canPublish && (
              <Button
                type="button"
                variant={BUILD_ACTIONS.publish.variant}
                size="sm"
                leading={<BuildActionIcon action="publish" />}
                onClick={() => setMode("confirm")}
              >
                {BUILD_ACTIONS.publish.label}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setMode("feedback")}
            >
              Something&apos;s not right
            </Button>
          </div>
        </>
      )}
      {mode === "confirm" && (
        <>
          <span className="font-semibold text-olive-darker">
            {isUndo
              ? "This takes the feature off the real site. Go ahead?"
              : "This puts the new feature on the real site, where guests can see it. Go ahead?"}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isPending}
              onClick={approve}
            >
              Yes, publish it
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setMode("choose")}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {mode === "feedback" && (
        <>
          <label className="flex flex-col gap-1">
            <span>
              What&apos;s wrong, or what should change? Write it the way
              you&apos;d tell a coworker.
            </span>
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isPending}
              disabled={feedback.trim().length < 3}
              onClick={send}
            >
              Send to Claude
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setMode("choose")}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {error && <p className="m-0 font-semibold text-accent-error">{error}</p>}
    </div>
  );
}

// Claude writes test steps in Markdown; show **bold** as bold and drop
// the asterisks.
function withBold(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-semibold text-olive-darker">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    );
}

// What to do while the build's pull request is open: open the preview,
// follow Claude's steps, then approve it.
function TryItSteps({
  requestId,
  build,
  risk,
  isOwner,
}: {
  requestId: string;
  build: FeatureBuild;
  risk: BuildRisk | null;
  isOwner: boolean;
}) {
  const previewAdmin = build.previewUrl
    ? `${build.previewUrl}/admin/events`
    : null;
  return (
    <ol className="m-0 mt-4 flex list-none flex-col gap-6 p-0">
      <StepBox number={1} title="Preview it">
        {previewAdmin ? (
          <>
            <Button asChild variant={BUILD_ACTIONS.preview.variant} size="sm">
              <a
                href={previewAdmin}
                target="_blank"
                rel="noreferrer"
                className="mt-1 !inline-flex items-center gap-2 no-underline"
              >
                <BuildActionIcon action="preview" />
                {BUILD_ACTIONS.preview.label}
              </a>
            </Button>
            <span className="mt-3 block">
              It&apos;s a copy of your site with the new feature added. It has
              its own test data, so nothing you do there changes the real site
              or reaches guests.
            </span>
          </>
        ) : (
          <>
            The test site is still being set up. Refresh this page in a minute
            or two.
          </>
        )}
      </StepBox>
      <StepBox number={2} title="Try it out">
        {build.testSteps.length > 0 ? (
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 marker:text-gray">
            {build.testSteps.map((step, index) => (
              <li key={index}>{withBold(step)}</li>
            ))}
          </ol>
        ) : (
          <>
            Do what you originally asked the helper for, and check it works the
            way you expect.
          </>
        )}
      </StepBox>
      <StepBox number={3} title="Publish it, or tell Claude what to fix">
        <ApproveOrFix requestId={requestId} risk={risk} isOwner={isOwner} isUndo={build.kind === "undo"} />
      </StepBox>
    </ol>
  );
}

export function FeatureBuildControl({
  requestId,
  status,
  build,
  canBuild,
  isFix = false,
  progress = null,
  risk = null,
  isOwner = false,
  reopened = false,
  addingMore = false,
}: {
  requestId: string;
  status: string;
  build: FeatureBuild | null;
  canBuild: boolean;
  isFix?: boolean;
  progress?: BuildProgress | null;
  // How risky the build waiting to be published is (null when none is).
  risk?: BuildRisk | null;
  // The signed-in admin may publish high-risk builds.
  isOwner?: boolean;
  // A live feature being added to or undone (see isReopened).
  reopened?: boolean;
  // Staff asked to add more to the live feature.
  addingMore?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Just pressed: show it building until the page catches up.
  const step: BuildStep =
    started && (!build || (reopened && build.kind === "build"))
      ? "building"
      : buildStepOf({ status, build, progress, reopened });
  // What the current step is about: the first build, more for a live
  // feature, or taking it off the site.
  const kind = addingMore && (!build || build.kind === "build" || build.pullRequest?.state === "merged") ? "add_more" : (build?.kind ?? "build");
  const setAside = build?.pullRequest?.state === "closed";
  // Claude is fixing staff's notes on a build that's already on the test site.
  const fixingFeedback =
    step === "building" && build?.pullRequest?.state === "open";
  useRefreshWhile(started || isWorkingStep(step) || fixingFeedback);

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) setStarted(true);
      else setError(result.error);
    });
  };

  return (
    <div className="mt-6 max-w-[900px]">
      {/* Everything about the current step, including what to do next,
          sits beside the animation (Taz, 2026-11-09). */}
      <BuildOrbit
        step={step}
        details={
          <>
            {step === "building" && (
              <ProgressList
                progress={progress?.state === "working" ? progress : STARTING}
                title={
                  fixingFeedback
                    ? "What Claude is fixing"
                    : "What Claude is doing"
                }
              />
            )}
            {step === "ready" && build && (
              <TryItSteps requestId={requestId} build={build} risk={risk} isOwner={isOwner} />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 empty:hidden">
              {step === "requested" &&
                (canBuild ? (
                  <Button
                    type="button"
                    variant={BUILD_ACTIONS.build.variant}
                    size="sm"
                    loading={isPending}
                    leading={<BuildActionIcon action="build" />}
                    onClick={start}
                  >
                    {setAside ? "Build it again" : BUILD_ACTIONS.build.label}
                  </Button>
                ) : (
                  <p className="m-0 text-micro text-gray">
                    Automatic building isn&apos;t switched on yet. Ask your
                    developer.
                  </p>
                ))}
              {error && (
                <p className="m-0 text-body font-semibold text-accent-error">
                  Couldn&apos;t start it: {error}
                </p>
              )}
            </div>
          </>
        }
      >
        <p className="m-0 max-w-[70ch] text-olive">
          {buildStepText(step, { isFix, setAside, fixingFeedback, kind })}
        </p>
      </BuildOrbit>
    </div>
  );
}

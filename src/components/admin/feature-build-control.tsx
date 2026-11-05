"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ui";
import {
  approveBuildAction,
  buildFeatureRequestAction,
  sendBuildFeedbackAction,
} from "@/app/admin/events/feature-request-actions";
import type { FeatureBuild } from "@/src/services/ai/capability-requests";

// The Build it control on a feature request card: the button, then where
// Claude's build has got to, written for staff who never open GitHub:
// building → try it on the preview (link + steps) → live.

type BuildStage = "building" | "open" | "merged" | "closed";

const STAGE_TEXT: Record<BuildStage, string> = {
  building: "Claude is building it. This usually takes 10 to 30 minutes. Refresh this page to check on it.",
  open: "It's built and ready for you to try on a test copy of the site. It isn't on the real site yet.",
  merged: "Done. It's on the real site, and drafts waiting on it can be published.",
  closed: "This version was set aside and never went live. You can ask Claude to build it again.",
};

function stageOf(build: FeatureBuild): BuildStage {
  return build.pullRequest?.state ?? "building";
}

function StepBox({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-olive text-[14px] font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-semibold text-olive-darker">{title}</p>
        <div className="mt-1 text-[14px] text-gray">{children}</div>
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
        Approved. It&apos;ll be on the real site in a few minutes, and this card will change to &ldquo;Done&rdquo;.
      </p>
    );
  }
  if (mode === "sent") {
    return (
      <p className="m-0 text-olive-darker">
        Sent to Claude. It&apos;s fixing it now; the test site updates in about 10 to 30 minutes. Then try it again
        with the same button above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {mode === "choose" && (
        <>
          <span>If it works the way you want, approve it to put it on the real site. If not, tell Claude what to change.</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => setMode("confirm")}>
              Approve and go live
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
              Yes, go live
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
              className="rounded-[8px] border border-rule-strong bg-white p-2 text-[15px] text-olive-darker"
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
    <ol className="m-0 mt-3 flex list-none flex-col gap-4 rounded-[12px] bg-paper-warm p-4">
      <StepBox number={1} title="Open the test site">
        {previewAdmin ? (
          <>
            <a
              href={previewAdmin}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-[8px] bg-olive px-4 py-2 text-[15px] font-semibold text-white no-underline"
            >
              Open the test site
            </a>
            <span className="mt-1 block">
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
          <ol className="m-0 list-decimal pl-5">
            {build.testSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        ) : (
          <>Do what you originally asked the helper for, and check it works the way you expect.</>
        )}
      </StepBox>
      <StepBox number={3} title="Approve it, or tell Claude what to fix">
        <ApproveOrFix requestId={requestId} />
      </StepBox>
    </ol>
  );
}

export function FeatureBuildControl({
  requestId,
  build,
  canBuild,
}: {
  requestId: string;
  build: FeatureBuild | null;
  canBuild: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stage: BuildStage | null = started ? "building" : build ? stageOf(build) : null;
  const showButton = stage === null || stage === "closed";

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) setStarted(true);
      else setError(result.error);
    });
  };

  return (
    <div className="mt-3">
      {stage && <p className="m-0 text-[14px] text-olive-darker">{STAGE_TEXT[stage]}</p>}
      {stage === "open" && build && <TryItSteps requestId={requestId} build={build} />}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {showButton &&
          (canBuild ? (
            <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={start}>
              {stage ? "Build it again" : "Build it"}
            </Button>
          ) : (
            <p className="m-0 text-micro text-gray">Automatic building isn&apos;t switched on yet. Ask your developer.</p>
          ))}
        {error && <p className="m-0 text-[14px] font-semibold text-accent-error">Couldn&apos;t start it: {error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ui";
import { buildFeatureRequestAction } from "@/app/admin/events/feature-request-actions";
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

// What to do while the build's pull request is open: open the preview,
// follow Claude's steps, then approve it.
function TryItSteps({ build }: { build: FeatureBuild }) {
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
      <StepBox number={3} title="Put it on the real site">
        When it works the way you want, let your developer know it&apos;s approved. Once it&apos;s live, this card
        changes to &ldquo;Done&rdquo; and drafts waiting on it can be published.
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
      {stage === "open" && build && <TryItSteps build={build} />}
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

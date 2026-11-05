"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ui";
import { buildFeatureRequestAction } from "@/app/admin/events/feature-request-actions";
import type { FeatureBuild } from "@/src/services/ai/capability-requests";

// The Build it control on a feature request card: the button, then where
// Claude's build has got to (building → preview to test → merged).

type BuildStage = "building" | "open" | "merged" | "closed";

const STAGES: Record<BuildStage, { text: string; linkLabel: string; canRebuild: boolean }> = {
  building: { text: "Claude is building it.", linkLabel: "Watch progress", canRebuild: false },
  open: { text: "Ready to test on the preview. Merge it when it's good.", linkLabel: "Open the pull request", canRebuild: false },
  merged: { text: "Built and merged.", linkLabel: "View the pull request", canRebuild: false },
  closed: { text: "The pull request was closed without merging.", linkLabel: "View the pull request", canRebuild: true },
};

function stageOf(build: FeatureBuild): BuildStage {
  return build.pullRequest?.state ?? "building";
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
  const [startedUrl, setStartedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const current: FeatureBuild | null = startedUrl ? { issueUrl: startedUrl, requestedAt: null, pullRequest: null } : build;
  const stage = current ? STAGES[stageOf(current)] : null;
  const showButton = !stage || stage.canRebuild;

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) setStartedUrl(result.issueUrl);
      else setError(result.error);
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {stage && current && (
        <p className="text-[14px] text-olive-darker">
          {stage.text}{" "}
          <a
            href={current.pullRequest?.url ?? current.issueUrl}
            target="_blank"
            rel="noreferrer"
            className="text-olive underline"
          >
            {stage.linkLabel}
          </a>
        </p>
      )}
      {showButton &&
        (canBuild ? (
          <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={start}>
            {stage ? "Build it again" : "Build it"}
          </Button>
        ) : (
          <p className="text-micro text-gray">Build it needs its one-time GitHub setup.</p>
        ))}
      {error && <p className="text-[14px] font-semibold text-accent-error">Couldn&apos;t start it: {error}</p>}
    </div>
  );
}

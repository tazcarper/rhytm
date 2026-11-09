"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/lib/ui";
import { buildFeatureRequestAction } from "@/app/admin/events/feature-request-actions";
import type { FeatureRequestStage, FeatureRequestStatus } from "@/src/services/ai/feature-request-status";
import { BUILD_ACTIONS, BuildActionIcon } from "./build-actions";
import { ProgressList } from "./feature-build-control";
import { InProgressIndicator } from "./in-progress-indicator";

// Under a helper reply that filed a feature request: what's happening with
// it now, so staff aren't left guessing whether something is building.
// Waiting → Build it button; building → Claude's checklist, kept up to
// date; ready → try it on the test site; live → done. Reads
// /api/admin/feature-requests/[id].

const REFRESH_MS = 20_000;

const HEADLINE: Record<FeatureRequestStage, string> = {
  waiting: "Waiting to be built",
  building: "Claude is building it",
  ready: "Ready to try",
  live: "Done",
  declined: "Not going ahead",
  "set-aside": "Set aside",
};

function explain(status: FeatureRequestStatus): string {
  switch (status.stage) {
    case "waiting":
      return status.canBuild
        ? "Nothing is building yet. Press Build it and Claude starts on it right away."
        : "Nothing is building yet. An admin needs to press Build it on the Feature requests page.";
    case "building":
      return status.progress && status.progress.state !== "working"
        ? "Claude has finished. The test site is being set up and will be ready in a few minutes."
        : "This usually takes 10 to 30 minutes. This card keeps itself up to date.";
    case "ready":
      return "It's on a test copy of the site, not the real one yet. Try it, then approve it or send notes from the Feature requests page.";
    case "live":
      return status.isFix ? "The fix is on the real site." : "It's on the real site. You can use it in this event now.";
    case "declined":
      return "This request was declined, so it won't be built.";
    case "set-aside":
      return "This version never went live. You can ask Claude to build it again.";
  }
}

function requestPageHref(status: FeatureRequestStatus): string {
  const done = status.stage === "live" || status.stage === "declined";
  return `/admin/events/feature-requests?tab=${status.isFix ? "fixes" : "features"}&view=${done ? "done" : "active"}#request-${status.id}`;
}

export function HelperBuildCard({ requestId }: { requestId: string }) {
  const [status, setStatus] = useState<FeatureRequestStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/feature-requests/${requestId}`, { cache: "no-store" }).catch(() => null);
    if (!response) return;
    if (!response.ok) {
      setMissing(true);
      return;
    }
    setStatus((await response.json()) as FeatureRequestStatus);
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep checking while Claude works.
  const building = status?.stage === "building";
  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [building, load]);

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) await load();
      else setError(result.error);
    });
  };

  // Someone who can't read the request (e.g. it was filed by another club).
  if (missing) return null;

  return (
    <div className="max-w-[90%] rounded-[12px] border border-rule bg-white px-4 py-4 text-olive-darker">
      <p className="m-0 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">
        {status?.isFix ? "Problem fix" : "Feature request"}
      </p>
      {!status ? (
        <p className="m-0 mt-2 text-[15px] text-gray">Checking where it&apos;s at…</p>
      ) : (
        <>
          <p className="m-0 mt-2 flex items-center gap-2 text-[17px] font-semibold">
            {status.stage === "building" && <InProgressIndicator />}
            {HEADLINE[status.stage]}
          </p>
          <p className="m-0 mt-1 text-[15px] leading-[1.5] text-olive">{status.summary}</p>
          <p className="m-0 mt-2 text-[15px] leading-[1.5] text-gray">{explain(status)}</p>
          {status.stage === "building" && status.progress && status.progress.state === "working" && (
            <ProgressList progress={status.progress} title="What Claude is doing" />
          )}
          {status.stage === "building" && !status.progress && (
            <ProgressList progress={{ state: "working", steps: [], updatedAt: "" }} title="What Claude is doing" />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {(status.stage === "waiting" || status.stage === "set-aside") && status.canBuild && (
              <Button
                type="button"
                variant={BUILD_ACTIONS.build.variant}
                size="sm"
                loading={isPending}
                leading={<BuildActionIcon action="build" />}
                onClick={start}
              >
                {status.stage === "set-aside" ? "Build it again" : BUILD_ACTIONS.build.label}
              </Button>
            )}
            {status.stage === "ready" && status.previewUrl && (
              <a
                href={status.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[15px] font-semibold text-olive underline"
              >
                Try it on the test site
              </a>
            )}
            <Link href={requestPageHref(status)} className="text-[15px] font-semibold text-olive underline">
              Open in Feature requests
            </Link>
          </div>
          {error && <p className="m-0 mt-2 text-[15px] font-semibold text-accent-error">Couldn&apos;t start it: {error}</p>}
        </>
      )}
    </div>
  );
}

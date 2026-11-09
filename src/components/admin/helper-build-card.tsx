"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/lib/ui";
import { buildFeatureRequestAction } from "@/app/admin/events/feature-request-actions";
import { isWorkingStep } from "@/src/services/ai/build-steps";
import type { FeatureRequestStatus } from "@/src/services/ai/feature-request-status";
import { BUILD_ACTIONS, BuildActionIcon } from "./build-actions";
import { BuildStepper, buildStepText } from "./build-stepper";
import { ProgressList } from "./feature-build-control";

// Under a helper reply that filed a feature request: the same five-step
// tracker as the Feature requests page, so staff can see whether anything
// is happening. Ready to start → Build it button; building → Claude's
// checklist, kept up to date; ready → try it on the test site; live → done.
// Reads /api/admin/feature-requests/[id].

const REFRESH_MS = 20_000;

function requestPageHref(status: FeatureRequestStatus): string {
  const done = status.step === "live" || status.declined;
  return `/admin/events/feature-requests?tab=${status.isFix ? "fixes" : "features"}&view=${done ? "done" : "active"}#request-${status.id}`;
}

export function HelperBuildCard({ requestId }: { requestId: string }) {
  const [status, setStatus] = useState<FeatureRequestStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/feature-requests/${requestId}`, {
      cache: "no-store",
    }).catch(() => null);
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

  // Just pressed Build it: show it building while GitHub catches up.
  const step =
    status && starting && status.step === "requested"
      ? "building"
      : status?.step;
  // Keep checking while Claude or the test site is working.
  const working = Boolean(step && isWorkingStep(step));
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [working, load]);

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await buildFeatureRequestAction({ id: requestId });
      if (result.ok) {
        setStarting(true);
        await load();
      } else setError(result.error);
    });
  };

  // Someone who can't read the request (e.g. it was filed by another club).
  if (missing) return null;

  return (
    <div className="w-full max-w-[34rem] rounded-[12px] border border-rule bg-white px-4 py-4 text-olive-darker">
      <p className="m-0 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">
        {status?.isFix ? "Problem fix" : "Feature request"}
      </p>
      {!status || !step ? (
        <p className="m-0 mt-2 text-[15px] text-gray">
          Checking where it&apos;s at…
        </p>
      ) : (
        <>
          <p className="m-0 mt-1 text-[15px] leading-[1.5] text-olive">
            {status.summary}
          </p>
          {status.declined ? (
            <p className="m-0 mt-3 text-[15px] leading-[1.5] text-gray">
              This request was declined, so it won&apos;t be built.
            </p>
          ) : (
            <>
              <BuildStepper step={step} className="mt-4" />
              <p className="m-0 mt-4 text-[15px] leading-[1.5] text-gray">
                {step === "requested" && !status.canBuild && !status.setAside
                  ? "Nothing is being built yet. An admin needs to press Build it on the Feature requests page."
                  : buildStepText(step, {
                      isFix: status.isFix,
                      setAside: status.setAside,
                      fixingFeedback:
                        step === "building" && status.previewUrl !== null,
                    })}
              </p>
              {step === "building" && (
                <ProgressList
                  progress={
                    status.progress?.state === "working"
                      ? status.progress
                      : { state: "working", steps: [], updatedAt: "" }
                  }
                  title="What Claude is doing"
                />
              )}
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {step === "requested" && !status.declined && status.canBuild && (
              <Button
                type="button"
                variant={BUILD_ACTIONS.build.variant}
                size="sm"
                loading={isPending}
                leading={<BuildActionIcon action="build" />}
                onClick={start}
              >
                {status.setAside ? "Build it again" : BUILD_ACTIONS.build.label}
              </Button>
            )}
            {step === "ready" && status.previewUrl && (
              <a
                href={`${status.previewUrl}/admin/events`}
                target="_blank"
                rel="noreferrer"
                className="text-[15px] font-semibold text-olive underline"
              >
                Try it on the test site
              </a>
            )}
            <Link
              href={requestPageHref(status)}
              className="text-[15px] font-semibold text-olive underline"
            >
              {step === "ready"
                ? "Publish or send notes"
                : "Open in Feature requests"}
            </Link>
          </div>
          {error && (
            <p className="m-0 mt-2 text-[15px] font-semibold text-accent-error">
              Couldn&apos;t start it: {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

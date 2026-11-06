"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/lib/ui";
import { markFeatureRequestDuplicateAction, setFeatureRequestStatusAction } from "@/app/admin/events/feature-request-actions";
import type { CapabilityRequestRow, CapabilityRequestStatus } from "@/src/services/ai/capability-requests";
import { EventStatusBadge } from "./event-status-badge";
import { FeatureBuildControl } from "./feature-build-control";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";
import type { EventStatus } from "@/src/services/admin/events";

// The feature requests the AI helper collected, for the developer: what
// was asked (and the staff member's own words), which drafts it holds up,
// and a status the developer moves along. "Built" unlocks those drafts.
// In the pilot, success means these stay rare; a pile-up means the
// business is missing something that should become a default or starter.

const STATUS_OPTIONS: ReadonlyArray<{ value: CapabilityRequestStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "planned", label: "Planned" },
  { value: "built", label: "Built: drafts can use it and publish" },
  { value: "declined", label: "Declined: won't be built" },
];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

function RequestCard({
  row,
  others,
  canBuild,
  progress,
}: {
  row: CapabilityRequestRow;
  others: ReadonlyArray<CapabilityRequestRow>;
  canBuild: boolean;
  progress: BuildProgress | null;
}) {
  const [status, setStatus] = useState<CapabilityRequestStatus>(row.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const change = (next: CapabilityRequestStatus) => {
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await setFeatureRequestStatusAction({ id: row.id, status: next });
      if (!result.ok) {
        setStatus(previous);
        setError(result.error);
      }
    });
  };

  const merge = (originalId: string) => {
    if (!originalId) return;
    setError(null);
    startTransition(async () => {
      const result = await markFeatureRequestDuplicateAction({ id: row.id, originalId });
      if (!result.ok) setError(result.error);
    });
  };

  const timesAsked = 1 + row.alsoAsked.length;

  return (
    <Card padding="default" elevation="soft">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          {row.fix && (
            <p className="mb-2 text-eyebrow font-semibold uppercase tracking-eyebrow text-accent-error">
              Problem report{row.fix.feature ? ` · fixes “${row.fix.feature.summary}”` : ""}
            </p>
          )}
          <h2 className="max-w-[60ch] font-serif text-h3 font-semibold leading-tight text-olive-darker">{row.summary}</h2>
          <p className="mt-2 max-w-[70ch] text-body italic leading-body text-olive">&ldquo;{row.ownerWords}&rdquo;</p>
          {timesAsked > 1 && (
            <div className="mt-5">
              <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">Asked {timesAsked} times</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {row.alsoAsked.map((ask) => (
                  <li key={ask.id} className="max-w-[70ch] text-body leading-body text-olive">
                    &ldquo;{ask.ownerWords}&rdquo; <span className="text-micro text-gray">· {shortDate(ask.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <label className="flex w-full flex-col gap-2 sm:w-64 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">
          Status
          <select
            value={status}
            onChange={(evt) => change(evt.target.value as CapabilityRequestStatus)}
            disabled={isPending}
            className="h-10 w-full rounded-[2px] border border-rule-strong bg-white px-3 text-body font-normal normal-case tracking-normal text-olive-darker"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {row.events.length > 0 && (
        <div className="mt-6">
          <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">Holding up</p>
          <ul className="mt-2 flex flex-col gap-2">
            {row.events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 text-body leading-snug">
                <EventStatusBadge status={event.status as EventStatus} />
                <Link href={`/admin/events/${event.id}`} className="text-olive underline decoration-tan underline-offset-4 hover:text-olive-darker">
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status !== "declined" && (status !== "built" || row.build) && (
        <FeatureBuildControl
          requestId={row.id}
          build={row.build}
          canBuild={canBuild}
          isFix={row.fix !== null}
          progress={progress}
        />
      )}
      {others.length > 0 && (
        <label className="mt-6 flex flex-wrap items-center gap-3 text-body text-olive">
          Same as another request?
          <select
            value=""
            onChange={(evt) => merge(evt.target.value)}
            disabled={isPending}
            className="h-10 max-w-full rounded-[2px] border border-rule-strong bg-white px-3 text-body text-olive-darker"
          >
            <option value="">Choose one to merge into…</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.summary}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="mt-4 text-body font-semibold text-accent-error">Couldn&apos;t change it: {error}</p>}
      <p className="mt-6 border-t border-rule pt-4 text-micro text-gray">
        {row.propertyName ?? "No property"} · {shortDate(row.createdAt)}
      </p>
    </Card>
  );
}

export function CapabilityRequestsList({
  rows,
  canBuild,
  progress = {},
}: {
  rows: ReadonlyArray<CapabilityRequestRow>;
  canBuild: boolean;
  // Claude's checklist for requests being built, keyed by request id.
  progress?: Readonly<Record<string, BuildProgress>>;
}) {
  if (rows.length === 0) {
    return (
      <Card padding="default" elevation="soft">
        <p className="text-body leading-body text-olive">
          No feature requests yet. When the helper can&apos;t express something staff ask for, it shows up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <RequestCard
          key={row.id}
          row={row}
          others={rows.filter((other) => other.id !== row.id && other.status !== "declined" && !other.fix && !row.fix)}
          canBuild={canBuild}
          progress={progress[row.id] ?? null}
        />
      ))}
    </div>
  );
}

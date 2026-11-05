"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/lib/ui";
import { setFeatureRequestStatusAction } from "@/app/admin/events/feature-request-actions";
import type { CapabilityRequestRow, CapabilityRequestStatus } from "@/src/services/ai/capability-requests";
import { EventStatusBadge } from "./event-status-badge";
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

function RequestCard({ row }: { row: CapabilityRequestRow }) {
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

  return (
    <Card padding="default" elevation="soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-olive">{row.summary}</p>
          <p className="mt-1 text-[14px] text-gray">&ldquo;{row.ownerWords}&rdquo;</p>
        </div>
        <label className="flex flex-col gap-1 text-micro uppercase tracking-label text-gray">
          Status
          <select
            value={status}
            onChange={(evt) => change(evt.target.value as CapabilityRequestStatus)}
            disabled={isPending}
            className="h-9 rounded-[6px] border border-rule-strong bg-white px-2 text-[14px] normal-case tracking-normal text-olive-darker"
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
        <div className="mt-3">
          <p className="text-micro uppercase tracking-label text-gray">Holding up</p>
          <ul className="mt-1 flex flex-col gap-1">
            {row.events.map((event) => (
              <li key={event.id} className="flex items-center gap-2 text-[14px]">
                <EventStatusBadge status={event.status as EventStatus} />
                <Link href={`/admin/events/${event.id}`} className="text-olive underline">
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-[14px] font-semibold text-accent-error">Couldn&apos;t change it: {error}</p>}
      <p className="mt-2 text-micro text-gray">
        {row.propertyName ?? "No property"} ·{" "}
        {new Date(row.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/Chicago",
        })}
      </p>
    </Card>
  );
}

export function CapabilityRequestsList({ rows }: { rows: ReadonlyArray<CapabilityRequestRow> }) {
  if (rows.length === 0) {
    return (
      <Card padding="default" elevation="soft">
        <p className="text-[14px] text-gray">
          No feature requests yet. When the helper can&apos;t express something staff ask for, it shows up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <RequestCard key={row.id} row={row} />
      ))}
    </div>
  );
}

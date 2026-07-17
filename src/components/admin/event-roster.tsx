"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import { cancelEventRegistrationAction } from "@/app/admin/events/actions";
import type { EventRosterRow } from "@/src/services/admin/events";

const STATUS_LABEL: Record<EventRosterRow["status"], string> = {
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
};

export function EventRoster({ rows }: { rows: EventRosterRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="font-serif italic text-[15px] text-gray m-0">No registrations yet.</p>;
  }

  const cancel = (registrationId: string, name: string) => {
    if (!window.confirm(`Cancel ${name}'s registration?`)) return;
    startTransition(async () => {
      setError(null);
      const result = await cancelEventRegistrationAction(registrationId);
      if (!result.ok) setError(result.error ?? "Couldn't cancel.");
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-[13px]">
          <thead>
            <tr className="text-left text-gray uppercase tracking-[0.5px] text-[11px]">
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Guests</th>
              <th className="py-2 pr-3">Rate</th>
              <th className="py-2 pr-3">Quoted</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.registrationId} className="border-t border-rule text-olive align-top">
                <td className="py-2 pr-3 font-serif text-[14px]">{row.contactName}</td>
                <td className="py-2 pr-3">{row.contactEmail}</td>
                <td className="py-2 pr-3">{STATUS_LABEL[row.status]}</td>
                <td className="py-2 pr-3 font-mono">{row.guestCount}</td>
                <td className="py-2 pr-3">{row.isMemberRate ? "Member" : "Non-member"}</td>
                <td className="py-2 pr-3 font-mono">
                  {row.priceQuoted != null ? `$${row.priceQuoted.toFixed(0)}` : "—"}
                </td>
                <td className="py-2 pr-3">
                  {row.status !== "cancelled" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={isPending}
                      onClick={() => cancel(row.registrationId, row.contactName)}
                    >
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

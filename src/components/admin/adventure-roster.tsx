"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import { cancelRsvpAdminAction, confirmRequestAction } from "@/app/admin/adventures/actions";
import type { AdventureRosterRow } from "@/src/services/admin/adventures";
import { formatMoney } from "@/src/services/public/format";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending payment",
  requested: "Requested",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
};

export function AdventureRoster({
  adventureId,
  rows,
}: {
  adventureId: string;
  rows: AdventureRosterRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="font-serif italic text-[15px] text-gray m-0">No reservations yet.</p>;
  }

  const confirm = (rsvpId: string) =>
    startTransition(async () => {
      setError(null);
      const result = await confirmRequestAction(rsvpId, adventureId);
      if (!result.ok) setError(result.error ?? "Couldn't confirm.");
      else router.refresh();
    });

  const cancel = (rsvpId: string, refund: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await cancelRsvpAdminAction(rsvpId, adventureId, { refund });
      if (!result.ok) setError(result.error ?? "Couldn't cancel.");
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-[13px]">
          <thead>
            <tr className="text-left text-gray uppercase tracking-[0.5px] text-[11px]">
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Member #</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Party</th>
              <th className="py-2 pr-3">Paid</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rsvpId} className="border-t border-rule text-olive align-top">
                <td className="py-2 pr-3 font-serif text-[14px]">
                  {row.guestName}
                  {row.guestCount > 1 && (
                    <div className="mt-1 font-sans text-[12px] text-gray">
                      {row.guestNames.length > 0 ? (
                        <span>+ {row.guestNames.join(", ")}</span>
                      ) : (
                        <span className="italic">+ {row.guestCount - 1} guest{row.guestCount - 1 === 1 ? "" : "s"} (unnamed)</span>
                      )}
                      {row.guestNames.length > 0 && row.guestNames.length < row.guestCount - 1 && (
                        <span className="italic">
                          {" "}
                          (+{row.guestCount - 1 - row.guestNames.length} unnamed)
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono">{row.memberNumber}</td>
                <td className="py-2 pr-3">{STATUS_LABEL[row.status] ?? row.status}</td>
                <td className="py-2 pr-3 font-mono">{row.guestCount}</td>
                <td className="py-2 pr-3 font-mono">
                  {row.amountPaid != null ? `$${formatMoney(row.amountPaid)}` : "—"}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex gap-2 justify-end flex-wrap">
                    {row.status === "requested" && (
                      <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={() => confirm(row.rsvpId)}>
                        Confirm
                      </Button>
                    )}
                    {row.status !== "cancelled" &&
                      ((row.amountPaid ?? 0) > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={isPending}
                          onClick={() => {
                            if (window.confirm(`Refund $${formatMoney(row.amountPaid ?? 0)} and cancel ${row.guestName}'s reservation?`))
                              cancel(row.rsvpId, true);
                          }}
                        >
                          Refund &amp; cancel
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={isPending}
                          onClick={() => {
                            if (window.confirm(`Cancel ${row.guestName}'s reservation?`)) cancel(row.rsvpId, false);
                          }}
                        >
                          Cancel
                        </Button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

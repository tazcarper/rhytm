"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import type { GuestManifestEntry } from "@/src/services/adventures/guest-manifest";
import { saveGuestManifestAction } from "@/app/(public)/adventures/[id]/reserve/actions";

// Lets a member name the additional guests in their party (everyone beyond
// the lead member). Collapsible to keep the trip card compact; the summary
// line shows how many of the seats are named. Saves via
// saveGuestManifestAction (ownership-checked, service-role write).

export function GuestManifestEditor({
  rsvpId,
  guestCount,
  initialGuests,
}: {
  rsvpId: string;
  guestCount: number;
  initialGuests: GuestManifestEntry[];
}) {
  const additional = Math.max(0, guestCount - 1);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // One input slot per additional seat, pre-filled by position.
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: additional }, (_, i) => initialGuests[i]?.name ?? ""),
  );

  if (additional === 0) return null; // solo party — nothing to name

  const namedCount = names.filter((n) => n.trim()).length;

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveGuestManifestAction({ rsvpId, names });
      if (!result.ok) {
        setError(result.message ?? "Couldn't save your guests.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="pt-3 mt-3 border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 font-sans text-[12px] tracking-[0.5px] uppercase text-tan-deep hover:text-olive"
      >
        <span>Your guests</span>
        <span className="text-gray normal-case tracking-normal font-serif text-[13px]">
          {namedCount} of {additional} named {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 mt-3">
          <p className="font-serif italic text-[13px] text-gray m-0">
            Add the names of the {additional === 1 ? "guest" : "guests"} joining you, so we can
            prepare for everyone in your party.
          </p>
          {names.map((name, i) => (
            <label key={i} className="block">
              <span className="block font-sans text-[11px] tracking-[0.5px] uppercase text-gray mb-1">
                Guest {i + 2}
              </span>
              <input
                className="w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper"
                value={name}
                placeholder="Full name"
                onChange={(e) => {
                  const next = [...names];
                  next[i] = e.target.value;
                  setNames(next);
                  setSaved(false);
                }}
              />
            </label>
          ))}
          {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={save}>
              {isPending ? "Saving…" : "Save guests"}
            </Button>
            {saved && !isPending && (
              <span className="font-serif italic text-[13px] text-olive">Saved.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { createRsvpAction } from "@/app/(public)/adventures/[id]/actions";

// Inline reserve form on the public adventure detail page. Owns the
// guest-count stepper + pending/error feedback. The write is the
// createRsvpAction server action; the capacity trigger + RLS are the
// authoritative gate, so its discriminated error codes surface here. On
// success router.refresh() re-renders the detail page into its "You're
// going" state.
export function RsvpForm({
  adventureId,
  membershipId,
  maxGuests,
}: {
  adventureId: string;
  membershipId: string;
  maxGuests: number;
}) {
  const router = useRouter();
  const [guestCount, setGuestCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const decrement = () => setGuestCount((n) => Math.max(1, n - 1));
  const increment = () => setGuestCount((n) => Math.min(maxGuests, n + 1));

  const reserve = () => {
    setError(null);
    startTransition(async () => {
      const result = await createRsvpAction({ adventureId, membershipId, guestCount });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 items-center">
      {error && (
        <Alert variant="error" title="Couldn't reserve">
          {error}
        </Alert>
      )}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        {maxGuests > 1 && (
          <div className="flex items-center gap-2">
            <span className="font-sans text-[12px] text-gray tracking-[0.5px] uppercase">
              Party
            </span>
            <div className="flex items-center border border-rule rounded-pill">
              <button
                type="button"
                onClick={decrement}
                disabled={guestCount <= 1 || isPending}
                aria-label="Fewer guests"
                className="px-3 py-1 font-mono text-olive disabled:opacity-40"
              >
                −
              </button>
              <span className="px-2 font-mono text-[15px] text-olive min-w-[1.5ch] text-center">
                {guestCount}
              </span>
              <button
                type="button"
                onClick={increment}
                disabled={guestCount >= maxGuests || isPending}
                aria-label="More guests"
                className="px-3 py-1 font-mono text-olive disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        )}
        <Button type="button" variant="primary" size="lg" loading={isPending} onClick={reserve}>
          {isPending ? "Reserving…" : "Reserve your place"}
        </Button>
      </div>
    </div>
  );
}

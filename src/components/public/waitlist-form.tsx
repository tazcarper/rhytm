"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Button } from "@/lib/ui";
import { joinWaitlistAction } from "@/app/(public)/adventures/[id]/reserve/actions";

// Join-the-waitlist form, shown on the reserve page when an adventure is
// sold out. No payment — members are emailed to claim (first come) when a
// spot frees.
export function WaitlistForm({
  adventureId,
  maxGuests,
}: {
  adventureId: string;
  maxGuests: number;
}) {
  const [guestCount, setGuestCount] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const join = () => {
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlistAction({ adventureId, guestCount });
      if (!result.ok) {
        setError(result.message ?? "Couldn't join the waitlist.");
        return;
      }
      setJoined(true);
    });
  };

  if (joined) {
    return (
      <div className="text-center">
        <div className="font-serif text-[26px] text-olive italic mb-2">You&rsquo;re on the waitlist</div>
        <p className="font-serif text-[15px] text-gray mb-5 max-w-sm mx-auto">
          We&rsquo;ll email you the moment a spot opens — it&rsquo;s first come, so reserve quickly.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/member/adventures">View my adventures &rarr;</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="warn" title="Couldn't join the waitlist">
          {error}
        </Alert>
      )}
      <p className="font-serif text-[16px] text-gray m-0">
        This adventure is fully reserved. Join the waitlist and we&rsquo;ll email you if a spot
        opens — first come, first served.
      </p>

      {maxGuests > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-[13px] text-gray tracking-[0.5px] uppercase">Your party</span>
          <div className="flex items-center border border-rule rounded-pill">
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
              disabled={guestCount <= 1 || isPending}
              aria-label="Fewer guests"
              className="px-4 py-1.5 font-mono text-olive disabled:opacity-40"
            >
              −
            </button>
            <span className="px-3 font-mono text-[16px] text-olive min-w-[1.5ch] text-center">{guestCount}</span>
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.min(maxGuests, n + 1))}
              disabled={guestCount >= maxGuests || isPending}
              aria-label="More guests"
              className="px-4 py-1.5 font-mono text-olive disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      )}

      <Button type="button" variant="primary" size="lg" fullWidth loading={isPending} onClick={join}>
        {isPending ? "Joining…" : "Join the waitlist"}
      </Button>
    </div>
  );
}

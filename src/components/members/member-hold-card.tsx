"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/lib/ui";
import { HoldCountdown } from "@/src/components/public/hold-countdown";
import { releaseAdventureHoldAction } from "@/app/(public)/adventures/[id]/reserve/actions";

// "Holding your spot" card on /member/adventures. When the countdown ends
// it releases the hold (freeing the slot for other members) and refreshes
// the page so the card clears — then offers a fresh reserve.
export function MemberHoldCard({
  adventureId,
  title,
  holdExpiresAt,
}: {
  adventureId: string;
  title: string;
  holdExpiresAt: string;
}) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  const onExpire = async () => {
    setExpired(true);
    await releaseAdventureHoldAction({ adventureId });
    router.refresh();
  };

  return (
    <Card padding="default" className="border-tan">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-serif text-[17px] text-olive italic">{title}</div>
          {expired ? (
            <span className="font-sans text-[12px] tracking-[0.5px] uppercase text-gray">
              Hold released &middot; open again
            </span>
          ) : (
            <HoldCountdown
              expiresAt={holdExpiresAt}
              prefix="Spot held"
              onExpire={onExpire}
              className="font-sans text-[12px] tracking-[0.5px] uppercase text-tan-deep"
            />
          )}
        </div>
        <Button asChild variant="primary" size="sm">
          <Link href={`/adventures/${adventureId}/reserve`}>
            {expired ? "Reserve again →" : "Finish reserving →"}
          </Link>
        </Button>
      </div>
    </Card>
  );
}

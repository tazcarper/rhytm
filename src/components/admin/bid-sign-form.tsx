"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { signBidInPersonAction } from "@/app/admin/bids/[id]/sign/actions";

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2.5 font-serif text-[17px] text-olive focus:border-olive focus:outline-none bg-paper";

// On-site signing form for a booking's waiver — staff prefill the guest's
// name, the guest confirms it + consent, and signs on the iPad.
export function BidSignForm({
  bidId,
  guestName,
  consentText,
}: {
  bidId: string;
  guestName: string;
  consentText: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(guestName);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await signBidInPersonAction(bidId, { signedName: name, agreedConsent: agreed });
      if (!result.ok) {
        setError(result.error ?? "Couldn't sign.");
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="font-serif text-[28px] text-olive mb-2">Signed ✓</div>
        <p className="font-serif text-[17px] text-gray m-0">
          {name}&rsquo;s waiver is on file and the booking is marked signed.
        </p>
        <div className="mt-6">
          <Button asChild variant="primary">
            <Link href={`/admin/bids/${bidId}`}>Back to the booking</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="error" title="Couldn't sign">
          {error}
        </Alert>
      )}
      <label className="block">
        <span className={labelCls}>Full legal name</span>
        <input
          className={inputCls}
          value={name}
          placeholder="Jane Doe"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex items-start gap-3 mt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 flex-none"
        />
        <span className="font-serif text-[15px] text-olive leading-[1.5]">{consentText}</span>
      </label>
      <div className="mt-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={isPending || !name || !agreed}
          onClick={submit}
        >
          {isPending ? "Signing…" : "Sign waiver"}
        </Button>
      </div>
    </div>
  );
}

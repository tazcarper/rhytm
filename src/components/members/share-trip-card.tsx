"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Eyebrow, Heading } from "@/lib/ui";
import { mintShareLink, revokeShareLink } from "@/app/member/bookings/[id]/share/actions";

// "Share trip details" surface on /member/bookings/[id]. Only rendered for
// a finalized booking. Mints an opaque /trip/<token> link the booker can
// send to anyone (even non-members) — a trimmed, read-only overview with no
// pricing/payment/contact. Optional personal note. Revoke kills all prior
// links instantly.
export function ShareTripCard({
  bookingId,
  initialToken,
  initialNote,
}: {
  bookingId: string;
  initialToken: string | null;
  initialNote: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [note, setNote] = useState(initialNote ?? "");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Origin is only knowable client-side; set after mount to avoid a
  // hydration mismatch.
  useEffect(() => setOrigin(window.location.origin), []);

  const shareUrl = token ? `${origin}/trip/${token}` : "";

  const mint = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await mintShareLink({ bookingId, note });
      if (!result.ok || !result.token) {
        setError(result.message ?? "Couldn't create the link.");
        return;
      }
      setToken(result.token);
    });
  };

  const revoke = () => {
    if (!window.confirm("Revoke this link? Anyone you've shared it with will lose access.")) return;
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await revokeShareLink({ bookingId });
      if (!result.ok) {
        setError(result.message ?? "Couldn't revoke the link.");
        return;
      }
      setToken(null);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  const inputCls =
    "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";

  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        Share
      </Eyebrow>
      <Heading level={3} size="h3" underline>
        Send this trip to your party
      </Heading>
      <p className="mt-3 mb-4 font-serif text-[15px] text-gray leading-[1.6]">
        Create a link anyone can open — even if they&rsquo;re not a member. They&rsquo;ll see the
        dates, location, what to bring, and good-to-knows. They won&rsquo;t see pricing or payment.
      </p>

      {error && (
        <Alert variant="error" title="Something went wrong" className="mb-3">
          {error}
        </Alert>
      )}

      <label className="block mb-4">
        <span className="block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1">
          Personal note (optional)
        </span>
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          value={note}
          maxLength={500}
          placeholder="Hey — here's our trip. Meet at the lodge at 8."
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {token ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input className={`${inputCls} font-mono text-[13px]`} value={shareUrl} readOnly />
            <Button type="button" variant="secondary" size="md" onClick={copy} disabled={!origin}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={mint}>
              Save note
            </Button>
            <button
              type="button"
              onClick={revoke}
              disabled={isPending}
              className="font-sans text-[11px] tracking-[1px] uppercase text-[color:var(--error)] disabled:opacity-40"
            >
              Revoke link
            </button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="primary" size="md" loading={isPending} onClick={mint}>
          Create share link
        </Button>
      )}
    </Card>
  );
}

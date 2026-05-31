"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/lib/ui";
import { regenerateBidUrlAction } from "@/app/admin/bids/[id]/actions";
import type { AdminBidStatus } from "@/src/services/admin/bids";
import s from "./bid-url-card.module.css";

interface BidUrlCardProps {
  bidId: string;
  status: AdminBidStatus;
  // Current bid URL recovered server-side from access_code_plaintext.
  // Null for legacy bids predating the plaintext storage migration;
  // those guests need a one-time rotation to surface a URL.
  bidUrl: string | null;
}

// Statuses where the bid page is live and a URL can be shared / rotated.
const ACTIVE_STATUSES: ReadonlyArray<AdminBidStatus> = [
  "pending_review",
  "confirmed",
  "signed",
];

export function BidUrlCard({ bidId, status, bidUrl }: BidUrlCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Tracks a URL rotated during this session so the field reflects the
  // new value immediately without waiting for the router refresh to land.
  const [rotatedUrl, setRotatedUrl] = useState<string | null>(null);
  const [justRotated, setJustRotated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayedUrl = rotatedUrl ?? bidUrl;
  const canRotate = ACTIVE_STATUSES.includes(status);

  const runRotate = () => {
    setError(null);
    startTransition(async () => {
      const result = await regenerateBidUrlAction(bidId);
      if (!result.ok || !result.bidPath) {
        setError(result.error ?? "Couldn't rotate URL.");
        return;
      }
      setRotatedUrl(result.bidPath);
      setJustRotated(true);
      setCopied(false);
      setConfirmingRotate(false);
      router.refresh();
    });
  };

  const copyUrl = async () => {
    if (!displayedUrl) return;
    try {
      await navigator.clipboard.writeText(displayedUrl);
      setCopied(true);
      // Visual ack only — clipboard write is its own confirmation.
      // Resets after a moment so a second copy still gives feedback.
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts. The URL is
      // visible on screen anyway; admin can copy manually.
    }
  };

  // Legacy bid with no recoverable URL: offer a one-time rotate to surface one.
  if (!displayedUrl) {
    if (!canRotate) return null;
    return (
      <section className={s.card}>
        <div className={s.head}>
          <p className={s.eyebrow}>Bid URL</p>
        </div>
        <p className={s.help}>
          This bid was created before we started storing recoverable URLs.
          Rotate once to surface a fresh link you can copy.
        </p>
        {error && (
          <Alert variant="error" title="Couldn't rotate">
            {error}
          </Alert>
        )}
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={runRotate}
            loading={isPending}
          >
            {isPending ? "Rotating…" : "Generate URL"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${s.card} ${justRotated ? s.cardFresh : ""}`}>
      <div className={s.head}>
        <p className={`${s.eyebrow} ${justRotated ? s.eyebrowFresh : ""}`}>
          {justRotated ? "New bid URL — old link revoked" : "Bid URL"}
        </p>
        {canRotate && !confirmingRotate && (
          <button
            type="button"
            className={s.rotateLink}
            onClick={() => {
              setConfirmingRotate(true);
              setError(null);
            }}
          >
            Rotate
          </button>
        )}
      </div>

      <div className={s.field}>
        <Input
          readOnly
          value={displayedUrl}
          className={s.urlInput}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Shareable bid URL"
        />
        <Button variant="primary" size="md" onClick={copyUrl}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className={s.help}>
        Send this link to the guest — it opens their bid page directly.
      </p>

      {error && (
        <Alert variant="error" title="Couldn't rotate">
          {error}
        </Alert>
      )}

      {confirmingRotate && (
        <div className={s.rotatePanel}>
          <p className={s.rotateTitle}>Rotate the bid URL?</p>
          <p className={s.help}>
            A new access code is generated and the current URL stops working
            immediately. Use this only when a link has been shared too broadly
            or you suspect it&rsquo;s leaked.
          </p>
          <div className={s.rotateActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={runRotate}
              loading={isPending}
            >
              {isPending ? "Rotating…" : "Rotate URL"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmingRotate(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button } from "@/lib/ui";
import { getBookingWaiverQrAction } from "@/app/admin/bids/[id]/sign/actions";

// "Scan-to-sign QR" on the booking detail. Opens a modal with a QR the party
// scans on their phones to sign the booking's waiver. Fetches the QR lazily
// on first open.
export function WaiverQrButton({
  bidId,
  variant = "secondary",
  size = "sm",
}: {
  bidId: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const show = () => {
    setError(null);
    setOpen(true);
    if (url) return;
    startTransition(async () => {
      const result = await getBookingWaiverQrAction(bidId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
    });
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={show}>
        Scan-to-sign QR
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(40,47,21,0.55)] p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-paper rounded-card border border-rule max-w-sm w-full p-6 text-center"
            style={{ boxShadow: "var(--shadow-lift)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-serif text-[22px] text-olive mb-1">Scan to sign the waiver</div>
            <p className="font-serif italic text-[14px] text-gray mt-0 mb-4">
              Each guest scans with their phone camera. The first signs the booking&rsquo;s waiver;
              everyone else is recorded for the party.
            </p>

            {error ? (
              <Alert variant="error" title="Couldn't load">
                {error}
              </Alert>
            ) : isPending || !url ? (
              <div className="py-12 font-serif italic text-gray">Generating…</div>
            ) : (
              <>
                {/* Rendered client-side as a crisp SVG — no server image. */}
                <QRCodeSVG
                  value={url}
                  size={260}
                  marginSize={2}
                  className="mx-auto block"
                />
                <div className="mt-4 flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    className="flex-1 border border-rule rounded px-2 py-1 font-mono text-[12px] text-olive bg-paper"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </>
            )}

            <div className="mt-5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

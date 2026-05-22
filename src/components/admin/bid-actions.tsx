"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  confirmBidAction,
  denyBidAction,
  regenerateBidUrlAction,
} from "@/app/admin/bids/[id]/actions";
import type { AdminBidStatus } from "@/src/services/admin/bids";
import s from "./bid-actions.module.css";

type DialogMode = "none" | "confirm" | "deny" | "regenerate" | "regenerate-success";

interface BidActionsProps {
  bidId: string;
  status: AdminBidStatus;
}

const ACTIVE_STATUSES: ReadonlyArray<AdminBidStatus> = [
  "pending_review",
  "confirmed",
  "signed",
];

export function BidActions({ bidId, status }: BidActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DialogMode>("none");
  const [denyReason, setDenyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [regeneratedUrl, setRegeneratedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = status === "pending_review";
  const canDeny = status === "pending_review";
  const canRegenerate = ACTIVE_STATUSES.includes(status);

  const runConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmBidAction(bidId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't confirm.");
        return;
      }
      setMode("none");
      router.refresh();
    });
  };

  const runDeny = () => {
    setError(null);
    startTransition(async () => {
      const result = await denyBidAction(bidId, denyReason);
      if (!result.ok) {
        setError(result.error ?? "Couldn't deny.");
        return;
      }
      setMode("none");
      setDenyReason("");
      router.refresh();
    });
  };

  const runRegenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await regenerateBidUrlAction(bidId);
      if (!result.ok || !result.bidPath) {
        setError(result.error ?? "Couldn't regenerate URL.");
        return;
      }
      setRegeneratedUrl(result.bidPath);
      setMode("regenerate-success");
      router.refresh();
    });
  };

  const copyUrl = async () => {
    if (regeneratedUrl) {
      try {
        await navigator.clipboard.writeText(regeneratedUrl);
      } catch {
        // Clipboard API can fail in non-secure contexts. The URL is
        // visible on screen anyway, admin can copy manually.
      }
    }
  };

  if (mode === "none") {
    return (
      <div className={s.row}>
        {canConfirm && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setMode("confirm")}
          >
            Confirm
          </Button>
        )}
        {canDeny && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode("deny")}
          >
            Deny
          </Button>
        )}
        {canRegenerate && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode("regenerate")}
          >
            Regenerate URL
          </Button>
        )}
        {error && (
          <div style={{ flexBasis: "100%" }}>
            <Alert variant="error" title="Action failed">
              {error}
            </Alert>
          </div>
        )}
      </div>
    );
  }

  if (mode === "confirm") {
    return (
      <div className={s.dialog}>
        <p className={s.dialogTitle}>Confirm this bid?</p>
        <p className={s.dialogBody}>
          The guest&rsquo;s bid page will unlock the schedule, gear list,
          signature slot, and deposit. Make sure pricing + bid content is
          accurate first.
        </p>
        {error && (
          <Alert variant="error" title="Couldn't confirm">
            {error}
          </Alert>
        )}
        <div className={s.dialogActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={runConfirm}
            loading={isPending}
          >
            {isPending ? "Confirming…" : "Confirm bid"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("none");
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "deny") {
    return (
      <div className={s.dialog}>
        <p className={s.dialogTitle}>Deny this bid?</p>
        <p className={s.dialogBody}>
          The reason is stored on the bid for staff reference. The guest
          sees only that their bid was denied — not the reason.
        </p>
        <textarea
          className={s.textarea}
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          placeholder="Why is this bid being denied? (required)"
          maxLength={2000}
        />
        {error && (
          <Alert variant="error" title="Couldn't deny">
            {error}
          </Alert>
        )}
        <div className={s.dialogActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={runDeny}
            loading={isPending}
            disabled={!denyReason.trim()}
          >
            {isPending ? "Denying…" : "Deny bid"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("none");
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "regenerate") {
    return (
      <div className={s.dialog}>
        <p className={s.dialogTitle}>Regenerate the bid URL?</p>
        <p className={s.dialogBody}>
          A new access code will be generated. The old URL stops working
          immediately. We&rsquo;ll show the new URL once — copy it before
          leaving the page.
        </p>
        {error && (
          <Alert variant="error" title="Couldn't regenerate">
            {error}
          </Alert>
        )}
        <div className={s.dialogActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={runRegenerate}
            loading={isPending}
          >
            {isPending ? "Regenerating…" : "Generate new URL"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("none");
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "regenerate-success" && regeneratedUrl) {
    return (
      <div className={s.urlPanel}>
        <p className={s.urlPanelTitle}>New bid URL</p>
        <div className={s.urlBox}>{regeneratedUrl}</div>
        <p className={s.urlWarning}>
          This URL is shown once. Copy it now — we can&rsquo;t recover the
          access code after you leave this page.
        </p>
        <div className={s.dialogActions}>
          <Button variant="primary" size="sm" onClick={copyUrl}>
            Copy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("none");
              setRegeneratedUrl(null);
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

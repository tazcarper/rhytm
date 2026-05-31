"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  confirmBidAction,
  denyBidAction,
} from "@/app/admin/bids/[id]/actions";
import type { AdminBidStatus } from "@/src/services/admin/bids";
import s from "./bid-actions.module.css";

type DialogMode = "none" | "confirm" | "deny";

interface BidActionsProps {
  bidId: string;
  status: AdminBidStatus;
}

export function BidActions({ bidId, status }: BidActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DialogMode>("none");
  const [denyReason, setDenyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = status === "pending_review";
  const canDeny = status === "pending_review";

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

  // Nothing to decide once the bid has left review — render no toolbar slot.
  if (!canConfirm && !canDeny && mode === "none") {
    return null;
  }

  if (mode === "none") {
    return (
      <>
        {canDeny && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode("deny")}
          >
            Deny
          </Button>
        )}
        {/* Confirm sits last — the primary action anchors the bottom of the
            Edit / Deny / Confirm stack. */}
        {canConfirm && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setMode("confirm")}
          >
            Confirm
          </Button>
        )}
      </>
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

  return null;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  confirmBidAction,
  denyBidAction,
  lockAndConfirmBidAction,
} from "@/app/admin/bids/[id]/actions";
import type { AdminBidStatus } from "@/src/services/admin/bids";
import type { AdminBookingStatus } from "@/src/services/admin/bookings";
import s from "./bid-actions.module.css";

type DialogMode = "none" | "confirm" | "deny" | "lock";

interface BidActionsProps {
  bidId: string;
  status: AdminBidStatus;
  // Booking context for the estimate lock-then-confirm flow (plan §7).
  bookingId: string;
  bookingStatus: AdminBookingStatus;
  requiresWaiver: boolean;
  durationHours: number;
  // Provisional slot defaults (property-local), prefilled into the lock form.
  provisionalDate: string;
  provisionalSlot: string;
}

export function BidActions({
  bidId,
  status,
  bookingId,
  bookingStatus,
  requiresWaiver,
  durationHours,
  provisionalDate,
  provisionalSlot,
}: BidActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DialogMode>("none");
  const [denyReason, setDenyReason] = useState("");
  const [lockDate, setLockDate] = useState(provisionalDate);
  const [lockTime, setLockTime] = useState(provisionalSlot);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = status === "pending_review";
  const canDeny = status === "pending_review";
  // A quote-only estimate bid sits on a provisional, unenforced slot until
  // staff lock it. Confirming must lock first (plan §7) — so its primary action
  // is "Lock slot & confirm" instead of a bare confirm.
  const needsSlotLock = !requiresWaiver && bookingStatus === "pending_review";

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

  const runLockAndConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await lockAndConfirmBidAction(bidId, bookingId, {
        date: lockDate,
        slotStart: lockTime,
        durationHours,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't lock and confirm.");
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
            Edit / Deny / Confirm stack. Estimate bids lock the slot first. */}
        {canConfirm && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setMode(needsSlotLock ? "lock" : "confirm")}
          >
            {needsSlotLock ? "Lock slot & confirm" : "Confirm"}
          </Button>
        )}
      </>
    );
  }

  if (mode === "lock") {
    return (
      <div className={s.dialog}>
        <p className={s.dialogTitle}>Lock the slot &amp; confirm</p>
        <p className={s.dialogBody}>
          This request came in on a provisional time. Set the real slot — it&rsquo;s
          checked against availability and double-booking — then the bid is
          confirmed for the guest. Plan-a-visit is a 2-hour block.
        </p>
        <div className={s.lockFields}>
          <label className={s.lockField}>
            <span>Date</span>
            <input
              type="date"
              value={lockDate}
              onChange={(e) => setLockDate(e.target.value)}
            />
          </label>
          <label className={s.lockField}>
            <span>Start time</span>
            <input
              type="time"
              value={lockTime}
              onChange={(e) => setLockTime(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <Alert variant="error" title="Couldn't lock the slot">
            {error}
          </Alert>
        )}
        <div className={s.dialogActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={runLockAndConfirm}
            loading={isPending}
            disabled={!lockDate || !lockTime}
          >
            {isPending ? "Locking…" : "Lock & confirm"}
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

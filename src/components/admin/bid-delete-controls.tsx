"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  deleteBidAction,
  restoreBidAction,
} from "@/app/admin/bids/[id]/actions";
import s from "./bid-actions.module.css";

interface BidDeleteControlProps {
  bidId: string;
  bookingId: string;
}

// Delete (with a confirm step) for the bid detail page. Admin-only — the page
// renders it only for super_admin / admin, and the action re-checks. A delete
// hides the bid + booking everywhere and frees the slot; it's reversible from
// the bids "Deleted" view.
export function BidDeleteButton({ bidId, bookingId }: BidDeleteControlProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteBidAction(bidId, bookingId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't delete.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  if (!confirming) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={s.dangerTrigger}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className={s.dialog}>
      <p className={s.dialogTitle}>Delete this bid?</p>
      <p className={s.dialogBody}>
        It disappears from the dashboard and the guest&rsquo;s bid link, and its
        time slot frees up for rebooking. The record is kept — you can restore it
        from the <strong>Deleted</strong> filter in the bid list.
      </p>
      {error && (
        <Alert variant="error" title="Couldn't delete">
          {error}
        </Alert>
      )}
      <div className={s.dialogActions}>
        <Button
          variant="primary"
          size="sm"
          onClick={runDelete}
          loading={isPending}
        >
          {isPending ? "Deleting…" : "Delete bid"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setConfirming(false);
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

// Restore a soft-deleted bid + booking. Used on the detail "Deleted" banner and
// inline in the "Deleted" list view. Can fail if the slot was rebooked while the
// bid was deleted — the action surfaces that as a capacity/travel message.
export function BidRestoreButton({ bidId, bookingId }: BidDeleteControlProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runRestore = () => {
    setError(null);
    startTransition(async () => {
      const result = await restoreBidAction(bidId, bookingId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't restore.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={s.restore}>
      <Button
        variant="secondary"
        size="sm"
        onClick={runRestore}
        loading={isPending}
      >
        {isPending ? "Restoring…" : "Restore"}
      </Button>
      {error && (
        <Alert variant="error" title="Couldn't restore">
          {error}
        </Alert>
      )}
    </div>
  );
}

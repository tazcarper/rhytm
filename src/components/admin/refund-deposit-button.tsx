"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { refundDepositAction } from "@/app/admin/bids/[id]/refund-actions";
import { formatMoney } from "@/src/services/public/format";
import s from "./bid-actions.module.css";
import r from "./refund-deposit-button.module.css";

// Admin refund flow. Renders a "Refund deposit" trigger; click opens
// an inline dialog (matching BidActions' confirm/deny pattern) with an
// editable amount (defaults to the full deposit) and an optional
// reason. The reason is appended to bids.staff_notes by the service.
//
// State machine:
//   idle  → click → form
//   form  → submit → pending → success | error
//   error → user fixes input or cancels → form
//   success → router.refresh() (parent unmounts the button when
//             bid.status flips to 'refunded')

type Mode = "idle" | "form" | "success";

interface RefundDepositButtonProps {
  bidId: string;
  // Max refundable = whatever the customer actually paid (Path A).
  // For pre-Path-A bookings this equals deposit_amount via migration backfill.
  amountPaid: number; // dollars
}

export function RefundDepositButton({
  bidId,
  amountPaid,
}: RefundDepositButtonProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [amountInput, setAmountInput] = useState(() =>
    formatMoney(amountPaid),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    refundId: string;
    amount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const openForm = () => {
    setMode("form");
    setError(null);
    setAmountInput(formatMoney(amountPaid));
    setReason("");
  };

  const close = () => {
    setMode("idle");
    setError(null);
    setReason("");
    setSuccess(null);
  };

  const submit = () => {
    setError(null);

    // Parse the amount input client-side first to catch obvious
    // problems before the round trip. The service re-validates.
    const parsed = Number.parseFloat(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    if (parsed > amountPaid) {
      setError(
        `Refund can't exceed the amount paid ($${formatMoney(amountPaid)}).`,
      );
      return;
    }

    startTransition(async () => {
      const result = await refundDepositAction(
        bidId,
        parsed,
        reason.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess({ refundId: result.refundId, amount: result.refundedAmount });
      setMode("success");
      router.refresh();
    });
  };

  if (mode === "idle") {
    return (
      <Button variant="secondary" size="sm" onClick={openForm}>
        Refund deposit
      </Button>
    );
  }

  if (mode === "form") {
    return (
      <div className={s.dialog}>
        <p className={s.dialogTitle}>Refund this deposit?</p>
        <p className={s.dialogBody}>
          The customer&rsquo;s card will be refunded via Stripe. This bid
          will move to <strong>refunded</strong> and the booking will be{" "}
          <strong>cancelled</strong> &mdash; the slot releases for re-booking.
        </p>

        <div className={r.amountRow}>
          <label className={r.amountLabel} htmlFor={`refund-amount-${bidId}`}>
            Amount ($)
          </label>
          <input
            id={`refund-amount-${bidId}`}
            className={r.amountInput}
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={isPending}
          />
        </div>
        <p className={r.amountHint}>
          Defaults to the full amount paid (${formatMoney(amountPaid)}). Edit
          for a partial refund.
        </p>

        <textarea
          className={s.textarea}
          placeholder="Reason (optional — appended to staff notes)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
        />

        {error && (
          <Alert variant="error" title="Couldn't refund">
            {error}
          </Alert>
        )}

        <div className={s.dialogActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={isPending}
          >
            {isPending
              ? "Refunding…"
              : `Refund $${formatMoney(Number.parseFloat(amountInput) || 0)}`}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={close}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // mode === "success"
  return (
    <div className={`${s.dialog} ${r.successBlock}`}>
      <p className={s.dialogTitle}>Refund issued</p>
      {success && (
        <p className={s.dialogBody}>
          <strong>${formatMoney(success.amount)}</strong> refunded.
          Stripe reference: <code>{success.refundId}</code>.
        </p>
      )}
      <div className={s.dialogActions}>
        <Button variant="secondary" size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}

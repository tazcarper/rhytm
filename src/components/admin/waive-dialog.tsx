"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Textarea } from "@/lib/ui";
import { applyLineOverrideAction } from "@/app/admin/bids/[id]/override-actions";
import type { ApplyLineOverrideResult } from "@/src/services/admin/apply-line-override";
import { formatMoneyExact } from "@/src/services/public/format";
import s from "./bid-line-items-card.module.css";

interface WaiveDialogProps {
  bidId: string;
  bookingId: string;
  lineItemId: string;
  lineLabel: string;
  originalAmount: number;
  onClose: () => void;
  onApplied: (result: ApplyLineOverrideResult) => void;
}

// The inline waive/comp form for a single line. Enter a comped amount or check
// "waive in full" ($0); a reason (>= 10 chars) is required; the customer-facing
// label is optional (blank renders "Discount applied" to the guest).
export function WaiveDialog({
  bidId,
  bookingId,
  lineItemId,
  lineLabel,
  originalAmount,
  onClose,
  onApplied,
}: WaiveDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [waiveInFull, setWaiveInFull] = useState(true);
  const [amountDraft, setAmountDraft] = useState("0");
  const [reason, setReason] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    // When not waiving in full, an empty/whitespace amount must be rejected,
    // not silently coerced: Number("") and Number("  ") are 0, which would
    // quietly apply a full waive the admin never asked for.
    if (!waiveInFull && amountDraft.trim() === "") {
      setError("Enter a comped amount, or check “waive in full”.");
      return;
    }
    const newAmount = waiveInFull ? 0 : Number(amountDraft);
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      setError("Enter a valid comped amount.");
      return;
    }
    if (newAmount > originalAmount + 0.005) {
      setError(
        `Comped amount can't exceed the line's $${formatMoneyExact(originalAmount)}.`,
      );
      return;
    }
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }

    startTransition(async () => {
      const result = await applyLineOverrideAction(bidId, {
        bookingId,
        lineItemId,
        newAmount,
        reason: reason.trim(),
        customerFacingLabel: label.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't apply the comp.");
        return;
      }
      onApplied(result);
    });
  };

  return (
    <div className={s.dialog}>
      <p className={s.dialogTitle}>Waive / comp · {lineLabel}</p>

      <label className={s.checkboxRow}>
        <input
          type="checkbox"
          checked={waiveInFull}
          onChange={(e) => setWaiveInFull(e.target.checked)}
        />
        Waive in full (${formatMoneyExact(originalAmount)} → $0)
      </label>

      {!waiveInFull && (
        <div className={s.field}>
          <span className={s.fieldLabel}>New amount for this line</span>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            max={String(originalAmount)}
            step="0.01"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      <div className={s.field}>
        <span className={s.fieldLabel}>Reason (admin-only, ≥ 10 characters)</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. comp for VIP wedding party"
          rows={2}
          maxLength={500}
        />
      </div>

      <div className={s.field}>
        <span className={s.fieldLabel}>
          Customer-facing label (optional — blank shows “Discount applied”)
        </span>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. VIP comp"
          maxLength={60}
        />
      </div>

      {error && (
        <Alert variant="error" title="Couldn't apply">
          {error}
        </Alert>
      )}

      <div className={s.dialogActions}>
        <Button variant="primary" size="sm" onClick={submit} loading={isPending}>
          {isPending ? "Applying…" : "Apply comp"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

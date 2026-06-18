"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Textarea } from "@/lib/ui";
import { updateBidPricingAction } from "@/app/admin/bids/[id]/edit/actions";
import { formatMoney } from "@/src/services/public/format";
import { paymentStatusLabel } from "@/src/components/admin/payment-status-badge";
import { MarkdownProse } from "@/src/components/shared/markdown";
import kv from "./bid-detail.module.css";
import s from "./pricing-editor.module.css";

interface PricingEditorProps {
  bidId: string;
  bookingId: string;
  estimatedPrice: number | null;
  confirmedPrice: number | null;
  depositAmount: number | null;
  amountPaid: number;
  effectiveQuote: number | null;
  quoteNote: string | null;
  refundAmount: number | null;
  paid: boolean;
  // Live sum of the booking's add-on line items. The editor diffs this
  // against the total baked into the current quote to surface modifications.
  addOnTotal: number;
}

function moneyToString(amount: number | null): string {
  return amount === null ? "" : String(amount);
}

function formatMoneyOrDash(amount: number | null): string {
  return amount === null ? "—" : `$${formatMoney(amount)}`;
}

function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function formatSignedMoney(amount: number): string {
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}$${formatMoney(Math.abs(amount))}`;
}

export function PricingEditor({
  bidId,
  bookingId,
  estimatedPrice,
  confirmedPrice,
  depositAmount,
  amountPaid,
  effectiveQuote,
  quoteNote,
  refundAmount,
  paid,
  addOnTotal,
}: PricingEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A conflict is a price that moved under the editor since it loaded — shown
  // with a Reload affordance rather than the generic error, and drafts are kept.
  const [conflict, setConflict] = useState(false);

  const [confirmedDraft, setConfirmedDraft] = useState(
    moneyToString(confirmedPrice),
  );
  const [depositDraft, setDepositDraft] = useState(moneyToString(depositAmount));
  const [quoteNoteDraft, setQuoteNoteDraft] = useState(quoteNote ?? "");

  // The add-on total considered "already reflected in the quote." Seeded on
  // first mount and re-seeded whenever a price is saved, so the delta below
  // measures add-ons added/removed since the quote was last set. Survives the
  // router.refresh() after each add-on change (no remount), and resets on a
  // full page load — i.e. modifications are scoped to this editing session.
  const [reflectedAddOnTotal, setReflectedAddOnTotal] = useState(addOnTotal);
  const addOnDelta = round2(addOnTotal - reflectedAddOnTotal);
  const hasModifications = Math.abs(addOnDelta) > 0.005;
  const baseQuote = confirmedPrice ?? estimatedPrice;
  const suggestedQuote =
    baseQuote !== null ? round2(baseQuote + addOnDelta) : null;

  const startEditing = () => {
    setConfirmedDraft(moneyToString(confirmedPrice));
    setDepositDraft(moneyToString(depositAmount));
    setQuoteNoteDraft(quoteNote ?? "");
    setError(null);
    setConflict(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
    setConflict(false);
  };

  // Pull the latest server state after a conflict, keeping the admin's drafts
  // (router.refresh() re-renders without remounting) so they can re-save.
  const reloadLatest = () => {
    setError(null);
    setConflict(false);
    router.refresh();
  };

  const save = () => {
    setError(null);
    setConflict(false);
    startTransition(async () => {
      const result = await updateBidPricingAction({
        bidId,
        bookingId,
        confirmedPrice: confirmedDraft,
        depositAmount: depositDraft,
        quoteNote: quoteNoteDraft.trim() || null,
        expectedConfirmedPrice: confirmedPrice,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save pricing.");
        setConflict(result.conflict ?? false);
        return;
      }
      // Saving a quote acknowledges the current add-ons — clear the delta.
      setReflectedAddOnTotal(addOnTotal);
      setEditing(false);
      router.refresh();
    });
  };

  // One-click: set the confirmed quote to the suggested value, leaving the
  // deposit and quote note as they are.
  const applySuggested = () => {
    if (suggestedQuote === null) return;
    setError(null);
    setConflict(false);
    startTransition(async () => {
      const result = await updateBidPricingAction({
        bidId,
        bookingId,
        confirmedPrice: String(suggestedQuote),
        depositAmount: moneyToString(depositAmount),
        quoteNote,
        expectedConfirmedPrice: confirmedPrice,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't apply the suggested quote.");
        setConflict(result.conflict ?? false);
        return;
      }
      setReflectedAddOnTotal(addOnTotal);
      router.refresh();
    });
  };

  const estimateStruck =
    confirmedPrice !== null && confirmedPrice !== estimatedPrice;
  const balanceDue =
    effectiveQuote !== null && amountPaid > 0 && amountPaid + 0.005 < effectiveQuote
      ? effectiveQuote - amountPaid
      : null;
  const paidLabel = paid
    ? paymentStatusLabel({ amountPaid, depositAmount, effectiveQuote })
    : null;

  return (
    <Card padding="loose" elevation="soft" className={kv.section}>
      <div className={s.head}>
        <h2 className={kv.sectionTitle}>Pricing</h2>
        {!editing && (
          <button type="button" className={s.editLink} onClick={startEditing}>
            Edit
          </button>
        )}
      </div>

      <dl className={kv.kv}>
        <dt className={kv.kvKey}>Estimated</dt>
        <dd className={`${kv.kvValue} ${estimateStruck ? kv.priceStruck : ""}`}>
          {formatMoneyOrDash(estimatedPrice)}
        </dd>

        {editing ? (
          <>
            <dt className={kv.kvKey}>Confirmed quote</dt>
            <dd className={kv.kvValue}>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={confirmedDraft}
                onChange={(e) => setConfirmedDraft(e.target.value)}
                placeholder={
                  estimatedPrice !== null ? estimatedPrice.toFixed(2) : "0.00"
                }
              />
            </dd>

            <dt className={kv.kvKey}>Deposit</dt>
            <dd className={kv.kvValue}>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={depositDraft}
                onChange={(e) => setDepositDraft(e.target.value)}
                placeholder="0.00"
              />
            </dd>

            <dt className={kv.kvKey}>Quote note</dt>
            <dd className={kv.kvValue}>
              <Textarea
                value={quoteNoteDraft}
                onChange={(e) => setQuoteNoteDraft(e.target.value)}
                placeholder="Explain a price change from the estimate (optional, markdown)"
                maxLength={500}
                rows={2}
              />
            </dd>
          </>
        ) : (
          <>
            <dt className={kv.kvKey}>Confirmed quote</dt>
            <dd className={kv.kvValue}>
              {confirmedPrice !== null
                ? `$${formatMoney(confirmedPrice)}`
                : estimatedPrice !== null
                  ? `$${formatMoney(estimatedPrice)} (auto)`
                  : "—"}
              {quoteNote && (
                <div className={s.quoteNote}>
                  <MarkdownProse small>{quoteNote}</MarkdownProse>
                </div>
              )}
            </dd>

            <dt className={kv.kvKey}>Deposit (min)</dt>
            <dd className={kv.kvValue}>{formatMoneyOrDash(depositAmount)}</dd>
          </>
        )}

        <dt className={kv.kvKey}>Amount paid</dt>
        <dd className={kv.kvValue}>
          ${formatMoney(amountPaid)}
          {paid && (
            <span className={kv.paidPill}> · ✓ {paidLabel ?? "Paid"}</span>
          )}
        </dd>

        {balanceDue !== null && (
          <>
            <dt className={kv.kvKey}>Balance due at property</dt>
            <dd className={kv.kvValue}>${formatMoney(balanceDue)}</dd>
          </>
        )}

        {refundAmount !== null && (
          <>
            <dt className={kv.kvKey}>Refund</dt>
            <dd className={kv.kvValue}>{formatMoneyOrDash(refundAmount)}</dd>
          </>
        )}
      </dl>

      {!editing && hasModifications && (
        <div className={s.modsBlock}>
          <div className={s.modRow}>
            <span className={s.modLabel}>Add-on changes</span>
            <span
              className={addOnDelta >= 0 ? s.modUp : s.modDown}
            >
              {formatSignedMoney(addOnDelta)}
            </span>
          </div>
          {suggestedQuote !== null && (
            <>
              <div className={s.modRow}>
                <span className={s.modLabel}>Suggested quote</span>
                <span className={s.suggestedValue}>
                  ${formatMoney(suggestedQuote)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={applySuggested}
                loading={isPending}
                fullWidth
              >
                Apply suggested quote
              </Button>
            </>
          )}
          <p className={s.modHint}>
            Reflects add-ons changed since the quote was last set. Saving any
            quote clears this.
          </p>
        </div>
      )}

      {error && (
        <Alert
          variant="error"
          title={conflict ? "Price changed" : "Couldn't save"}
        >
          <p>{error}</p>
          {conflict && (
            <div className={s.editActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={reloadLatest}
                disabled={isPending}
              >
                Reload latest
              </Button>
            </div>
          )}
        </Alert>
      )}

      {editing && (
        <div className={s.editActions}>
          <Button variant="primary" size="sm" onClick={save} loading={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={cancelEditing}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
}

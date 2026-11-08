"use client";

import { useState } from "react";
import { CircleCheck, Gift } from "lucide-react";
import { Button, Dialog } from "@/lib/ui";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import { dollarsForPoints } from "@/src/services/rewards/points";
import { formatPoints } from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";
import s from "./reward-points-callout.module.css";

// Amazon-style rewards prompt under the payment total. Signed-in members
// only (the parent renders it only when the viewer owns the household).
//
//   not applied → "You have 1,240 reward points to save $60.00 on this payment."
//                 Clicking opens a confirm dialog with the breakdown.
//   applied     → "1,200 points applied · saving $60.00"  [Remove]
//
// Applying or removing re-issues the Stripe payment, which would wipe card
// fields, so both are disabled once the member starts typing card details.

interface RewardPointsCalloutProps {
  balance: number;
  isExpired: boolean;
  /** Most points usable on this charge (blocks of 100, leaves the card minimum). */
  maxPoints: number;
  appliedPoints: number;
  /** Amount before points, for the dialog breakdown. */
  chargeBeforePoints: number;
  onApply: (points: number) => void;
  /** True while the payment is being re-issued. */
  busy: boolean;
  /** True once card details have been typed. */
  lockedByCard: boolean;
}

export function RewardPointsCallout({
  balance,
  isExpired,
  maxPoints,
  appliedPoints,
  chargeBeforePoints,
  onApply,
  busy,
  lockedByCard,
}: RewardPointsCalloutProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const locked = busy || lockedByCard;

  if (appliedPoints > 0) {
    return (
      <div className={s.applied} role="status">
        <CircleCheck className={s.icon} size={20} aria-hidden="true" />
        <span className={s.appliedText}>
          <strong>{formatPoints(appliedPoints)} reward points applied</strong>
          {` · saving $${formatMoney(dollarsForPoints(REWARDS_PROGRAM, appliedPoints))}`}
        </span>
        <button
          type="button"
          className={s.removeButton}
          onClick={() => onApply(0)}
          disabled={locked}
          title={lockedByCard ? "Refresh the page to change this" : undefined}
        >
          Remove
        </button>
      </div>
    );
  }

  if (isExpired) {
    return (
      <p className={s.note}>
        You have {formatPoints(balance)} reward points, but they&rsquo;re past their expiration
        date. Contact the property to have them reinstated.
      </p>
    );
  }

  if (maxPoints === 0) {
    if (balance <= 0) return null;
    return (
      <p className={s.note}>
        You have {formatPoints(balance)} reward points. At {REWARDS_PROGRAM.redemptionStep} points
        you can start saving.
      </p>
    );
  }

  const maxSaving = dollarsForPoints(REWARDS_PROGRAM, maxPoints);

  return (
    <>
      <button
        type="button"
        className={s.callout}
        onClick={() => setDialogOpen(true)}
        disabled={locked}
      >
        <Gift className={s.icon} size={20} aria-hidden="true" />
        <span className={s.calloutText}>
          You have <strong>{formatPoints(balance)} reward points</strong> to save{" "}
          <strong>${formatMoney(maxSaving)}</strong> on this payment.
        </span>
        <span className={s.calloutAction}>Use points</span>
      </button>
      {lockedByCard && (
        <p className={s.note}>To use points, refresh the page before entering card details.</p>
      )}

      {dialogOpen && (
        <ApplyPointsDialog
          balance={balance}
          maxPoints={maxPoints}
          chargeBeforePoints={chargeBeforePoints}
          onCancel={() => setDialogOpen(false)}
          onConfirm={(points) => {
            setDialogOpen(false);
            onApply(points);
          }}
        />
      )}
    </>
  );
}

function ApplyPointsDialog({
  balance,
  maxPoints,
  chargeBeforePoints,
  onCancel,
  onConfirm,
}: {
  balance: number;
  maxPoints: number;
  chargeBeforePoints: number;
  onCancel: () => void;
  onConfirm: (points: number) => void;
}) {
  const step = REWARDS_PROGRAM.redemptionStep;
  const [points, setPoints] = useState(maxPoints);
  const saving = dollarsForPoints(REWARDS_PROGRAM, points);
  const youPay = Math.round((chargeBeforePoints - saving) * 100) / 100;

  const options: number[] = [];
  for (let value = maxPoints; value >= step; value -= step) options.push(value);

  return (
    <Dialog
      title="Use your reward points?"
      size="sm"
      onClose={onCancel}
      footer={
        <div className={s.footer}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(points)}>
            Apply ${formatMoney(saving)} off
          </Button>
        </div>
      }
    >
      <div className={s.dialogBody}>
        <p className={s.dialogLead}>
          You have {formatPoints(balance)} points. Every {step} points takes $
          {formatMoney(dollarsForPoints(REWARDS_PROGRAM, step))} off.
        </p>

        {options.length > 1 && (
          <div>
            <label className={s.fieldLabel} htmlFor="reward-points-amount">
              Points to use
            </label>
            <select
              id="reward-points-amount"
              className={s.select}
              value={points}
              onChange={(e) => setPoints(Number.parseInt(e.target.value, 10))}
            >
              {options.map((value) => (
                <option key={value} value={value}>
                  {`${formatPoints(value)} points (−$${formatMoney(
                    dollarsForPoints(REWARDS_PROGRAM, value),
                  )})`}
                </option>
              ))}
            </select>
          </div>
        )}

        <ul className={s.breakdown}>
          <li>
            <span>This payment</span>
            <span>${formatMoney(chargeBeforePoints)}</span>
          </li>
          <li className={s.saving}>
            <span>{formatPoints(points)} reward points</span>
            <span>&minus;${formatMoney(saving)}</span>
          </li>
          <li className={s.total}>
            <span>You pay by card</span>
            <span>${formatMoney(youPay)}</span>
          </li>
        </ul>

        <p className={s.note}>
          Points are taken from your balance once the payment goes through. You&rsquo;ll earn
          points on the ${formatMoney(youPay)} you pay by card.
        </p>
      </div>
    </Dialog>
  );
}

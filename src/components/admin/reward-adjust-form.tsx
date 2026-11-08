"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import formStyles from "@/src/components/admin/form-styles.module.css";
import { SegmentedChoice } from "@/src/components/admin/event-flow-fields";
import { adjustRewardPointsAction } from "@/app/admin/rewards/actions";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import { dollarsForPoints, pointsForPayment } from "@/src/services/rewards/points";
import {
  STAFF_REWARD_ACTIONS,
  type StaffRewardAction,
} from "@/src/services/rewards/staff-adjust";
import { formatMoney } from "@/src/services/public/format";

// Staff "Add or subtract points" form. Used at check-in until the on-site
// point of sale is connected: log what the member paid at the property,
// or the points they used at the register, with a reason and date.

const ACTION_OPTIONS = (Object.keys(STAFF_REWARD_ACTIONS) as StaffRewardAction[]).map(
  (value) => ({ value, label: STAFF_REWARD_ACTIONS[value].label }),
);

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function RewardAdjustForm({
  membershipId,
  balance,
}: {
  membershipId: string;
  balance: number;
}) {
  const router = useRouter();
  const [action, setAction] = useState<StaffRewardAction>("purchase");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const strategy = STAFF_REWARD_ACTIONS[action];
  const numeric = Number.parseFloat(amount);
  const points =
    Number.isFinite(numeric) && numeric > 0
      ? strategy.input === "dollars"
        ? pointsForPayment(REWARDS_PROGRAM, numeric)
        : Math.round(numeric)
      : 0;
  const preview =
    points > 0
      ? `${strategy.sign > 0 ? "Adds" : "Subtracts"} ${points.toLocaleString()} points ($${formatMoney(
          dollarsForPoints(REWARDS_PROGRAM, points),
        )} in value). New balance: ${(balance + strategy.sign * points).toLocaleString()}.`
      : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    const result = await adjustRewardPointsAction({
      membershipId,
      action,
      amount: numeric,
      reason,
      occurredOn,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(preview);
    setAmount("");
    setReason("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SegmentedChoice
        label="What happened?"
        name="reward-action"
        value={action}
        options={ACTION_OPTIONS}
        onChange={(next) => {
          setAction(next);
          setAmount("");
        }}
      />

      <div className={formStyles.row}>
        <label className={`${formStyles.field} ${formStyles.fit}`}>
          <span className={formStyles.label}>
            {strategy.input === "dollars" ? "Amount paid" : "Points"}
          </span>
          {strategy.input === "dollars" ? (
            <span className={formStyles.money}>
              <input
                className={`${formStyles.input} ${formStyles.wMoney}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </span>
          ) : (
            <input
              className={`${formStyles.input} ${formStyles.wCount}`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          )}
        </label>
        <label className={`${formStyles.field} ${formStyles.fit}`}>
          <span className={formStyles.label}>Date</span>
          <input
            type="date"
            className={`${formStyles.input} ${formStyles.wDate}`}
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            required
          />
        </label>
      </div>
      <p className={formStyles.help}>
        {strategy.input === "dollars"
          ? `Members earn ${REWARDS_PROGRAM.pointsPerDollar} point per $1 paid.`
          : `${REWARDS_PROGRAM.redemptionStep} points = $${formatMoney(
              dollarsForPoints(REWARDS_PROGRAM, REWARDS_PROGRAM.redemptionStep),
            )}. Take the discount off the bill at the register too.`}
        {preview && ` ${preview}`}
      </p>

      <label className={formStyles.field}>
        <span className={formStyles.label}>Reason</span>
        <input
          className={formStyles.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Paid balance at check-in for the Smith party"
          required
        />
        <span className={formStyles.help}>
          Shown to the member in their activity, and kept for the record.
        </span>
      </label>

      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Saved. {saved}</Alert>}

      <div>
        <Button type="submit" disabled={saving || points === 0}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

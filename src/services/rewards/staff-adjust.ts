import { z } from "zod";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import type { RewardEntryInput } from "@/src/services/rewards/ledger";
import { dollarsForPoints, pointsForPayment } from "@/src/services/rewards/points";

// What staff can do from the admin Rewards page, as a strategy map: each
// action knows its ledger kind, its sign, and how to turn the typed number
// into points. Adding an action is a new entry here (Open/Closed).

export type StaffRewardAction =
  | "purchase"
  | "redeem"
  | "correction_add"
  | "correction_subtract";

interface StaffActionStrategy {
  label: string;
  kind: RewardEntryInput["kind"];
  /** What the number box means for this action. */
  input: "dollars" | "points";
  sign: 1 | -1;
}

export const STAFF_REWARD_ACTIONS: Record<StaffRewardAction, StaffActionStrategy> = {
  purchase: { label: "Purchase at the property", kind: "earn", input: "dollars", sign: 1 },
  redeem: { label: "Points used at the property", kind: "redeem", input: "points", sign: -1 },
  correction_add: { label: "Correction: add", kind: "adjustment", input: "points", sign: 1 },
  correction_subtract: { label: "Correction: subtract", kind: "adjustment", input: "points", sign: -1 },
};

export const StaffAdjustmentSchema = z.object({
  membershipId: z.string().uuid(),
  action: z.enum(["purchase", "redeem", "correction_add", "correction_subtract"]),
  amount: z.number().positive().max(1_000_000),
  reason: z.string().trim().min(3, "Add a short reason").max(500),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export type StaffAdjustmentInput = z.infer<typeof StaffAdjustmentSchema>;

export type BuildEntryResult =
  | { ok: true; entry: RewardEntryInput }
  | { ok: false; error: string };

/** Turns the staff form into a ledger entry. Pure. */
export function buildStaffRewardEntry(
  program: RewardsProgram,
  input: StaffAdjustmentInput,
): BuildEntryResult {
  const strategy = STAFF_REWARD_ACTIONS[input.action];

  const points =
    strategy.input === "dollars"
      ? pointsForPayment(program, input.amount)
      : Math.round(input.amount);
  if (points <= 0) return { ok: false, error: "That works out to zero points." };

  const amountUsd =
    strategy.input === "dollars" ? input.amount : dollarsForPoints(program, points);

  return {
    ok: true,
    entry: {
      membershipId: input.membershipId,
      points: strategy.sign * points,
      kind: strategy.kind,
      reason: input.reason,
      occurredOn: input.occurredOn,
      amountUsd,
    },
  };
}

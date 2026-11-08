// The rewards program's numbers, in one place. Changing the earn rate,
// point value, or expiry window is an edit here — no code path hardcodes
// them (Open/Closed). Decided with the client 2026-11-08.

export interface RewardsProgram {
  /** Points earned per whole dollar paid. */
  pointsPerDollar: number;
  /** Dollar value of one point (100 points = $5 → 0.05). */
  dollarsPerPoint: number;
  /** Soft expiry: months after the last earn/spend before points can't be redeemed. */
  expiryMonths: number;
  /** Stripe won't charge less than this, so points can't cover a payment entirely online. */
  minimumCardChargeUsd: number;
  /** Points are applied in steps of this size (100 points = $5). */
  redemptionStep: number;
}

export const REWARDS_PROGRAM: RewardsProgram = {
  pointsPerDollar: 1,
  dollarsPerPoint: 0.05,
  expiryMonths: 18,
  minimumCardChargeUsd: 0.5,
  redemptionStep: 100,
};

export const REWARDS_TERMS_PATH = "/member/rewards/terms";

import type { RewardsProgram } from "@/src/constants/rewards/program";

// Pure point math. No I/O — every caller passes the program config so
// tests (and a future per-property program) can substitute their own.

/** Points earned for a cash payment. Whole points only, rounded down. */
export function pointsForPayment(
  program: RewardsProgram,
  amountPaidUsd: number,
): number {
  if (!Number.isFinite(amountPaidUsd) || amountPaidUsd <= 0) return 0;
  return Math.floor(amountPaidUsd * program.pointsPerDollar + 1e-9);
}

/** Dollar value of a number of points, rounded to cents. */
export function dollarsForPoints(program: RewardsProgram, points: number): number {
  return Math.round(points * program.dollarsPerPoint * 100) / 100;
}

/**
 * Largest number of points (a multiple of the redemption step) a member can
 * apply to a charge: limited by their balance and by leaving at least the
 * card minimum to charge.
 */
export function maxRedeemablePoints(
  program: RewardsProgram,
  balance: number,
  chargeUsd: number,
): number {
  const coverableUsd = Math.max(0, chargeUsd - program.minimumCardChargeUsd);
  const byCharge = Math.floor(coverableUsd / program.dollarsPerPoint + 1e-9);
  const raw = Math.max(0, Math.min(balance, byCharge));
  return raw - (raw % program.redemptionStep);
}

/** True when `points` is a positive whole multiple of the redemption step. */
export function isValidRedemptionAmount(program: RewardsProgram, points: number): boolean {
  return Number.isInteger(points) && points > 0 && points % program.redemptionStep === 0;
}

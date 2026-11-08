import type { RewardKind } from "@/src/services/rewards/ledger";

// Display helpers shared by the admin and member rewards views.

export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

/** Signed points for an activity row: "+200" / "−100". */
export function formatSignedPoints(points: number): string {
  return points > 0 ? `+${formatPoints(points)}` : `−${formatPoints(Math.abs(points))}`;
}

/** "Nov 8, 2026" from an ISO timestamp, in Central time. */
export function formatRewardDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

/** "Nov 8, 2026" from a YYYY-MM-DD business date. */
export function formatRewardDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/** YYYY-MM-DD of an ISO timestamp in Central time (for date inputs). */
export function toCentralDay(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(iso));
}

export const REWARD_KIND_LABEL: Record<RewardKind, string> = {
  earn: "Earned",
  redeem: "Used",
  adjustment: "Adjustment",
};

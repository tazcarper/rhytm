import type { ReminderCadence } from "./reminder-settings";

// Pure cadence planner — decides, given the event date and "now", which
// pre-event touches still fire on schedule and which have already passed
// and must be CONSOLIDATED into a single immediate "everything for your
// visit" email.
//
// Why consolidation: each touch carries different content (the early touch
// has the gear list + directions — the most important pre-trip info). If a
// guest books inside the early window, naively sleeping until a past time
// would either drop that content or fire several emails at once. Instead we
// merge every already-due touch's content blocks into one kickoff email,
// then schedule only the genuinely-future touches.
//
// Examples (defaults 14/3/1):
//   - book 20d out → kickoff: none; scheduled: early, mid, final
//   - book  5d out → kickoff: [early blocks]; scheduled: mid, final
//   - book  1d out → kickoff: [early+mid+final blocks] (one email); scheduled: none
//
// Pure + deterministic: no clock or I/O. The caller passes `nowMs` (captured
// once in an Inngest step so retries replay identically).

export type TouchKey = "early" | "mid" | "final";

export type BlockKey =
  | "gear"
  | "expectations"
  | "directions"
  | "parking"
  | "weather"
  | "arrival"
  | "contact";

// Canonical render order for consolidated emails — logical reading order
// regardless of which touches contributed the blocks.
export const BLOCK_ORDER: readonly BlockKey[] = [
  "gear",
  "expectations",
  "directions",
  "parking",
  "weather",
  "arrival",
  "contact",
];

// Which content blocks each pre-event touch owns.
const TOUCH_BLOCKS: Record<TouchKey, readonly BlockKey[]> = {
  early: ["gear", "expectations", "directions"],
  mid: ["weather", "parking"],
  final: ["arrival", "contact"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduledTouch {
  key: TouchKey;
  sendAtMs: number;
  blocks: BlockKey[];
}

export interface CadencePlan {
  // Non-null when one or more pre-event touches were already due at planning
  // time: a single immediate email carrying the union of their blocks.
  kickoff: { blocks: BlockKey[] } | null;
  // Pre-event touches still in the future, each fired on its own schedule.
  scheduled: ScheduledTouch[];
  // Absolute time for the post-event follow-up.
  followupAtMs: number;
}

function orderBlocks(blocks: Iterable<BlockKey>): BlockKey[] {
  const present = new Set(blocks);
  return BLOCK_ORDER.filter((b) => present.has(b));
}

export function planCadence(input: {
  eventStartAtMs: number;
  nowMs: number;
  cadence: ReminderCadence;
}): CadencePlan {
  const { eventStartAtMs, nowMs, cadence } = input;

  const preTouches: ScheduledTouch[] = (
    [
      ["early", cadence.earlyOffsetDays],
      ["mid", cadence.midOffsetDays],
      ["final", cadence.finalOffsetDays],
    ] as const
  )
    .map(([key, offsetDays]) => ({
      key,
      sendAtMs: eventStartAtMs - offsetDays * DAY_MS,
      blocks: [...TOUCH_BLOCKS[key]],
    }))
    // Sort by fire time so "already due" are always the earliest touches —
    // makes the past/future partition correct even if an admin sets offsets
    // out of the natural 14 > 3 > 1 order.
    .sort((a, b) => a.sendAtMs - b.sendAtMs);

  const due = preTouches.filter((t) => t.sendAtMs <= nowMs);
  const scheduled = preTouches.filter((t) => t.sendAtMs > nowMs);

  const kickoff =
    due.length > 0
      ? { blocks: orderBlocks(due.flatMap((t) => t.blocks)) }
      : null;

  return {
    kickoff,
    scheduled,
    followupAtMs: eventStartAtMs + cadence.followupOffsetDays * DAY_MS,
  };
}

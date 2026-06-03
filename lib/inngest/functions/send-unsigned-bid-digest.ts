import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import { formatDateLongTz, formatSlotLabelTz } from "@/src/services/public/format";
import { getReminderCadence } from "@/src/services/reminders/reminder-settings";
import {
  getStaleUnsignedBidsByProperty,
  type StalePropertyGroup,
} from "@/src/services/reminders/get-stale-unsigned-bids";
import {
  UnsignedBidDigest,
  type UnsignedDigestBid,
} from "@/src/components/email/templates/unsigned-bid-digest";

// W2 — consolidated unsigned-bid staff digest. Runs daily (cron); finds every
// confirmed bid still unsigned past the threshold (default 48h, config-in-DB),
// groups them by property, and emails ONE digest per property to that
// property's notification_email. Up to DISPLAY_LIMIT bids are listed inline;
// the rest collapse into an "and N more" link to the admin bids queue.
//
// This replaces the originally-spec'd per-bid 48h sleep: a single daily scan
// is what produces one consolidated email instead of one nudge per bid. Per
// the no-auto-cancel decision this only nudges — it never changes bid state.

const DISPLAY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function waitingLabel(confirmedAtMs: number, nowMs: number): string {
  const days = Math.max(1, Math.floor((nowMs - confirmedAtMs) / DAY_MS));
  return `${days} day${days === 1 ? "" : "s"} waiting`;
}

export const sendUnsignedBidDigest = inngest.createFunction(
  {
    id: "send-unsigned-bid-digest",
    triggers: [{ cron: "TZ=America/Chicago 0 8 * * *" }],
  },
  async ({ step }) => {
    // Capture "now" once so the cutoff + dedupe day are stable across retries.
    const nowMs = await step.run("now", async () => Date.now());

    const cadence = await step.run("settings", () =>
      getReminderCadence(createServiceRoleClient()),
    );
    if (!cadence.unsignedDigestEnabled) {
      return { ok: true, skipped: "digest-disabled" };
    }

    const cutoffIso = new Date(
      nowMs - cadence.unsignedDigestHours * HOUR_MS,
    ).toISOString();

    const groups = await step.run("lookup-stale-bids", () =>
      getStaleUnsignedBidsByProperty(createServiceRoleClient(), cutoffIso),
    );

    if (groups.length === 0) {
      return { ok: true, sent: 0 };
    }

    const dayStr = new Date(nowMs).toISOString().slice(0, 10);
    const origin = getSiteOrigin();
    const bidsIndexUrl = `${origin}/admin/bids`;

    let sent = 0;
    for (const group of groups) {
      const result = await step.run(
        `send-${group.propertyId}`,
        async () => sendPropertyDigest({ group, nowMs, dayStr, origin, bidsIndexUrl }),
      );
      if (result.sent) sent += 1;
    }

    return { ok: true, sent };
  },
);

async function sendPropertyDigest(opts: {
  group: StalePropertyGroup;
  nowMs: number;
  dayStr: string;
  origin: string;
  bidsIndexUrl: string;
}): Promise<{ sent: boolean }> {
  const { group, nowMs, dayStr, origin, bidsIndexUrl } = opts;

  const shown = group.bids.slice(0, DISPLAY_LIMIT);
  const overflowCount = group.bids.length - shown.length;

  const bids: UnsignedDigestBid[] = shown.map((bid) => ({
    guestName: bid.guestName,
    dateLong: formatDateLongTz(bid.startTime, group.propertyTimezone),
    timeLabel: `${formatSlotLabelTz(bid.startTime, group.propertyTimezone)} CT`,
    waitingLabel: waitingLabel(Date.parse(bid.confirmedAt), nowMs),
    reviewUrl: `${origin}/admin/bids/${bid.bidId}`,
  }));

  const props = {
    propertyName: group.propertyName,
    bids,
    overflowCount,
    bidsIndexUrl,
  };

  const result = await getEmailService().send({
    to: group.notificationEmail,
    from: DEFAULT_FROM_EMAIL,
    subject: `${group.bids.length} bid${
      group.bids.length === 1 ? "" : "s"
    } awaiting signature — ${group.propertyName}`,
    source: "staff_unsigned_digest",
    // One digest per property per day — stable so a retry doesn't double-send.
    idempotencyKey: `unsigned-digest:${group.propertyId}:${dayStr}`,
    template: {
      name: "unsigned_bid_digest",
      element: createElement(UnsignedBidDigest, props),
      props,
    },
  });

  if (!result.ok) {
    throw new Error(
      `unsigned-bid digest send failed for property ${group.propertyId}: ${
        result.error ?? "unknown"
      }`,
    );
  }
  return { sent: true };
}

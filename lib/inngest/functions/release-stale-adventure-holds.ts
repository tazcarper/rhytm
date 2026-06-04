import "server-only";
import { inngest } from "@/lib/inngest/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ADVENTURE_HOLD_TTL_MINUTES } from "@/src/services/members/start-adventure-checkout";

// Releases abandoned adventure checkout holds. A reservation that starts
// checkout sits in `pending_payment` (occupying a capacity slot via the
// trigger) until the Stripe webhook confirms it. If the member never
// finishes paying, this sweep cancels the hold so the spot frees up (the
// sync_adventure_sold_out trigger re-opens the adventure).
//
// TTL is generous (30 min) vs. webhook latency (seconds), so a payment
// that succeeded just before the sweep is already confirmed and no longer
// `pending_payment` — it won't be touched. Uses `updated_at` so a hold
// that was re-entered (party changed) gets a fresh window.

export const releaseStaleAdventureHolds = inngest.createFunction(
  {
    id: "release-stale-adventure-holds",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const nowMs = await step.run("now", async () => Date.now());
    const cutoffIso = new Date(
      nowMs - ADVENTURE_HOLD_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    const released = await step.run("release-holds", async () => {
      const admin = createServiceRoleClient();
      const { data, error } = await admin
        .from("member_adventure_rsvps")
        .update({ status: "cancelled" })
        .eq("status", "pending_payment")
        .lt("updated_at", cutoffIso)
        .select("id");
      if (error) {
        throw new Error(`[release-stale-adventure-holds] update failed: ${error.message}`);
      }
      return data?.length ?? 0;
    });

    return { ok: true, released };
  },
);

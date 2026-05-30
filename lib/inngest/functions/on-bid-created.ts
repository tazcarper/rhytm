import "server-only";
import { inngest } from "../client";
import { bidCreated } from "../events";

// Scaffold function — subscribes to `bid/created` and logs.
//
// Purpose: prove the wiring works end-to-end (event fire → Inngest
// receives → function runs → log appears). Once any workflow actually
// needs `bid/created`, the body of this function (or a sibling
// function subscribing to the same event) gets the real work.
//
// Inngest convention: every function has a stable `id`. Changing it
// is a rename in the dashboard (prior run history orphaned). Pick
// descriptive kebab-case names that won't drift.

export const onBidCreated = inngest.createFunction(
  {
    id: "scaffold-on-bid-created",
    triggers: [bidCreated],
  },
  async ({ event, step }) => {
    await step.run("log", async () => {
      console.log("[inngest:scaffold] bid/created received", {
        bidId: event.data.bidId,
        bookingId: event.data.bookingId,
        propertySlug: event.data.propertySlug,
      });
      return { logged: true };
    });

    return { ok: true, eventId: event.id };
  },
);

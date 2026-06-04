import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { adventureSpotOpened } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import { AdventureSpotOpened } from "@/src/components/email/templates/adventure-spot-opened";

// On a freed adventure seat, email the waitlisted members to claim it
// (first come). Skips if staff manually sold the adventure out or it's
// somehow still full. Notify-to-claim — the seat is publicly reopened
// (sync trigger) and whoever finishes checkout first gets it.
export const notifyAdventureWaitlist = inngest.createFunction(
  {
    id: "notify-adventure-waitlist",
    triggers: [adventureSpotOpened],
  },
  async ({ event, step }) => {
    const { adventureId } = event.data;

    const context = await step.run(
      "load-adventure",
      async (): Promise<{ ok: false } | { ok: true; title: string; propertyName: string }> => {
        const supabase = createServiceRoleClient();
        const { data: adv } = await supabase
          .from("member_adventures")
          .select("title, max_capacity, is_manually_sold_out, properties ( name )")
          .eq("id", adventureId)
          .single();
        if (!adv || adv.is_manually_sold_out) return { ok: false };

        const { data: occ } = await supabase
          .from("member_adventure_rsvps")
          .select("guest_count")
          .eq("adventure_id", adventureId)
          .in("status", ["confirmed", "pending_payment"]);
        const occupied = (occ ?? []).reduce((sum, r) => sum + r.guest_count, 0);
        if (occupied >= adv.max_capacity) return { ok: false }; // still full

        const property = Array.isArray(adv.properties) ? adv.properties[0] : adv.properties;
        return { ok: true, title: adv.title, propertyName: property?.name ?? "Rhythm Outdoors" };
      },
    );
    if (!context.ok) return { ok: true, skipped: true };

    const recipients = await step.run("load-waitlist", async () => {
      const supabase = createServiceRoleClient();
      const { data: rsvps } = await supabase
        .from("member_adventure_rsvps")
        .select("created_by_person_id")
        .eq("adventure_id", adventureId)
        .eq("status", "waitlisted")
        .order("waitlisted_at", { ascending: true, nullsFirst: true })
        .limit(25);
      const ids = Array.from(
        new Set((rsvps ?? []).map((r) => r.created_by_person_id).filter((v): v is string => !!v)),
      );
      if (ids.length === 0) return [] as { email: string; firstName: string | null }[];
      const { data: people } = await supabase
        .from("people")
        .select("email, first_name")
        .in("id", ids);
      return (people ?? [])
        .filter((p): p is { email: string; first_name: string | null } => !!p.email)
        .map((p) => ({ email: p.email, firstName: p.first_name }));
    });
    if (recipients.length === 0) return { ok: true, notified: 0 };

    // Link straight into the (now-reopened) reserve flow so a waitlister
    // can claim — the detail page would just show "You're waitlisted".
    const reserveUrl = `${getSiteOrigin()}/adventures/${adventureId}/reserve`;
    const sent = await step.run("send", async () => {
      let count = 0;
      for (const r of recipients) {
        const props = {
          guestName: r.firstName ?? "Member",
          adventureTitle: context.title,
          propertyName: context.propertyName,
          reserveUrl,
        };
        const result = await getEmailService().send({
          to: r.email,
          from: DEFAULT_FROM_EMAIL,
          subject: `A spot opened — ${context.title}`,
          source: "adventure_waitlist",
          idempotencyKey: `${event.id}:${r.email}`,
          template: {
            name: "adventure_spot_opened",
            element: createElement(AdventureSpotOpened, props),
            props,
          },
        });
        if (result.ok) count += 1;
      }
      return count;
    });

    return { ok: true, notified: sent };
  },
);

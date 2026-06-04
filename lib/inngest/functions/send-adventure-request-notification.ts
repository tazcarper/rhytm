import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { adventureRequested } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import { AdventureRequestNotification } from "@/src/components/email/templates/adventure-request-notification";

// Alerts the property's staff inbox when a member requests an inquire-mode
// adventure. Recipient is the property's `notification_email` (config-in-DB);
// null → the property hasn't opted in, so we no-op cleanly. Mirrors
// send-new-bid-staff-notification.
export const sendAdventureRequestNotification = inngest.createFunction(
  {
    id: "send-adventure-request-notification",
    triggers: [adventureRequested],
  },
  async ({ event, step }) => {
    const { rsvpId, adventureId, adventureTitle, propertyId, propertyName, guestName, guestCount } =
      event.data;

    const notificationEmail = await step.run("lookup-property-inbox", async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("properties")
        .select("notification_email")
        .eq("id", propertyId)
        .single();
      return data?.notification_email ?? null;
    });

    if (!notificationEmail) {
      return { ok: true, rsvpId, skipped: "no-notification-email" };
    }

    const sent = await step.run("send", async () => {
      const props = {
        propertyName,
        adventureTitle,
        guestName,
        guestCount,
        reviewUrl: `${getSiteOrigin()}/admin/adventures/${adventureId}`,
      };
      const result = await getEmailService().send({
        to: notificationEmail as string,
        from: DEFAULT_FROM_EMAIL,
        subject: `New adventure request — ${adventureTitle}`,
        source: "staff_adventure_request",
        idempotencyKey: `adventure-request:${rsvpId}`,
        template: {
          name: "adventure_request_notification",
          element: createElement(AdventureRequestNotification, props),
          props,
        },
      });
      if (!result.ok) {
        throw new Error(
          `adventure request notification failed for ${rsvpId}: ${result.error ?? "unknown"}`,
        );
      }
      return { messageId: result.id ?? null };
    });

    return { ok: true, rsvpId, messageId: sent.messageId };
  },
);

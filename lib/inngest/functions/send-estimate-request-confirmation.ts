import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { estimateRequestCreated } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { EstimateRequestConfirmation } from "@/src/components/email/templates/estimate-request-confirmation";

// Subscribes to `estimate/request-created` (alongside the staff alert) and
// sends the customer a short "we've got your request" confirmation. The bid
// link comes later, when staff send it — this email just acknowledges the
// lead so the customer isn't left wondering.

type EstimateConfirmationRow = {
  contact_name: string;
  contact_email: string;
  preferred_date: string | null;
  indicative_total: string | null;
  properties: { name: string } | null;
};

export const sendEstimateRequestConfirmation = inngest.createFunction(
  {
    id: "send-estimate-request-confirmation",
    triggers: [estimateRequestCreated],
  },
  async ({ event, step }) => {
    const { estimateRequestId } = event.data;

    const details = await step.run("lookup-estimate-request", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("estimate_requests")
        .select(
          "contact_name, contact_email, preferred_date, indicative_total, properties ( name )",
        )
        .eq("id", estimateRequestId)
        .single<EstimateConfirmationRow>();

      if (error || !data) {
        throw new Error(
          `lookup-estimate-request failed for ${estimateRequestId}: ${
            error?.message ?? "no row"
          }`,
        );
      }
      return data;
    });

    const sendResult = await step.run("send", async () => {
      const propertyName = details.properties?.name ?? null;

      const props = {
        contactName: details.contact_name,
        propertyName,
        preferredDate: details.preferred_date ?? "—",
        indicativeTotal: details.indicative_total ?? "—",
      };

      const result = await getEmailService().send({
        to: details.contact_email,
        from: DEFAULT_FROM_EMAIL,
        subject: propertyName
          ? `We've got your estimate request — ${propertyName}`
          : "We've got your estimate request",
        source: "estimate_request_confirmation",
        idempotencyKey: `estimate:${estimateRequestId}`,
        template: {
          name: "estimate_request_confirmation",
          element: createElement(EstimateRequestConfirmation, props),
          props,
        },
      });

      if (!result.ok) {
        throw new Error(
          `estimate confirmation send failed for ${estimateRequestId}: ${
            result.error ?? "unknown"
          }`,
        );
      }
      return { messageId: result.id ?? null };
    });

    return { ok: true, estimateRequestId, messageId: sendResult.messageId };
  },
);

import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { estimateRequestCreated } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import { EstimateNewLeadStaffNotification } from "@/src/components/email/templates/estimate-new-lead-staff-notification";

// Subscribes to `estimate/request-created` and alerts the property's club
// manager that a new lead is waiting in /admin/estimates. Recipient is the
// property's `notification_email` (config-in-DB, same field the new-bid staff
// alert uses); when it's null — or the lead has no mapped property (a
// "Coming Soon" capture-interest) — the function no-ops cleanly rather than
// erroring.

const CHANNEL_LABELS: Record<string, string> = {
  member: "Member",
  non_member: "Non-member",
  public_group: "Public group",
  partner: "Partner",
};

type EstimateLeadRow = {
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  source_channel: string;
  members: number | null;
  guest_adults: number | null;
  guest_juniors: number | null;
  adults: number;
  juniors: number;
  experiences: unknown;
  preferred_date: string | null;
  indicative_total: string | null;
  created_by_label: string;
  properties: { name: string; notification_email: string | null } | null;
};

// "2 members · 10 guest adults · 1 guest junior", or the legacy adults/juniors
// totals for rows created before the composition columns existed.
function partyLine(row: EstimateLeadRow): string {
  const hasComposition =
    row.members !== null || row.guest_adults !== null || row.guest_juniors !== null;
  if (hasComposition) {
    const m = row.members ?? 0;
    const ga = row.guest_adults ?? 0;
    const gj = row.guest_juniors ?? 0;
    const parts = [`${m} member${m === 1 ? "" : "s"}`, `${ga} guest adult${ga === 1 ? "" : "s"}`];
    if (gj > 0) parts.push(`${gj} guest junior${gj === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }
  const parts = [`${row.adults} adult${row.adults === 1 ? "" : "s"}`];
  if (row.juniors > 0) parts.push(`${row.juniors} junior${row.juniors === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function experiencesLine(experiences: unknown): string {
  if (Array.isArray(experiences) && experiences.length > 0) {
    return (experiences as unknown[]).map(String).join(", ");
  }
  return "—";
}

export const sendEstimateLeadStaffNotification = inngest.createFunction(
  {
    id: "send-estimate-lead-staff-notification",
    triggers: [estimateRequestCreated],
  },
  async ({ event, step }) => {
    const { estimateRequestId } = event.data;

    const details = await step.run("lookup-estimate-request", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("estimate_requests")
        .select(
          "contact_name, contact_email, contact_phone, source_channel, members, guest_adults, guest_juniors, adults, juniors, experiences, preferred_date, indicative_total, created_by_label, properties ( name, notification_email )",
        )
        .eq("id", estimateRequestId)
        .single<EstimateLeadRow>();

      if (error || !data) {
        throw new Error(
          `lookup-estimate-request failed for ${estimateRequestId}: ${
            error?.message ?? "no row"
          }`,
        );
      }
      return data;
    });

    // No mapped property (Coming Soon lead) or no configured inbox → nothing
    // to alert. The lead is still captured and visible in /admin/estimates.
    const notificationEmail = details.properties?.notification_email ?? null;
    if (!notificationEmail) {
      return { ok: true, estimateRequestId, skipped: "no-notification-email" };
    }

    const sendResult = await step.run("send", async () => {
      const propertyName = details.properties?.name ?? "Rhythm Outdoors";
      const reviewUrl = `${getSiteOrigin()}/admin/estimates/${estimateRequestId}`;

      const props = {
        propertyName,
        contactName: details.contact_name,
        contactEmail: details.contact_email,
        contactPhone: details.contact_phone,
        channelLabel: CHANNEL_LABELS[details.source_channel] ?? details.source_channel,
        partyLine: partyLine(details),
        experiencesLine: experiencesLine(details.experiences),
        preferredDate: details.preferred_date ?? "—",
        indicativeTotal: details.indicative_total ?? "—",
        createdByLabel: details.created_by_label,
        reviewUrl,
      };

      const result = await getEmailService().send({
        to: notificationEmail,
        from: DEFAULT_FROM_EMAIL,
        subject: `New estimate request — ${propertyName} · ${details.contact_name}`,
        source: "estimate_lead_staff",
        idempotencyKey: `estimate:${estimateRequestId}`,
        template: {
          name: "estimate_new_lead_staff_notification",
          element: createElement(EstimateNewLeadStaffNotification, props),
          props,
        },
      });

      if (!result.ok) {
        throw new Error(
          `estimate staff notification send failed for ${estimateRequestId}: ${
            result.error ?? "unknown"
          }`,
        );
      }
      return { messageId: result.id ?? null };
    });

    return { ok: true, estimateRequestId, messageId: sendResult.messageId };
  },
);

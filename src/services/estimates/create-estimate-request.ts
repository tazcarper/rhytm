import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Lead capture for the estimate-driven flow. Calls the
// `create_estimate_request` Postgres function (SECURITY DEFINER) to insert
// one row regardless of caller identity — the public/self-serve door has no
// auth session and no direct table INSERT. One round-trip; one row.
//
// v1 captures the lead only. The indicative total is a client-computed
// string (the binding price is staff-built on the bid), so nothing here is
// trusted as money. Mirrors the shape of create-public-booking.ts.

// The four pricing doors. Aligns with the `estimate_channel` DB enum.
export const ESTIMATE_CHANNELS = [
  "member",
  "non_member",
  "public_group",
  "partner",
] as const;
export type EstimateChannel = (typeof ESTIMATE_CHANNELS)[number];

export const EstimateRequestInputSchema = z.object({
  // Mapped from the club selection by slug in the submit action. Null when
  // the lead doesn't yet map to a bookable property (e.g. Packsaddle
  // "Coming Soon" capture-interest).
  propertyId: z.uuid().nullable().default(null),
  sourceChannel: z.enum(ESTIMATE_CHANNELS),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email(),
    phone: z.string().trim().max(40).default(""),
  }),
  adults: z.number().int().min(0).max(500).default(1),
  juniors: z.number().int().min(0).max(500).default(0),
  // Free-shape captured selections — intentionally un-normalized in v1.
  experiences: z.array(z.string().max(60)).default([]),
  addons: z.record(z.string(), z.unknown()).default({}),
  catering: z.unknown().nullable().default(null),
  // YYYY-MM-DD or empty.
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  backupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  arrival: z.string().trim().max(40).default(""),
  notes: z.string().trim().max(4000).default(""),
  // Client-computed display figure ("$1,240", "Coming Soon", "Custom").
  indicativeTotal: z.string().trim().max(60).default(""),
  // 'self-serve' for the public door, or the staff member's name on a phone
  // intake. Set by the submit action.
  createdByLabel: z.string().trim().max(120).default("self-serve"),
  // Auth user id when a signed-in staff member submits on behalf. Computed
  // server-side from the session in the submit action, never trusted from
  // the form.
  createdByStaffId: z.uuid().nullable().default(null),
});

export type EstimateRequestInput = z.input<typeof EstimateRequestInputSchema>;

export type CreateEstimateRequestResult =
  | { ok: true; estimateRequestId: string }
  | { ok: false; reason: "validation" | "unknown"; message: string };

export async function createEstimateRequest(
  input: EstimateRequestInput,
): Promise<CreateEstimateRequestResult> {
  const parsed = EstimateRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: parsed.error.issues[0]?.message ?? "Invalid request details.",
    };
  }

  const v = parsed.data;
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("create_estimate_request", {
    p_property_id: v.propertyId,
    p_source_channel: v.sourceChannel,
    p_contact_name: v.contact.name,
    p_contact_email: v.contact.email,
    p_contact_phone: v.contact.phone,
    p_adults: v.adults,
    p_juniors: v.juniors,
    p_experiences: v.experiences,
    p_addons: v.addons,
    p_catering: v.catering ?? null,
    p_preferred_date: v.preferredDate,
    p_backup_date: v.backupDate,
    p_arrival: v.arrival,
    p_notes: v.notes,
    p_indicative_total: v.indicativeTotal,
    p_created_by_label: v.createdByLabel,
    p_created_by_staff_id: v.createdByStaffId,
  });

  if (error) {
    console.error("[estimates/create-estimate-request] rpc failed", { error });
    return {
      ok: false,
      reason: "unknown",
      message: "We couldn't submit your request. Please try again or contact us.",
    };
  }

  // The RPC returns the new id as a scalar uuid.
  const id = data as string | null;
  if (!id) {
    return {
      ok: false,
      reason: "unknown",
      message: "Request created but no record returned. Please contact us.",
    };
  }

  return { ok: true, estimateRequestId: id };
}

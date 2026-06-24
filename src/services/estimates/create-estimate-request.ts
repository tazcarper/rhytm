import { after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { estimateRequestCreated } from "@/lib/inngest/events";

// Lead capture for the estimate-driven flow. Calls the
// `create_estimate_request` Postgres function (SECURITY DEFINER) to insert
// one row regardless of caller identity — the public/self-serve door has no
// auth session and no direct table INSERT. One round-trip; one row.
//
// v1 captures the lead only. The indicative total is a client-computed
// string (the binding price is staff-built on the bid), so nothing here is
// trusted as money. Mirrors the shape of create-public-booking.ts.

// The four pricing doors. Aligns with the `estimate_channel` DB enum.
//
// Forward-reference (schema-extension-response.md §3.1 / §5.2): a later PR-1
// slice introduces a decoupled `price_tiers` lookup
// (retail/member/group/partner/non_member) and a channel→tier strategy map.
// The mapping is NOT 1:1 — `public_group` maps to the `group` tier, and no
// channel here yields `retail` (that tier covers public walk-in / non-group).
// Keep that map as config when it lands; do not rename these channel values.
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
  // Party composition. members shoot on dues (member host only); guests are
  // non-members who drive fees. The legacy adults/juniors columns are derived
  // from these for back-compat (adults = members + guestAdults).
  members: z.number().int().min(0).max(500).default(0),
  guestAdults: z.number().int().min(0).max(500).default(0),
  guestJuniors: z.number().int().min(0).max(500).default(0),
  // Private lesson length in hours (null when no lesson selected).
  lessonHours: z.number().int().min(1).max(12).nullable().default(null),
  // Staff-added flat line items (staff phone-intake only).
  customLines: z
    .array(z.object({ label: z.string().trim().min(1).max(120), amount: z.number().nonnegative() }))
    .default([]),
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

  const parsedInput = parsed.data;
  const supabase = createServiceRoleClient();

  // Legacy adults/juniors kept in sync for back-compat: adults = all adults
  // in the party (members + guest adults), juniors = guest juniors.
  const legacyAdults = parsedInput.members + parsedInput.guestAdults;
  const legacyJuniors = parsedInput.guestJuniors;

  const { data, error } = await supabase.rpc("create_estimate_request", {
    p_property_id: parsedInput.propertyId,
    p_source_channel: parsedInput.sourceChannel,
    p_contact_name: parsedInput.contact.name,
    p_contact_email: parsedInput.contact.email,
    p_contact_phone: parsedInput.contact.phone,
    p_adults: legacyAdults,
    p_juniors: legacyJuniors,
    p_experiences: parsedInput.experiences,
    p_addons: parsedInput.addons,
    p_catering: parsedInput.catering ?? null,
    p_preferred_date: parsedInput.preferredDate,
    p_backup_date: parsedInput.backupDate,
    p_arrival: parsedInput.arrival,
    p_notes: parsedInput.notes,
    p_indicative_total: parsedInput.indicativeTotal,
    p_created_by_label: parsedInput.createdByLabel,
    p_created_by_staff_id: parsedInput.createdByStaffId,
    p_members: parsedInput.members,
    p_guest_adults: parsedInput.guestAdults,
    p_guest_juniors: parsedInput.guestJuniors,
    p_lesson_hours: parsedInput.lessonHours,
    p_custom_lines: parsedInput.customLines,
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

  // Fire the lead-created event post-response so the two notification emails
  // (club manager + customer confirmation) never block or fail the submit.
  // The row is already committed (the RPC autocommits), so subscribers can
  // read it. Best-effort: a send failure here must not surface as an error on
  // the submit path. The producer-side `id` lets Inngest dedupe retries.
  after(() => fireEstimateCreatedBestEffort(id));

  return { ok: true, estimateRequestId: id };
}

// Best-effort `estimate/request-created` Inngest send. Runs from `after()`
// so it cannot delay or fail the submit response. Inngest retries transient
// HTTP failures internally; a hard failure here only loses the notification
// emails for this lead (the lead itself is safely captured and visible in
// /admin/estimates).
async function fireEstimateCreatedBestEffort(
  estimateRequestId: string,
): Promise<void> {
  try {
    await inngest.send({
      id: `estimate-${estimateRequestId}-created`,
      name: estimateRequestCreated.name,
      data: { estimateRequestId },
    });
  } catch (err) {
    console.error(
      "[estimates/create-estimate-request] inngest estimate/request-created send failed",
      { estimateRequestId, err },
    );
  }
}

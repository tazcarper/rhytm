import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Create / update a member_adventure from the admin editor. Validates,
// assembles the details jsonb from the form fields (dropping any
// placeholder/devTest markers — an admin-saved adventure is real), and
// writes via the caller's RLS-scoped client (admin/property_manager write
// policies). The DB CHECK constraints (end_after_start,
// guests_per_rsvp_within_capacity, payment_mode) are the backstop; we
// validate first for friendly errors.

const urlish = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .or(z.literal(""))
  .optional();

const SectionSchema = z.object({
  heading: z.string().trim().min(1, "Heading required").max(200),
  body: z.string().trim().min(1, "Body required").max(2000),
  image: urlish,
});

export const SaveAdventureSchema = z
  .object({
    id: z.string().uuid().optional(),
    propertyId: z.string().uuid("Pick a property"),
    title: z.string().trim().min(1, "Title required").max(200),
    description: z.string().trim().max(4000).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date required"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date required"),
    maxCapacity: z.number().int().positive("Capacity must be > 0"),
    maxGuestsPerRsvp: z.number().int().positive("Per-RSVP guests must be > 0"),
    price: z.number().min(0, "Price can't be negative"),
    guestPrice: z.number().min(0).nullable(),
    depositAmount: z.number().min(0).nullable(),
    freeCancellationDays: z.number().int().min(0).max(365),
    paymentMode: z.enum(["instant", "deposit", "inquire"]),
    status: z.enum(["draft", "published", "sold_out", "cancelled", "completed"]),
    isManuallySoldOut: z.boolean(),
    // details
    category: z.string().trim().max(60).optional(),
    location: z.string().trim().max(120).optional(),
    durationLabel: z.string().trim().max(120).optional(),
    datesLabel: z.string().trim().max(120).optional(),
    priceLabel: z.string().trim().max(60).optional(),
    badge: z.string().trim().max(40).optional(),
    comingSoon: z.boolean(),
    heroImage: urlish,
    gallery: z.array(z.string().trim().url()).max(12),
    attributes: z.array(z.string().trim()).max(20),
    highlights: z.array(z.string().trim().min(1).max(160)).max(12),
    sections: z.array(SectionSchema).max(8),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((v) => v.maxGuestsPerRsvp <= v.maxCapacity, {
    message: "Per-RSVP guests can't exceed total capacity",
    path: ["maxGuestsPerRsvp"],
  });

export type SaveAdventureInput = z.infer<typeof SaveAdventureSchema>;

export type SaveAdventureResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function buildDetails(v: SaveAdventureInput): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  const set = (key: string, value: string | undefined) => {
    if (value) details[key] = value;
  };
  set("category", v.category);
  set("location", v.location);
  set("durationLabel", v.durationLabel);
  set("datesLabel", v.datesLabel);
  set("priceLabel", v.priceLabel);
  set("badge", v.badge);
  set("heroImage", v.heroImage || undefined);
  if (v.comingSoon) details.comingSoon = true;
  if (v.gallery.length) details.gallery = v.gallery;
  if (v.attributes.length) details.attributes = v.attributes;
  if (v.highlights.length) details.highlights = v.highlights;
  if (v.sections.length) {
    details.sections = v.sections.map((sec) => ({
      heading: sec.heading,
      body: sec.body,
      ...(sec.image ? { image: sec.image } : {}),
    }));
  }
  return details;
}

export async function saveAdventure(
  supabase: SupabaseClient,
  input: SaveAdventureInput,
): Promise<SaveAdventureResult> {
  const row = {
    property_id: input.propertyId,
    title: input.title,
    description: input.description || null,
    start_date: input.startDate,
    end_date: input.endDate,
    max_capacity: input.maxCapacity,
    max_guests_per_rsvp: input.maxGuestsPerRsvp,
    price: input.price,
    guest_price: input.guestPrice,
    deposit_amount: input.depositAmount,
    free_cancellation_days: input.freeCancellationDays,
    payment_mode: input.paymentMode,
    status: input.status,
    is_manually_sold_out: input.isManuallySoldOut,
    details: buildDetails(input),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("member_adventures")
      .update(row)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Update failed." };
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("member_adventures")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Create failed." };
  return { ok: true, id: data.id };
}

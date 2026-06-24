import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MutationResult } from "./catalog";

// Admin CRUD for the F&B catering options shown on the estimate (HH +
// Packsaddle). Single-table, no booking references, so delete is a plain
// delete. Mirrors the catalog add-ons service shape.

export interface AdminCateringOption {
  id: string;
  propertyId: string;
  tier: string;
  vendorName: string;
  pricePerHead: number;
  isActive: boolean;
  displayOrder: number;
}

type CateringRow = {
  id: string;
  property_id: string;
  tier: string;
  vendor_name: string;
  price_per_head: string | number;
  is_active: boolean;
  display_order: number;
};

const COLUMNS =
  "id, property_id, tier, vendor_name, price_per_head, is_active, display_order";

function rowToOption(row: CateringRow): AdminCateringOption {
  return {
    id: row.id,
    propertyId: row.property_id,
    tier: row.tier,
    vendorName: row.vendor_name,
    pricePerHead:
      typeof row.price_per_head === "string"
        ? parseFloat(row.price_per_head)
        : row.price_per_head,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

export async function getPropertyCatering(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<AdminCateringOption[]> {
  const { data, error } = await supabase
    .from("catering_options")
    .select(COLUMNS)
    .eq("property_id", propertyId)
    .order("display_order")
    .order("vendor_name");
  if (error) throw new Error(`Catering read failed: ${error.message}`);
  return ((data ?? []) as CateringRow[]).map(rowToOption);
}

// =============================================================================
// Zod schemas
// =============================================================================

const uuidSchema = z.string().uuid();
const tierSchema = z.string().trim().min(1, "Tier is required").max(80);
const vendorSchema = z.string().trim().min(1, "Vendor is required").max(200);
const priceSchema = z.coerce.number().min(0, "Must be ≥ 0").max(100000, "Must be ≤ 100,000");
const displayOrderSchema = z.coerce.number().int().min(0).max(9999);

export const CreateCateringInputSchema = z.object({
  propertyId: uuidSchema,
  tier: tierSchema,
  vendorName: vendorSchema,
  pricePerHead: priceSchema,
  displayOrder: displayOrderSchema.default(0),
});
export type CreateCateringInput = z.infer<typeof CreateCateringInputSchema>;
export type CreateCateringRawInput = z.input<typeof CreateCateringInputSchema>;

export const UpdateCateringInputSchema = z.object({
  id: uuidSchema,
  tier: tierSchema,
  vendorName: vendorSchema,
  pricePerHead: priceSchema,
  isActive: z.boolean(),
});
export type UpdateCateringInput = z.infer<typeof UpdateCateringInputSchema>;
export type UpdateCateringRawInput = z.input<typeof UpdateCateringInputSchema>;

export const ReorderCateringInputSchema = z.object({
  propertyId: uuidSchema,
  orderedIds: z.array(uuidSchema).min(1).max(200),
});
export type ReorderCateringInput = z.infer<typeof ReorderCateringInputSchema>;

// =============================================================================
// Writes
// =============================================================================

export async function createCateringOption(
  supabase: SupabaseClient,
  input: CreateCateringInput,
): Promise<{ ok: true; option: AdminCateringOption } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("catering_options")
    .insert({
      property_id: input.propertyId,
      tier: input.tier,
      vendor_name: input.vendorName,
      price_per_head: input.pricePerHead,
      display_order: input.displayOrder,
    })
    .select(COLUMNS)
    .single();
  if (error) return { ok: false, error: `Couldn't create catering option: ${error.message}` };
  return { ok: true, option: rowToOption(data as CateringRow) };
}

export async function updateCateringOption(
  supabase: SupabaseClient,
  input: UpdateCateringInput,
): Promise<MutationResult> {
  const { error } = await supabase
    .from("catering_options")
    .update({
      tier: input.tier,
      vendor_name: input.vendorName,
      price_per_head: input.pricePerHead,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: `Couldn't save catering option: ${error.message}` };
  return { ok: true };
}

export async function deleteCateringOption(
  supabase: SupabaseClient,
  id: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("catering_options").delete().eq("id", id);
  if (error) return { ok: false, error: `Couldn't delete catering option: ${error.message}` };
  return { ok: true };
}

export async function reorderCateringOptions(
  supabase: SupabaseClient,
  input: ReorderCateringInput,
): Promise<MutationResult> {
  for (let index = 0; index < input.orderedIds.length; index++) {
    const { error } = await supabase
      .from("catering_options")
      .update({ display_order: index, updated_at: new Date().toISOString() })
      .eq("id", input.orderedIds[index])
      .eq("property_id", input.propertyId);
    if (error) return { ok: false, error: `Couldn't reorder catering: ${error.message}` };
  }
  return { ok: true };
}

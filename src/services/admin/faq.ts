import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Admin CRUD for property_faq_entries — a flat, freely add/edit/remove/
// reorder list of (category, question, answer) rows the client owns
// entirely (no hardcoded fallback, unlike property_page_content).

export interface AdminFaqEntry {
  id: string;
  category: string;
  categoryOrder: number;
  question: string;
  answer: string;
  sortOrder: number;
}

export async function getAdminFaqEntries(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<AdminFaqEntry[]> {
  const { data, error } = await supabase
    .from("property_faq_entries")
    .select("id, category, category_order, question, answer, sort_order")
    .eq("property_id", propertyId)
    .order("category_order", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Admin FAQ entries failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    categoryOrder: row.category_order,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
  }));
}

export const SaveFaqEntrySchema = z.object({
  id: z.string().uuid().optional(),
  propertyId: z.string().uuid(),
  category: z.string().trim().min(1, "Category is required.").max(120),
  categoryOrder: z.number().int().min(0).max(999),
  question: z.string().trim().min(1, "Question is required.").max(500),
  answer: z.string().trim().min(1, "Answer is required.").max(4000),
  sortOrder: z.number().int().min(0).max(999),
});

export type SaveFaqEntryInput = z.infer<typeof SaveFaqEntrySchema>;
export type SaveFaqEntryRawInput = z.input<typeof SaveFaqEntrySchema>;

export type SaveFaqEntryResult = { ok: true } | { ok: false; error: string };

export async function saveFaqEntry(
  supabase: SupabaseClient,
  input: SaveFaqEntryInput,
): Promise<SaveFaqEntryResult> {
  const row = {
    property_id: input.propertyId,
    category: input.category,
    category_order: input.categoryOrder,
    question: input.question,
    answer: input.answer,
    sort_order: input.sortOrder,
  };

  const { error } = input.id
    ? await supabase.from("property_faq_entries").update(row).eq("id", input.id)
    : await supabase.from("property_faq_entries").insert(row);

  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  return { ok: true };
}

export type DeleteFaqEntryResult = { ok: true } | { ok: false; error: string };

export async function deleteFaqEntry(
  supabase: SupabaseClient,
  id: string,
): Promise<DeleteFaqEntryResult> {
  const { error } = await supabase.from("property_faq_entries").delete().eq("id", id);
  if (error) return { ok: false, error: `Couldn't delete: ${error.message}` };
  return { ok: true };
}

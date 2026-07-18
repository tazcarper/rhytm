import type { SupabaseClient } from "@supabase/supabase-js";

// Public read for the FAQ page (property_faq_entries — see migration
// 20260719130000). Unlike property_page_content, this table is fully
// authoritative once seeded: there's no hardcoded fallback, an admin
// genuinely owns the whole FAQ surface (add/edit/remove questions freely).

export interface PublicFaqEntry {
  question: string;
  answer: string;
}

export interface PublicFaqCategory {
  id: string;
  title: string;
  entries: PublicFaqEntry[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getPublicFaqCategories(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PublicFaqCategory[]> {
  const { data, error } = await supabase
    .from("property_faq_entries")
    .select("category, category_order, question, answer, sort_order")
    .eq("property_id", propertyId)
    .order("category_order", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Public FAQ failed: ${error.message}`);

  const byCategory = new Map<string, PublicFaqCategory>();
  for (const row of data ?? []) {
    const existing = byCategory.get(row.category);
    if (existing) {
      existing.entries.push({ question: row.question, answer: row.answer });
    } else {
      byCategory.set(row.category, {
        id: slugify(row.category),
        title: row.category,
        entries: [{ question: row.question, answer: row.answer }],
      });
    }
  }
  return [...byCategory.values()];
}

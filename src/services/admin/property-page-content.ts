import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyPageKey, PropertyContentItem } from "@/src/services/public/property-page-content";

// Admin read/write for property_page_content. One row per
// (property, page, section) — a section is either single-block
// (heading/body/image/cta) or items-based (a repeating array of cards),
// decided by the section's config (src/constants/admin/property-page-sections.ts),
// never both meaningfully populated at once. Upserted on save via the
// table's own (property_id, page_key, section_key) unique constraint.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const ContentItemSchema = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  bullets: z.array(z.string().trim().max(200)).max(20).optional(),
  linkHref: z.string().trim().max(2000).optional(),
});

export const SavePropertyPageSectionSchema = z.object({
  propertyId: z.string().uuid(),
  pageKey: z.enum([
    "home",
    "membership",
    "education",
    "private_events",
    "events",
    "adventures",
    "club_life",
    "basics",
    "layout",
  ]),
  sectionKey: z.string().trim().min(1).max(60),
  heading: optionalText(200),
  body: optionalText(4000),
  imageUrl: optionalText(2000),
  ctaLabel: optionalText(80),
  ctaHref: optionalText(2000),
  items: z.array(ContentItemSchema).max(20).optional().nullable(),
});

export type SavePropertyPageSectionInput = z.infer<typeof SavePropertyPageSectionSchema>;
export type SavePropertyPageSectionRawInput = z.input<typeof SavePropertyPageSectionSchema>;

export type SavePropertyPageSectionResult = { ok: true } | { ok: false; error: string };

export interface AdminPropertyPageSection {
  pageKey: PropertyPageKey;
  sectionKey: string;
  heading: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  items: PropertyContentItem[] | null;
}

export async function getPropertyPageContentSection(
  supabase: SupabaseClient,
  propertyId: string,
  pageKey: PropertyPageKey,
  sectionKey: string,
): Promise<AdminPropertyPageSection | null> {
  const { data, error } = await supabase
    .from("property_page_content")
    .select("page_key, section_key, heading, body, image_url, cta_label, cta_href, items")
    .eq("property_id", propertyId)
    .eq("page_key", pageKey)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (error) throw new Error(`Couldn't load page content: ${error.message}`);
  if (!data) return null;

  return {
    pageKey: data.page_key,
    sectionKey: data.section_key,
    heading: data.heading,
    body: data.body,
    imageUrl: data.image_url,
    ctaLabel: data.cta_label,
    ctaHref: data.cta_href,
    items: (data.items as PropertyContentItem[] | null) ?? null,
  };
}

export async function savePropertyPageSection(
  supabase: SupabaseClient,
  input: SavePropertyPageSectionInput,
): Promise<SavePropertyPageSectionResult> {
  const { error } = await supabase
    .from("property_page_content")
    .upsert(
      {
        property_id: input.propertyId,
        page_key: input.pageKey,
        section_key: input.sectionKey,
        heading: input.heading,
        body: input.body,
        image_url: input.imageUrl,
        cta_label: input.ctaLabel,
        cta_href: input.ctaHref,
        items: input.items ?? null,
      },
      { onConflict: "property_id,page_key,section_key" },
    );

  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  return { ok: true };
}

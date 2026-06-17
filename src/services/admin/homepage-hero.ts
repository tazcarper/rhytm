import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// A free-text field that is optional and stored as NULL when blank.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

// A link target: either an in-app path ("/book") or an absolute URL.
const optionalHref = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || value.startsWith("/") || /^https?:\/\//.test(value),
    "Link must start with / or http(s)://",
  );

export const UpdateHomepageHeroInputSchema = z.object({
  eyebrow: optionalText(80),
  title: z.string().trim().min(1, "Title is required").max(200),
  lead: optionalText(600),
  imageUrl: optionalHref,
  primaryCtaLabel: optionalText(60),
  primaryCtaHref: optionalHref,
  secondaryCtaLabel: optionalText(60),
  secondaryCtaHref: optionalHref,
});

export type UpdateHomepageHeroInput = z.infer<
  typeof UpdateHomepageHeroInputSchema
>;
export type UpdateHomepageHeroRawInput = z.input<
  typeof UpdateHomepageHeroInputSchema
>;

export interface UpdateHomepageHeroResult {
  ok: boolean;
  error?: string;
}

// Persists the singleton hero row. Pure write — validation happens at the
// action boundary; this just maps the domain input to columns and updates
// the one row (id = 1).
export async function updateHomepageHero(
  supabase: SupabaseClient,
  input: UpdateHomepageHeroInput,
): Promise<UpdateHomepageHeroResult> {
  const { error } = await supabase
    .from("homepage_hero")
    .update({
      eyebrow: input.eyebrow,
      title: input.title,
      lead: input.lead,
      image_url: input.imageUrl,
      primary_cta_label: input.primaryCtaLabel,
      primary_cta_href: input.primaryCtaHref,
      secondary_cta_label: input.secondaryCtaLabel,
      secondary_cta_href: input.secondaryCtaHref,
    })
    .eq("id", 1);

  if (error) {
    return { ok: false, error: `Couldn't save the hero: ${error.message}` };
  }

  return { ok: true };
}

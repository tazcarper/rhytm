import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromotionPlacement } from "@/src/services/public/promotions";

// Admin CRUD for promotions (see the promotions migration). Pure data layer:
// takes the caller's RLS-scoped client (admin/super_admin write is enforced
// by policy), validates at the action boundary, returns clean domain types.

const PLACEMENTS = [
  "homepage_band",
  "property_page",
  "adventures_page",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const optionalHref = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine(
    (value) =>
      value === null || value.startsWith("/") || /^https?:\/\//.test(value),
    "Link must start with / or http(s)://",
  );

// A datetime-local string ("2026-08-01T09:00") or empty → null. Stored as a
// timestamptz; the browser sends local wall-clock, which Postgres reads in
// the connection timezone.
const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const SavePromotionSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Title is required").max(200),
    eyebrow: optionalText(80),
    body: optionalText(4000),
    imageUrl: optionalHref,
    ctaLabel: optionalText(60),
    ctaHref: optionalHref,
    placements: z.array(z.enum(PLACEMENTS)).max(3),
    propertyIds: z.array(z.string().uuid()).max(20),
    status: z.enum(["draft", "published", "archived"]),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    sortOrder: z.number().int().min(0).max(9999),
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.endsAt) >= new Date(value.startsAt),
    { message: "End must be on or after the start", path: ["endsAt"] },
  );

export type SavePromotionInput = z.infer<typeof SavePromotionSchema>;
export type SavePromotionRawInput = z.input<typeof SavePromotionSchema>;

export type SavePromotionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// One row in the admin list.
export interface AdminPromotionListRow {
  id: string;
  title: string;
  placements: PromotionPlacement[];
  status: "draft" | "published" | "archived";
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  /** Names of targeted clubs; empty = all clubs. */
  propertyNames: string[];
}

// The editable shape for one promotion (the editor form binds to this).
export interface AdminPromotionDetail {
  id: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  placements: PromotionPlacement[];
  status: "draft" | "published" | "archived";
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  propertyIds: string[];
}

type ListRow = {
  id: string;
  title: string;
  placements: string[];
  status: "draft" | "published" | "archived";
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  promotion_properties: { properties: { name: string } | null }[];
};

type DetailRow = {
  id: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  placements: string[];
  status: "draft" | "published" | "archived";
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  promotion_properties: { property_id: string }[];
};

export async function getPromotionsList(
  supabase: SupabaseClient,
): Promise<AdminPromotionListRow[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, title, placements, status, starts_at, ends_at, sort_order, promotion_properties ( properties ( name ) )",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Couldn't load promotions: ${error.message}`);

  return ((data ?? []) as unknown as ListRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    placements: row.placements as PromotionPlacement[],
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    propertyNames: row.promotion_properties
      .map((link) => link.properties?.name)
      .filter((name): name is string => Boolean(name)),
  }));
}

export async function getPromotion(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminPromotionDetail | null> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, title, eyebrow, body, image_url, cta_label, cta_href, placements, status, starts_at, ends_at, sort_order, promotion_properties ( property_id )",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Couldn't load promotion: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  return {
    id: row.id,
    title: row.title,
    eyebrow: row.eyebrow,
    body: row.body,
    imageUrl: row.image_url,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    placements: row.placements as PromotionPlacement[],
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    propertyIds: row.promotion_properties.map((link) => link.property_id),
  };
}

// Insert or update a promotion plus its property targeting. Targeting is
// stored as a set of join rows; we replace them wholesale on each save
// (delete-then-insert) since the editor always submits the full desired set.
// Not a single transaction across PostgREST calls, but admin writes are
// low-concurrency and the row write lands first — a partial failure leaves
// the promo saved with stale targeting, which the next save corrects.
export async function savePromotion(
  supabase: SupabaseClient,
  input: SavePromotionInput,
): Promise<SavePromotionResult> {
  const columns = {
    title: input.title,
    eyebrow: input.eyebrow,
    body: input.body,
    image_url: input.imageUrl,
    cta_label: input.ctaLabel,
    cta_href: input.ctaHref,
    placements: input.placements,
    status: input.status,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    sort_order: input.sortOrder,
  };

  let promotionId: string;

  if (input.id) {
    const { error } = await supabase
      .from("promotions")
      .update(columns)
      .eq("id", input.id);
    if (error) {
      return { ok: false, error: `Couldn't save the promotion: ${error.message}` };
    }
    promotionId = input.id;
  } else {
    const { data, error } = await supabase
      .from("promotions")
      .insert(columns)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: `Couldn't create the promotion: ${error?.message ?? "no id returned"}`,
      };
    }
    promotionId = (data as { id: string }).id;
  }

  // Replace targeting rows.
  const { error: clearError } = await supabase
    .from("promotion_properties")
    .delete()
    .eq("promotion_id", promotionId);
  if (clearError) {
    return { ok: false, error: `Couldn't update targeting: ${clearError.message}` };
  }

  if (input.propertyIds.length > 0) {
    const { error: linkError } = await supabase
      .from("promotion_properties")
      .insert(
        input.propertyIds.map((propertyId) => ({
          promotion_id: promotionId,
          property_id: propertyId,
        })),
      );
    if (linkError) {
      return { ok: false, error: `Couldn't set targeting: ${linkError.message}` };
    }
  }

  return { ok: true, id: promotionId };
}

export async function deletePromotion(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  // promotion_properties rows cascade on delete.
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

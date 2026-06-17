import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// =============================================================================
// Bid Content Library — admin reads + writes for the FAQ / gear template CRUD.
//
// Templates live in four tables (two parallel kinds, each with a scope table):
//   bid_faq_templates  + bid_faq_template_scopes
//   bid_gear_templates + bid_gear_template_scopes
//
// A template's scope rows are flattened into one TemplateScopes object for the
// editor (one bool + three id/value lists), and re-expanded back into rows on
// save. The resolve_bid_content() SQL function — NOT this module — is what
// copies matching templates onto a bid at creation; this is purely the
// management surface. Reuses the catalog service's MutationResult shape.
// =============================================================================

export type TemplateKind = "faq" | "gear";

const BOOKING_TYPES = [
  "plan_a_visit",
  "private_lesson",
  "host_an_occasion",
] as const;

// =============================================================================
// Types
// =============================================================================

export interface TemplateScopes {
  global: boolean;
  propertyIds: string[];
  serviceIds: string[];
  bookingTypes: BookingType[];
}

export interface BidFaqTemplate {
  id: string;
  question: string;
  answer: string;
  dedupeKey: string;
  displayOrder: number;
  isActive: boolean;
  scopes: TemplateScopes;
}

export interface BidGearTemplate {
  id: string;
  name: string;
  description: string | null;
  dedupeKey: string;
  displayOrder: number;
  isActive: boolean;
  scopes: TemplateScopes;
}

// Vocabulary the editor's scope pickers need.
export interface ScopeVocabProperty {
  id: string;
  name: string;
}
export interface ScopeVocabService {
  id: string;
  name: string;
  propertyId: string;
}

export interface BidContentLibrary {
  faq: BidFaqTemplate[];
  gear: BidGearTemplate[];
  properties: ScopeVocabProperty[];
  services: ScopeVocabService[];
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

// =============================================================================
// Row → domain mappers
// =============================================================================

type ScopeRow = {
  scope_type: "global" | "property" | "service" | "booking_type";
  property_id: string | null;
  service_id: string | null;
  booking_type: BookingType | null;
};

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  dedupe_key: string;
  display_order: number;
  is_active: boolean;
  bid_faq_template_scopes: ScopeRow[];
};

type GearRow = {
  id: string;
  name: string;
  description: string | null;
  dedupe_key: string;
  display_order: number;
  is_active: boolean;
  bid_gear_template_scopes: ScopeRow[];
};

function rowsToScopes(rows: ScopeRow[]): TemplateScopes {
  return {
    global: rows.some((row) => row.scope_type === "global"),
    propertyIds: rows
      .filter((row) => row.scope_type === "property" && row.property_id)
      .map((row) => row.property_id as string),
    serviceIds: rows
      .filter((row) => row.scope_type === "service" && row.service_id)
      .map((row) => row.service_id as string),
    bookingTypes: rows
      .filter((row) => row.scope_type === "booking_type" && row.booking_type)
      .map((row) => row.booking_type as BookingType),
  };
}

function rowToFaq(row: FaqRow): BidFaqTemplate {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    dedupeKey: row.dedupe_key,
    displayOrder: row.display_order,
    isActive: row.is_active,
    scopes: rowsToScopes(row.bid_faq_template_scopes ?? []),
  };
}

function rowToGear(row: GearRow): BidGearTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dedupeKey: row.dedupe_key,
    displayOrder: row.display_order,
    isActive: row.is_active,
    scopes: rowsToScopes(row.bid_gear_template_scopes ?? []),
  };
}

// Expands the flattened scope object back into the rows the scope table stores.
function scopesToRows(
  templateId: string,
  scopes: TemplateScopes,
): Array<{
  template_id: string;
  scope_type: string;
  property_id?: string;
  service_id?: string;
  booking_type?: BookingType;
}> {
  const rows: Array<{
    template_id: string;
    scope_type: string;
    property_id?: string;
    service_id?: string;
    booking_type?: BookingType;
  }> = [];
  if (scopes.global) {
    rows.push({ template_id: templateId, scope_type: "global" });
  }
  for (const propertyId of new Set(scopes.propertyIds)) {
    rows.push({ template_id: templateId, scope_type: "property", property_id: propertyId });
  }
  for (const serviceId of new Set(scopes.serviceIds)) {
    rows.push({ template_id: templateId, scope_type: "service", service_id: serviceId });
  }
  for (const bookingType of new Set(scopes.bookingTypes)) {
    rows.push({ template_id: templateId, scope_type: "booking_type", booking_type: bookingType });
  }
  return rows;
}

// =============================================================================
// Reads
// =============================================================================

const FAQ_COLUMNS =
  "id, question, answer, dedupe_key, display_order, is_active, " +
  "bid_faq_template_scopes ( scope_type, property_id, service_id, booking_type )";
const GEAR_COLUMNS =
  "id, name, description, dedupe_key, display_order, is_active, " +
  "bid_gear_template_scopes ( scope_type, property_id, service_id, booking_type )";

export async function getBidContentLibrary(
  supabase: SupabaseClient,
): Promise<BidContentLibrary> {
  const [faqResult, gearResult, propertiesResult, servicesResult] =
    await Promise.all([
      supabase
        .from("bid_faq_templates")
        .select(FAQ_COLUMNS)
        .order("display_order")
        .order("dedupe_key"),
      supabase
        .from("bid_gear_templates")
        .select(GEAR_COLUMNS)
        .order("display_order")
        .order("dedupe_key"),
      supabase.from("properties").select("id, name").order("name"),
      supabase
        .from("services")
        .select("id, name, property_id")
        .order("property_id")
        .order("name"),
    ]);

  if (faqResult.error) {
    throw new Error(`FAQ templates read failed: ${faqResult.error.message}`);
  }
  if (gearResult.error) {
    throw new Error(`Gear templates read failed: ${gearResult.error.message}`);
  }
  if (propertiesResult.error) {
    throw new Error(`Properties read failed: ${propertiesResult.error.message}`);
  }
  if (servicesResult.error) {
    throw new Error(`Services read failed: ${servicesResult.error.message}`);
  }

  return {
    faq: ((faqResult.data ?? []) as unknown as FaqRow[]).map(rowToFaq),
    gear: ((gearResult.data ?? []) as unknown as GearRow[]).map(rowToGear),
    properties: (propertiesResult.data ?? []) as ScopeVocabProperty[],
    services: ((servicesResult.data ?? []) as Array<{
      id: string;
      name: string;
      property_id: string;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      propertyId: row.property_id,
    })),
  };
}

// =============================================================================
// Zod schemas
// =============================================================================

const uuidSchema = z.string().uuid();
// A template's own primary key may be a seeded placeholder id (e.g.
// 'f0000000-0000-0000-0000-000000000001'). Postgres accepts these in a uuid
// column, but they're not valid RFC 9562 UUIDs (zero version/variant nibbles),
// so the strict z.uuid() rejects them and editing a seeded item fails with
// "id: Invalid UUID". z.guid() validates the 8-4-4-4-12 shape without checking
// the version bits — correct for matching an existing row's id.
const idSchema = z.guid();
const dedupeKeySchema = z
  .string()
  .trim()
  .min(1, "Dedupe key is required")
  .max(100, "Must be 100 characters or fewer");
const displayOrderSchema = z.coerce.number().int().min(0).max(9999).default(0);

const scopesSchema = z
  .object({
    global: z.boolean(),
    propertyIds: z.array(uuidSchema).max(50),
    serviceIds: z.array(uuidSchema).max(500),
    bookingTypes: z.array(z.enum(BOOKING_TYPES)).max(3),
  })
  .refine(
    (scopes) =>
      scopes.global ||
      scopes.propertyIds.length > 0 ||
      scopes.serviceIds.length > 0 ||
      scopes.bookingTypes.length > 0,
    {
      message:
        "Pick at least one scope — Global, a property, a discipline, or a booking type. A template with no scope never appears on any bid.",
    },
  );

export const CreateFaqTemplateInputSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
  dedupeKey: dedupeKeySchema,
  displayOrder: displayOrderSchema,
  scopes: scopesSchema,
});
export type CreateFaqTemplateInput = z.infer<typeof CreateFaqTemplateInputSchema>;
export type CreateFaqTemplateRawInput = z.input<typeof CreateFaqTemplateInputSchema>;

export const UpdateFaqTemplateInputSchema = CreateFaqTemplateInputSchema.extend({
  id: idSchema,
  isActive: z.boolean(),
});
export type UpdateFaqTemplateInput = z.infer<typeof UpdateFaqTemplateInputSchema>;
export type UpdateFaqTemplateRawInput = z.input<typeof UpdateFaqTemplateInputSchema>;

export const CreateGearTemplateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine(
      (value) => value === null || value.length <= 500,
      "Must be 500 characters or fewer",
    ),
  dedupeKey: dedupeKeySchema,
  displayOrder: displayOrderSchema,
  scopes: scopesSchema,
});
export type CreateGearTemplateInput = z.infer<typeof CreateGearTemplateInputSchema>;
export type CreateGearTemplateRawInput = z.input<typeof CreateGearTemplateInputSchema>;

export const UpdateGearTemplateInputSchema = CreateGearTemplateInputSchema.extend({
  id: idSchema,
  isActive: z.boolean(),
});
export type UpdateGearTemplateInput = z.infer<typeof UpdateGearTemplateInputSchema>;
export type UpdateGearTemplateRawInput = z.input<typeof UpdateGearTemplateInputSchema>;

// =============================================================================
// Writes
//
// Scopes are replaced wholesale on update (delete-all + insert) — these are
// live config rows with no historical-snapshot meaning, so a clean replace is
// simpler and correct. ON DELETE CASCADE removes scope rows when the parent
// template is deleted, so deleteTemplate is a single delete.
// =============================================================================

async function replaceFaqScopes(
  supabase: SupabaseClient,
  templateId: string,
  scopes: TemplateScopes,
): Promise<string | null> {
  const remove = await supabase
    .from("bid_faq_template_scopes")
    .delete()
    .eq("template_id", templateId);
  if (remove.error) return remove.error.message;

  const rows = scopesToRows(templateId, scopes);
  if (rows.length > 0) {
    const insert = await supabase.from("bid_faq_template_scopes").insert(rows);
    if (insert.error) return insert.error.message;
  }
  return null;
}

async function replaceGearScopes(
  supabase: SupabaseClient,
  templateId: string,
  scopes: TemplateScopes,
): Promise<string | null> {
  const remove = await supabase
    .from("bid_gear_template_scopes")
    .delete()
    .eq("template_id", templateId);
  if (remove.error) return remove.error.message;

  const rows = scopesToRows(templateId, scopes);
  if (rows.length > 0) {
    const insert = await supabase.from("bid_gear_template_scopes").insert(rows);
    if (insert.error) return insert.error.message;
  }
  return null;
}

export async function createFaqTemplate(
  supabase: SupabaseClient,
  input: CreateFaqTemplateInput,
): Promise<MutationResult> {
  const insert = await supabase
    .from("bid_faq_templates")
    .insert({
      question: input.question,
      answer: input.answer,
      dedupe_key: input.dedupeKey,
      display_order: input.displayOrder,
    })
    .select("id")
    .single();
  if (insert.error) {
    return { ok: false, error: `Couldn't create FAQ template: ${insert.error.message}` };
  }
  const scopeError = await replaceFaqScopes(
    supabase,
    (insert.data as { id: string }).id,
    input.scopes,
  );
  if (scopeError) {
    return { ok: false, error: `FAQ template saved but scopes failed: ${scopeError}` };
  }
  return { ok: true };
}

export async function updateFaqTemplate(
  supabase: SupabaseClient,
  input: UpdateFaqTemplateInput,
): Promise<MutationResult> {
  const update = await supabase
    .from("bid_faq_templates")
    .update({
      question: input.question,
      answer: input.answer,
      dedupe_key: input.dedupeKey,
      display_order: input.displayOrder,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (update.error) {
    return { ok: false, error: `Couldn't save FAQ template: ${update.error.message}` };
  }
  const scopeError = await replaceFaqScopes(supabase, input.id, input.scopes);
  if (scopeError) {
    return { ok: false, error: `FAQ template saved but scopes failed: ${scopeError}` };
  }
  return { ok: true };
}

export async function deleteFaqTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<MutationResult> {
  const { error } = await supabase
    .from("bid_faq_templates")
    .delete()
    .eq("id", templateId);
  if (error) {
    return { ok: false, error: `Couldn't delete FAQ template: ${error.message}` };
  }
  return { ok: true };
}

export async function createGearTemplate(
  supabase: SupabaseClient,
  input: CreateGearTemplateInput,
): Promise<MutationResult> {
  const insert = await supabase
    .from("bid_gear_templates")
    .insert({
      name: input.name,
      description: input.description,
      dedupe_key: input.dedupeKey,
      display_order: input.displayOrder,
    })
    .select("id")
    .single();
  if (insert.error) {
    return { ok: false, error: `Couldn't create gear template: ${insert.error.message}` };
  }
  const scopeError = await replaceGearScopes(
    supabase,
    (insert.data as { id: string }).id,
    input.scopes,
  );
  if (scopeError) {
    return { ok: false, error: `Gear template saved but scopes failed: ${scopeError}` };
  }
  return { ok: true };
}

export async function updateGearTemplate(
  supabase: SupabaseClient,
  input: UpdateGearTemplateInput,
): Promise<MutationResult> {
  const update = await supabase
    .from("bid_gear_templates")
    .update({
      name: input.name,
      description: input.description,
      dedupe_key: input.dedupeKey,
      display_order: input.displayOrder,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (update.error) {
    return { ok: false, error: `Couldn't save gear template: ${update.error.message}` };
  }
  const scopeError = await replaceGearScopes(supabase, input.id, input.scopes);
  if (scopeError) {
    return { ok: false, error: `Gear template saved but scopes failed: ${scopeError}` };
  }
  return { ok: true };
}

export async function deleteGearTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<MutationResult> {
  const { error } = await supabase
    .from("bid_gear_templates")
    .delete()
    .eq("id", templateId);
  if (error) {
    return { ok: false, error: `Couldn't delete gear template: ${error.message}` };
  }
  return { ok: true };
}

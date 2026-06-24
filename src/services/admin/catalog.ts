import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminBookingStatus } from "./bookings";
import type { EstimatePricingKind } from "@/src/services/public/estimate-catalog";

// =============================================================================
// Types
// =============================================================================

export interface AdminCatalogService {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  imageUrl: string | null;
  // Estimate catalog fields (migration 20260624144448). An experience row
  // fully describes its own pricing strategy. Visibility on the estimate is
  // just is_active — there is no separate show-on-estimate flag.
  pricingKind: EstimatePricingKind;
  membersOnly: boolean;
  lessonLadder: number[] | null;
  lessonCohortSize: number;
  classPriceMember: number | null;
  classPricePublic: number | null;
}

export interface AdminCatalogAddOn {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  displayOrder: number;
  imageUrl: string | null;
  includedDetail: string | null;
  maxQuantity: number;
  // Members get the 20% retail discount on this add-on in the estimate
  // (migration 20260624213201). Visibility is just is_active.
  estimateMemberDiscount: boolean;
}

export interface AdminCatalogLink {
  serviceId: string;
  addOnId: string;
}

export interface PropertyCatalog {
  services: AdminCatalogService[];
  addOns: AdminCatalogAddOn[];
  links: AdminCatalogLink[];
}

const ACTIVE_BOOKING_STATUSES: ReadonlyArray<AdminBookingStatus> = [
  "pending_review",
  "awaiting_guest",
  "signed",
  "deposit_paid",
];

export interface ActiveBookingRef {
  bookingId: string;
  bidId: string | null;
  startTime: string;
  status: AdminBookingStatus;
  guestName: string;
  guestEmail: string;
  propertyTimezone: string;
}

// =============================================================================
// Row → domain mappers
// =============================================================================

type ServiceRow = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  image_url: string | null;
  pricing_kind: EstimatePricingKind;
  members_only: boolean;
  lesson_ladder: Array<string | number> | null;
  lesson_cohort_size: number;
  class_price_member: string | number | null;
  class_price_public: string | number | null;
};

type AddOnRow = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  price: string | number;
  is_active: boolean;
  display_order: number;
  image_url: string | null;
  included_detail: string | null;
  max_quantity: number;
  estimate_member_discount: boolean;
};

type LinkRow = { service_id: string; add_on_id: string };

function parseNullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

function rowToService(row: ServiceRow): AdminCatalogService {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    displayOrder: row.display_order,
    imageUrl: row.image_url,
    pricingKind: row.pricing_kind,
    membersOnly: row.members_only,
    lessonLadder:
      row.lesson_ladder === null
        ? null
        : row.lesson_ladder.map((v) => (typeof v === "string" ? parseFloat(v) : v)),
    lessonCohortSize: row.lesson_cohort_size,
    classPriceMember: parseNullableNumber(row.class_price_member),
    classPricePublic: parseNullableNumber(row.class_price_public),
  };
}

function rowToAddOn(row: AddOnRow): AdminCatalogAddOn {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    description: row.description,
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    isActive: row.is_active,
    displayOrder: row.display_order,
    imageUrl: row.image_url,
    includedDetail: row.included_detail,
    maxQuantity: row.max_quantity,
    estimateMemberDiscount: row.estimate_member_discount,
  };
}

// =============================================================================
// Reads
// =============================================================================

const SERVICE_COLUMNS =
  "id, property_id, name, description, is_active, display_order, image_url, pricing_kind, members_only, lesson_ladder, lesson_cohort_size, class_price_member, class_price_public";
const ADDON_COLUMNS =
  "id, property_id, name, description, price, is_active, display_order, image_url, included_detail, max_quantity, estimate_member_discount";

export async function getPropertyCatalog(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PropertyCatalog> {
  const [servicesResult, addOnsResult] = await Promise.all([
    supabase
      .from("services")
      .select(SERVICE_COLUMNS)
      .eq("property_id", propertyId)
      .order("display_order")
      .order("name"),
    supabase
      .from("add_ons")
      .select(ADDON_COLUMNS)
      .eq("property_id", propertyId)
      .order("display_order")
      .order("name"),
  ]);

  if (servicesResult.error) {
    throw new Error(`Catalog services read failed: ${servicesResult.error.message}`);
  }
  if (addOnsResult.error) {
    throw new Error(`Catalog add-ons read failed: ${addOnsResult.error.message}`);
  }

  const services = ((servicesResult.data ?? []) as ServiceRow[]).map(rowToService);
  const addOns = ((addOnsResult.data ?? []) as AddOnRow[]).map(rowToAddOn);

  const serviceIds = services.map((s) => s.id);
  let links: AdminCatalogLink[] = [];
  if (serviceIds.length > 0) {
    const linksResult = await supabase
      .from("service_add_ons")
      .select("service_id, add_on_id")
      .in("service_id", serviceIds);
    if (linksResult.error) {
      throw new Error(`Catalog links read failed: ${linksResult.error.message}`);
    }
    links = ((linksResult.data ?? []) as LinkRow[]).map((r) => ({
      serviceId: r.service_id,
      addOnId: r.add_on_id,
    }));
  }

  return { services, addOns, links };
}

export async function getCatalogService(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<AdminCatalogService | null> {
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("id", serviceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Catalog service read failed: ${error.message}`);
  }
  return data ? rowToService(data as ServiceRow) : null;
}

export async function getCatalogAddOn(
  supabase: SupabaseClient,
  addOnId: string,
): Promise<AdminCatalogAddOn | null> {
  const { data, error } = await supabase
    .from("add_ons")
    .select(ADDON_COLUMNS)
    .eq("id", addOnId)
    .maybeSingle();
  if (error) {
    throw new Error(`Catalog add-on read failed: ${error.message}`);
  }
  return data ? rowToAddOn(data as AddOnRow) : null;
}

// =============================================================================
// Active-booking reference checks (for deactivate confirm modal)
// =============================================================================

type BookingRefRow = {
  booking_id: string;
  bookings: {
    id: string;
    start_time: string;
    status: AdminBookingStatus;
    guest_name: string;
    guest_email: string;
    properties: { timezone: string };
    bids: Array<{ id: string }> | { id: string } | null;
  };
};

function rowToBookingRef(row: BookingRefRow): ActiveBookingRef {
  const bid = Array.isArray(row.bookings.bids)
    ? row.bookings.bids[0]
    : row.bookings.bids;
  return {
    bookingId: row.bookings.id,
    bidId: bid?.id ?? null,
    startTime: row.bookings.start_time,
    status: row.bookings.status,
    guestName: row.bookings.guest_name,
    guestEmail: row.bookings.guest_email,
    propertyTimezone: row.bookings.properties.timezone,
  };
}

// Used by the hard-delete confirm. RESTRICT FK on booking_disciplines.service_id
// means ANY booking that ever referenced this service blocks delete — not
// just active ones.
export async function listAllBookingsForService(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<ActiveBookingRef[]> {
  const { data, error } = await supabase
    .from("booking_disciplines")
    .select(
      `
      booking_id,
      bookings!inner (
        id, start_time, status, guest_name, guest_email,
        properties!inner ( timezone ),
        bids ( id )
      )
    `,
    )
    .eq("service_id", serviceId)
    .order("start_time", {
      ascending: false,
      referencedTable: "bookings",
    });

  if (error) {
    throw new Error(`All bookings for service read failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as BookingRefRow[]).map(rowToBookingRef);
}

export async function deleteCatalogService(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This service is referenced by one or more bookings. Deactivate it instead — historical bookings keep their snapshot of the service.",
      };
    }
    return { ok: false, error: `Couldn't delete service: ${error.message}` };
  }
  return { ok: true };
}

export async function listActiveBookingsForService(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<ActiveBookingRef[]> {
  const { data, error } = await supabase
    .from("booking_disciplines")
    .select(
      `
      booking_id,
      bookings!inner (
        id, start_time, status, guest_name, guest_email,
        properties!inner ( timezone ),
        bids ( id )
      )
    `,
    )
    .eq("service_id", serviceId)
    .in("bookings.status", ACTIVE_BOOKING_STATUSES as unknown as string[])
    .order("start_time", {
      ascending: true,
      referencedTable: "bookings",
    });

  if (error) {
    throw new Error(`Active bookings for service read failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as BookingRefRow[]).map(rowToBookingRef);
}

export async function listActiveBookingsForAddOn(
  supabase: SupabaseClient,
  addOnId: string,
): Promise<ActiveBookingRef[]> {
  const { data, error } = await supabase
    .from("booking_add_ons")
    .select(
      `
      booking_id,
      bookings!inner (
        id, start_time, status, guest_name, guest_email,
        properties!inner ( timezone ),
        bids ( id )
      )
    `,
    )
    .eq("add_on_id", addOnId)
    .in("bookings.status", ACTIVE_BOOKING_STATUSES as unknown as string[])
    .order("start_time", {
      ascending: true,
      referencedTable: "bookings",
    });

  if (error) {
    throw new Error(`Active bookings for add-on read failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as BookingRefRow[]).map(rowToBookingRef);
}

// Used by the hard-delete confirm. RESTRICT FK on booking_add_ons.add_on_id
// means ANY booking that ever referenced this add-on blocks delete — not just
// active ones. The modal needs the full historical list to communicate why.
export async function listAllBookingsForAddOn(
  supabase: SupabaseClient,
  addOnId: string,
): Promise<ActiveBookingRef[]> {
  const { data, error } = await supabase
    .from("booking_add_ons")
    .select(
      `
      booking_id,
      bookings!inner (
        id, start_time, status, guest_name, guest_email,
        properties!inner ( timezone ),
        bids ( id )
      )
    `,
    )
    .eq("add_on_id", addOnId)
    .order("start_time", {
      ascending: false,
      referencedTable: "bookings",
    });

  if (error) {
    throw new Error(`All bookings for add-on read failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as BookingRefRow[]).map(rowToBookingRef);
}

export async function deleteCatalogAddOn(
  supabase: SupabaseClient,
  addOnId: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("add_ons").delete().eq("id", addOnId);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This add-on is referenced by one or more bookings. Deactivate it instead — historical bookings keep their snapshot of the name and price.",
      };
    }
    return { ok: false, error: `Couldn't delete add-on: ${error.message}` };
  }
  return { ok: true };
}

// =============================================================================
// Zod schemas
// =============================================================================

const nameSchema = z.string().trim().min(1, "Name is required").max(200);
const descriptionSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((v) => v === null || v.length <= 2000, "Must be 2000 characters or fewer");

const priceSchema = z.coerce
  .number()
  .min(0, "Must be ≥ 0")
  .max(100000, "Must be ≤ 100,000");

// Short "what's included" line for the add-on detail pop-up. Same null-coalescing
// shape as descriptionSchema, capped tighter (it's a one-liner under the price).
const includedDetailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((v) => v === null || v.length <= 200, "Must be 200 characters or fewer");

// Public URL of the detail photo (Blob upload result or a pasted link). Empty
// → null. Must be an http(s) URL when present so the funnel never renders a
// broken/file-scheme <img>.
const imageUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (v) => v === null || (/^https?:\/\//.test(v) && v.length <= 2048),
    "Must be a URL starting with http:// or https://",
  );

// Per-add-on quantity ceiling. 1 = single add/remove; > 1 = the funnel shows a
// stepper capped here. Matches the add_ons.max_quantity CHECK (1–99).
const maxQuantitySchema = z.coerce.number().int().min(1).max(99);

const displayOrderSchema = z.coerce.number().int().min(0).max(9999);
const uuidSchema = z.string().uuid();

const newAddOnDraftSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  price: priceSchema,
});
export type NewAddOnDraft = z.infer<typeof newAddOnDraftSchema>;

export const CreateServiceInputSchema = z.object({
  propertyId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  displayOrder: displayOrderSchema.default(0),
});
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type CreateServiceRawInput = z.input<typeof CreateServiceInputSchema>;

// Estimate experience pricing fields. Optional on update so the deactivate
// paths (which only flip is_active) can omit them and preserve current values;
// the experience editor sends the full set.
const pricingKindSchema = z.enum([
  "guest_fee_tier",
  "lesson_ladder",
  "class_per_person",
  "quote",
]);
const ladderEntrySchema = z.coerce.number().min(0).max(100000);
const classPriceSchema = z.coerce.number().min(0).max(100000).nullable();

export const UpdateServiceInputSchema = z.object({
  serviceId: uuidSchema,
  propertyId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  isActive: z.boolean(),
  imageUrl: imageUrlSchema,
  linkedAddOnIds: z.array(uuidSchema).max(200),
  newAddOns: z.array(newAddOnDraftSchema).max(50),
  pricingKind: pricingKindSchema.optional(),
  membersOnly: z.boolean().optional(),
  lessonLadder: z.array(ladderEntrySchema).max(20).nullable().optional(),
  lessonCohortSize: z.coerce.number().int().min(1).max(50).optional(),
  classPriceMember: classPriceSchema.optional(),
  classPricePublic: classPriceSchema.optional(),
});
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type UpdateServiceRawInput = z.input<typeof UpdateServiceInputSchema>;

export const CreateAddOnInputSchema = z.object({
  propertyId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  price: priceSchema,
  displayOrder: displayOrderSchema.default(0),
  linkedServiceIds: z.array(uuidSchema).max(200).default([]),
});
export type CreateAddOnInput = z.infer<typeof CreateAddOnInputSchema>;
export type CreateAddOnRawInput = z.input<typeof CreateAddOnInputSchema>;

export const UpdateAddOnInputSchema = z.object({
  addOnId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  price: priceSchema,
  isActive: z.boolean(),
  imageUrl: imageUrlSchema,
  includedDetail: includedDetailSchema,
  maxQuantity: maxQuantitySchema,
  // Optional so the deactivate paths (which omit it) preserve the current value.
  estimateMemberDiscount: z.boolean().optional(),
});
export type UpdateAddOnInput = z.infer<typeof UpdateAddOnInputSchema>;
export type UpdateAddOnRawInput = z.input<typeof UpdateAddOnInputSchema>;

export const ReorderInputSchema = z.object({
  propertyId: uuidSchema,
  orderedIds: z.array(uuidSchema).min(1).max(200),
});
export type ReorderInput = z.infer<typeof ReorderInputSchema>;

// =============================================================================
// Writes
// =============================================================================

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export async function createCatalogService(
  supabase: SupabaseClient,
  input: CreateServiceInput,
): Promise<{ ok: true; service: AdminCatalogService } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      property_id: input.propertyId,
      name: input.name,
      description: input.description,
      display_order: input.displayOrder,
    })
    .select(SERVICE_COLUMNS)
    .single();
  if (error) {
    return { ok: false, error: `Couldn't create service: ${error.message}` };
  }
  return { ok: true, service: rowToService(data as ServiceRow) };
}

export async function updateCatalogService(
  supabase: SupabaseClient,
  input: UpdateServiceInput,
): Promise<MutationResult> {
  // Always-set fields; pricing fields only when the caller supplied them
  // (deactivate paths omit them to preserve current pricing).
  const serviceUpdateFields: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    is_active: input.isActive,
    image_url: input.imageUrl,
    updated_at: new Date().toISOString(),
  };
  if (input.pricingKind !== undefined) serviceUpdateFields.pricing_kind = input.pricingKind;
  if (input.membersOnly !== undefined) serviceUpdateFields.members_only = input.membersOnly;
  if (input.lessonLadder !== undefined) serviceUpdateFields.lesson_ladder = input.lessonLadder;
  if (input.lessonCohortSize !== undefined) serviceUpdateFields.lesson_cohort_size = input.lessonCohortSize;
  if (input.classPriceMember !== undefined) serviceUpdateFields.class_price_member = input.classPriceMember;
  if (input.classPricePublic !== undefined) serviceUpdateFields.class_price_public = input.classPricePublic;

  const serviceUpdate = await supabase
    .from("services")
    .update(serviceUpdateFields)
    .eq("id", input.serviceId);
  if (serviceUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save service: ${serviceUpdate.error.message}`,
    };
  }

  let linkedIds = [...new Set(input.linkedAddOnIds)];

  if (input.newAddOns.length > 0) {
    const maxOrderResult = await supabase
      .from("add_ons")
      .select("display_order")
      .eq("property_id", input.propertyId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrderBase =
      maxOrderResult.data?.display_order !== undefined
        ? (maxOrderResult.data.display_order as number) + 1
        : 0;

    const insertResult = await supabase
      .from("add_ons")
      .insert(
        input.newAddOns.map((draft, index) => ({
          property_id: input.propertyId,
          name: draft.name,
          description: draft.description,
          price: draft.price,
          display_order: nextOrderBase + index,
        })),
      )
      .select("id");
    if (insertResult.error) {
      return {
        ok: false,
        error: `Couldn't create add-ons: ${insertResult.error.message}`,
      };
    }
    const created = (insertResult.data ?? []) as Array<{ id: string }>;
    linkedIds = [...linkedIds, ...created.map((row) => row.id)];
  }

  const existingLinksResult = await supabase
    .from("service_add_ons")
    .select("add_on_id")
    .eq("service_id", input.serviceId);
  if (existingLinksResult.error) {
    return {
      ok: false,
      error: `Couldn't read existing links: ${existingLinksResult.error.message}`,
    };
  }
  const existing = new Set(
    (existingLinksResult.data ?? []).map((row) => row.add_on_id as string),
  );
  const next = new Set(linkedIds);
  const toAdd = [...next].filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !next.has(id));

  if (toAdd.length > 0) {
    const addResult = await supabase
      .from("service_add_ons")
      .insert(toAdd.map((id) => ({ service_id: input.serviceId, add_on_id: id })));
    if (addResult.error) {
      return {
        ok: false,
        error: `Couldn't link add-ons: ${addResult.error.message}`,
      };
    }
  }

  if (toRemove.length > 0) {
    const removeResult = await supabase
      .from("service_add_ons")
      .delete()
      .eq("service_id", input.serviceId)
      .in("add_on_id", toRemove);
    if (removeResult.error) {
      return {
        ok: false,
        error: `Couldn't unlink add-ons: ${removeResult.error.message}`,
      };
    }
  }

  return { ok: true };
}

export async function reorderCatalogServices(
  supabase: SupabaseClient,
  input: ReorderInput,
): Promise<MutationResult> {
  for (let index = 0; index < input.orderedIds.length; index++) {
    const id = input.orderedIds[index];
    const { error } = await supabase
      .from("services")
      .update({ display_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("property_id", input.propertyId);
    if (error) {
      return {
        ok: false,
        error: `Couldn't reorder services: ${error.message}`,
      };
    }
  }
  return { ok: true };
}

export async function createCatalogAddOn(
  supabase: SupabaseClient,
  input: CreateAddOnInput,
): Promise<{ ok: true; addOn: AdminCatalogAddOn } | { ok: false; error: string }> {
  const insertResult = await supabase
    .from("add_ons")
    .insert({
      property_id: input.propertyId,
      name: input.name,
      description: input.description,
      price: input.price,
      display_order: input.displayOrder,
    })
    .select(ADDON_COLUMNS)
    .single();
  if (insertResult.error) {
    return {
      ok: false,
      error: `Couldn't create add-on: ${insertResult.error.message}`,
    };
  }

  const addOn = rowToAddOn(insertResult.data as AddOnRow);

  const uniqueServiceIds = [...new Set(input.linkedServiceIds)];
  if (uniqueServiceIds.length > 0) {
    const linkResult = await supabase
      .from("service_add_ons")
      .insert(
        uniqueServiceIds.map((serviceId) => ({
          service_id: serviceId,
          add_on_id: addOn.id,
        })),
      );
    if (linkResult.error) {
      return {
        ok: false,
        error: `Add-on created but couldn't link services: ${linkResult.error.message}`,
      };
    }
  }

  return { ok: true, addOn };
}

export async function updateCatalogAddOn(
  supabase: SupabaseClient,
  input: UpdateAddOnInput,
): Promise<MutationResult> {
  const updateFields: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    price: input.price,
    is_active: input.isActive,
    image_url: input.imageUrl,
    included_detail: input.includedDetail,
    max_quantity: input.maxQuantity,
    updated_at: new Date().toISOString(),
  };
  // Only touch the member-discount flag when the caller supplied it (deactivate
  // paths omit it to preserve the current value).
  if (input.estimateMemberDiscount !== undefined) {
    updateFields.estimate_member_discount = input.estimateMemberDiscount;
  }

  const { error } = await supabase
    .from("add_ons")
    .update(updateFields)
    .eq("id", input.addOnId);
  if (error) {
    return { ok: false, error: `Couldn't save add-on: ${error.message}` };
  }
  return { ok: true };
}

export async function reorderCatalogAddOns(
  supabase: SupabaseClient,
  input: ReorderInput,
): Promise<MutationResult> {
  for (let index = 0; index < input.orderedIds.length; index++) {
    const id = input.orderedIds[index];
    const { error } = await supabase
      .from("add_ons")
      .update({ display_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("property_id", input.propertyId);
    if (error) {
      return {
        ok: false,
        error: `Couldn't reorder add-ons: ${error.message}`,
      };
    }
  }
  return { ok: true };
}

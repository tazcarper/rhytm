"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createCatalogService,
  updateCatalogService,
  reorderCatalogServices,
  deleteCatalogService,
  createCatalogAddOn,
  updateCatalogAddOn,
  reorderCatalogAddOns,
  deleteCatalogAddOn,
  listActiveBookingsForService,
  listAllBookingsForService,
  listActiveBookingsForAddOn,
  listAllBookingsForAddOn,
  CreateServiceInputSchema,
  UpdateServiceInputSchema,
  CreateAddOnInputSchema,
  UpdateAddOnInputSchema,
  ReorderInputSchema,
  type CreateServiceRawInput,
  type UpdateServiceRawInput,
  type CreateAddOnRawInput,
  type UpdateAddOnRawInput,
  type ReorderInput,
  type ActiveBookingRef,
  type AdminCatalogService,
  type AdminCatalogAddOn,
  type MutationResult,
} from "@/src/services/admin/catalog";

interface CatalogActionContext {
  propertyId: string;
  propertySlug: string;
}

function revalidateCatalogSurfaces(ctx: CatalogActionContext) {
  revalidatePath(`/admin/properties/${ctx.propertyId}/catalog`);
  revalidatePath(`/book/${ctx.propertySlug}`);
}

function firstIssue(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.map((segment) => String(segment)).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

// ---------- Services ----------

export async function createServiceAction(
  ctx: CatalogActionContext,
  input: CreateServiceRawInput,
): Promise<{ ok: true; service: AdminCatalogService } | { ok: false; error: string }> {
  const parsed = CreateServiceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await createCatalogService(supabase, parsed.data);
  if (result.ok) revalidateCatalogSurfaces(ctx);
  return result;
}

export async function updateServiceAction(
  ctx: CatalogActionContext,
  input: UpdateServiceRawInput,
): Promise<MutationResult> {
  const parsed = UpdateServiceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await updateCatalogService(supabase, parsed.data);
  if (result.ok) {
    revalidateCatalogSurfaces(ctx);
    revalidatePath(
      `/admin/properties/${ctx.propertyId}/catalog/services/${parsed.data.serviceId}/edit`,
    );
  }
  return result;
}

export async function reorderServicesAction(
  ctx: CatalogActionContext,
  input: ReorderInput,
): Promise<MutationResult> {
  const parsed = ReorderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await reorderCatalogServices(supabase, parsed.data);
  if (result.ok) revalidateCatalogSurfaces(ctx);
  return result;
}

export async function listActiveBookingsForServiceAction(
  serviceId: string,
): Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const refs = await listActiveBookingsForService(supabase, serviceId);
    return { ok: true, refs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load refs",
    };
  }
}

export async function listAllBookingsForServiceAction(
  serviceId: string,
): Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const refs = await listAllBookingsForService(supabase, serviceId);
    return { ok: true, refs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load refs",
    };
  }
}

export async function deleteServiceAction(
  ctx: CatalogActionContext,
  serviceId: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteCatalogService(supabase, serviceId);
  if (result.ok) {
    revalidateCatalogSurfaces(ctx);
  }
  return result;
}

// ---------- Add-ons ----------

export async function createAddOnAction(
  ctx: CatalogActionContext,
  input: CreateAddOnRawInput,
): Promise<{ ok: true; addOn: AdminCatalogAddOn } | { ok: false; error: string }> {
  const parsed = CreateAddOnInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await createCatalogAddOn(supabase, parsed.data);
  if (result.ok) revalidateCatalogSurfaces(ctx);
  return result;
}

export async function updateAddOnAction(
  ctx: CatalogActionContext,
  input: UpdateAddOnRawInput,
): Promise<MutationResult> {
  const parsed = UpdateAddOnInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await updateCatalogAddOn(supabase, parsed.data);
  if (result.ok) {
    revalidateCatalogSurfaces(ctx);
    revalidatePath(
      `/admin/properties/${ctx.propertyId}/catalog/add-ons/${parsed.data.addOnId}/edit`,
    );
  }
  return result;
}

export async function reorderAddOnsAction(
  ctx: CatalogActionContext,
  input: ReorderInput,
): Promise<MutationResult> {
  const parsed = ReorderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await reorderCatalogAddOns(supabase, parsed.data);
  if (result.ok) revalidateCatalogSurfaces(ctx);
  return result;
}

export async function listActiveBookingsForAddOnAction(
  addOnId: string,
): Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const refs = await listActiveBookingsForAddOn(supabase, addOnId);
    return { ok: true, refs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load refs",
    };
  }
}

export async function listAllBookingsForAddOnAction(
  addOnId: string,
): Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const refs = await listAllBookingsForAddOn(supabase, addOnId);
    return { ok: true, refs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load refs",
    };
  }
}

export async function deleteAddOnAction(
  ctx: CatalogActionContext,
  addOnId: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteCatalogAddOn(supabase, addOnId);
  if (result.ok) {
    revalidateCatalogSurfaces(ctx);
  }
  return result;
}

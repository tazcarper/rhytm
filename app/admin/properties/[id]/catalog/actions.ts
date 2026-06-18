"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import { createAddOnImageStorage } from "@/lib/storage/add-on-image-storage";
import { createServiceImageStorage } from "@/lib/storage/service-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";
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

// Upload one discipline (service) card photo to the public service-images
// bucket and return its public URL for the editor to drop into the image
// field — the same field a pasted URL fills. Admin-gated, then writes via
// service role (the bucket has no INSERT policy by design). Mirrors
// uploadAddOnImageAction.
export async function uploadServiceImageAction(
  formData: FormData,
): Promise<UploadPublicImageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createServiceImageStorage(createServiceRoleClient());
  return uploadPublicImage(storage, { bytes, contentType: file.type });
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

// Upload one add-on detail photo to the public add-on-images bucket and return
// its public URL for the editor to drop into the image field — the same field
// a pasted URL fills. Admin-gated, then writes via service role (the bucket has
// no INSERT policy by design). Thin: auth + extract file + delegate to the
// generic public-image service. Mirrors uploadHomepageHeroImageAction.
export async function uploadAddOnImageAction(
  formData: FormData,
): Promise<UploadPublicImageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createAddOnImageStorage(createServiceRoleClient());
  return uploadPublicImage(storage, { bytes, contentType: file.type });
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

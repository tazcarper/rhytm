"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CAPABILITY_REQUEST_STATUSES,
  markCapabilityRequestDuplicate,
  updateCapabilityRequestStatus,
  type CapabilityRequestStatus,
} from "@/src/services/ai/capability-requests";

// The developer changes a feature request's status. Admins only, and RLS
// allows only admins to update these rows.
const InputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CAPABILITY_REQUEST_STATUSES as [CapabilityRequestStatus, ...CapabilityRequestStatus[]]),
});

async function isAdmin(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  return role === "admin" || role === "super_admin";
}

export async function setFeatureRequestStatusAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can change this." };
  const result = await updateCapabilityRequestStatus(supabase, parsed.data.id, parsed.data.status);
  // The events list, the drafts' pages and this page all show the status.
  if (result.ok) revalidatePath("/admin/events", "layout");
  return result;
}

// Folds one request into another that asks for the same thing. Its drafts
// then follow the original's status.
const DuplicateSchema = z.object({
  id: z.string().uuid(),
  originalId: z.string().uuid(),
});

export async function markFeatureRequestDuplicateAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = DuplicateSchema.safeParse(input);
  if (!parsed.success || parsed.data.id === parsed.data.originalId) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can change this." };
  const result = await markCapabilityRequestDuplicate(supabase, parsed.data.id, parsed.data.originalId);
  if (result.ok) revalidatePath("/admin/events", "layout");
  return result;
}

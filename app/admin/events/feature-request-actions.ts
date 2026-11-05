"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CAPABILITY_REQUEST_STATUSES,
  updateCapabilityRequestStatus,
  type CapabilityRequestStatus,
} from "@/src/services/ai/capability-requests";

// The developer changes a feature request's status. Admins only, and RLS
// allows only admins to update these rows.
const InputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CAPABILITY_REQUEST_STATUSES as [CapabilityRequestStatus, ...CapabilityRequestStatus[]]),
});

export async function setFeatureRequestStatusAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return { ok: false, error: "Only admins can change this." };
  const result = await updateCapabilityRequestStatus(supabase, parsed.data.id, parsed.data.status);
  // The events list, the drafts' pages and this page all show the status.
  if (result.ok) revalidatePath("/admin/events", "layout");
  return result;
}

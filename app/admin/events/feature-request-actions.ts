"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { requestFeatureBuild } from "@/src/services/ai/feature-builds";
import {
  CAPABILITY_REQUEST_STATUSES,
  getCapabilityRequests,
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

// "Build it": opens a GitHub issue that the Claude GitHub Action builds.
// Not again while a build is running or its pull request is open.
const BuildSchema = z.object({ id: z.string().uuid() });

export async function buildFeatureRequestAction(input: unknown): Promise<{ ok: true; issueUrl: string } | { ok: false; error: string }> {
  const parsed = BuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Build it isn't set up yet (GitHub token missing in Vercel)." };

  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  if (row.build && row.build.pullRequest?.state !== "closed") return { ok: false, error: "It's already being built." };

  const result = await requestFeatureBuild(supabase, github, row);
  if (result.ok) revalidatePath("/admin/events/feature-requests");
  return result;
}

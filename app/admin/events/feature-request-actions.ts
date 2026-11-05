"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { approveFeatureBuild, buildIssueFor, requestFeatureBuild, sendFeatureBuildFeedback } from "@/src/services/ai/feature-builds";
import {
  CAPABILITY_REQUEST_STATUSES,
  createProblemReport,
  getCapabilityRequests,
  liveFeatures,
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

  const rows = await getCapabilityRequests(supabase);
  const row = rows.find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  if (row.build && row.build.pullRequest?.state !== "closed") return { ok: false, error: "It's already being built." };

  const result = await requestFeatureBuild(supabase, github, row, buildIssueFor(row, rows));
  if (result.ok) revalidatePath("/admin/events/feature-requests");
  return result;
}

// "Something's not right": staff's notes from the test site go back to
// Claude, which fixes the same build.
const FeedbackSchema = z.object({ id: z.string().uuid(), feedback: z.string().trim().min(3).max(4000) });

export async function sendBuildFeedbackAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a few words about what's wrong." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Automatic building isn't switched on yet." };

  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  return sendFeatureBuildFeedback(github, row.build, parsed.data.feedback);
}

// "Approve and go live" (Taz, 2026-11-05: any admin may). Merges the build;
// the webhook marks the request Built.
export async function approveBuildAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Automatic building isn't switched on yet." };

  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  const result = await approveFeatureBuild(github, row.build);
  if (result.ok) revalidatePath("/admin/events", "layout");
  return result;
}

// "Report a problem": staff describe what's broken in a live feature. It's
// saved as a fix request and Claude starts on it straight away.
const ProblemSchema = z.object({
  featureId: z.string().uuid().nullable(),
  problem: z.string().trim().min(10).max(2000),
});

export async function reportProblemAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = ProblemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Describe the problem in a sentence or two." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Automatic fixing isn't switched on yet. Ask your developer." };

  const before = await getCapabilityRequests(supabase);
  const feature = parsed.data.featureId ? liveFeatures(before).find((row) => row.id === parsed.data.featureId) : null;
  if (parsed.data.featureId && !feature) return { ok: false, error: "That feature is gone. Pick another, or choose Not sure." };

  const saved = await createProblemReport(supabase, {
    fixes: feature ? { id: feature.id, summary: feature.summary } : null,
    problem: parsed.data.problem,
  });
  if (!saved.ok) return saved;

  const rows = await getCapabilityRequests(supabase);
  const report = rows.find((row) => row.id === saved.id);
  if (!report) return { ok: false, error: "It was saved but couldn't be found. Press Build it on it under Feature requests." };
  const result = await requestFeatureBuild(supabase, github, report, buildIssueFor(report, rows));
  revalidatePath("/admin/events/feature-requests");
  return result.ok ? { ok: true } : { ok: false, error: `It was saved, but Claude couldn't start: ${result.error}` };
}

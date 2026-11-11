"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { copyEventsToPreview, createPreviewDatabaseClient } from "@/src/services/admin/copy-events-to-preview";
import { getBuildRisk, isBuildOwner } from "@/src/services/ai/build-risk";
import { createDraftSessionStore } from "@/src/services/ai/draft-session-store";
import { HELPER_LIMITS, helperTranscript, type HelperTranscriptLine } from "@/src/services/ai/event-helper";
import { notifyOwnersOfPublish } from "@/src/services/ai/build-risk-notice";
import {
  approveFeatureBuild,
  buildIssueFor,
  featureUndoIssue,
  requestFeatureBuild,
  sendFeatureBuildFeedback,
} from "@/src/services/ai/feature-builds";
import {
  CAPABILITY_REQUEST_STATUSES,
  createProblemReport,
  getCapabilityRequests,
  isReopened,
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

// The drafts a request came from, copied to the test site's database so
// they're there to try the build on. Only on the live site, and only when
// the preview database's keys are set. A failed copy doesn't stop the
// build; it's logged.
async function copyDraftsToTestSite(eventIds: string[]): Promise<void> {
  const target = createPreviewDatabaseClient();
  if (!target || eventIds.length === 0) return;
  const copied = await copyEventsToPreview(eventIds, { source: createServiceRoleClient(), target }).catch(
    (error: unknown) => ({ ok: false as const, error: String(error) }),
  );
  if (!copied.ok) console.error("[feature-builds] copying drafts to the test site failed:", copied.error);
}

// "Build it": opens a GitHub issue that the Claude GitHub Action builds.
// Not again while a build is running or its pull request is open. For a
// live feature staff asked to add more to, it builds the addition.
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
  const state = row.build?.pullRequest?.state;
  const addingToLiveFeature = row.addingMore && isReopened(row) && (row.build?.kind === "build" || state === "merged");
  if (row.build && state !== "closed" && !addingToLiveFeature) return { ok: false, error: "It's already being built." };

  const result = await requestFeatureBuild(supabase, github, row, buildIssueFor(row, rows));
  if (result.ok) {
    revalidatePath("/admin/events/feature-requests");
    await copyDraftsToTestSite(row.events.map((event) => event.id));
  }
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
// the webhook marks the request Built. An owner-level build (see
// build-risk.ts) only the owner may publish (Taz, 2026-11-10); the check is
// here, on the server, so hiding the button isn't the only guard. When a
// "careful" one goes live, the owner gets an email.
export async function approveBuildAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Automatic building isn't switched on yet." };

  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  const risk = await getBuildRisk(github, row.build);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (risk?.level === "owner" && !isBuildOwner(user?.email)) {
    return { ok: false, error: "This build changes something that can't easily be undone, so only the site owner can publish it." };
  }
  const result = await approveFeatureBuild(github, row.build);
  if (result.ok && risk && risk.level !== "normal") {
    const notice = { summary: row.summary, risk, publishedBy: user?.email ?? "An admin", pullRequestUrl: row.build?.pullRequest?.url ?? null };
    after(() => notifyOwnersOfPublish(notice));
  }
  if (result.ok) revalidatePath("/admin/events", "layout");
  return result;
}

// "Add more": the helper conversation the feature was asked in, to carry
// on from. Only the person who had it can load it (RLS); everyone else, or
// a conversation that's nearly full, starts a fresh one.
export async function loadFeatureChatAction(
  input: unknown,
): Promise<{ ok: true; sessionId: string | null; transcript: HelperTranscriptLine[] } | { ok: false; error: string }> {
  const parsed = BuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  const session = row.sessionId ? await createDraftSessionStore(supabase).load(row.sessionId).catch(() => null) : null;
  if (!session || session.turnCount > HELPER_LIMITS.maxTurnsPerSession - 4) return { ok: true, sessionId: null, transcript: [] };
  return { ok: true, sessionId: session.id, transcript: helperTranscript(session.messages) };
}

// "Undo this feature": Claude prepares taking a live feature off the site
// (everything that went live for it), on a test site first. It goes live
// when someone publishes it, like any build.
export async function undoFeatureAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createServerSupabaseClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Only admins can do this." };
  const github = createGitHubIssuesClient();
  if (!github) return { ok: false, error: "Automatic building isn't switched on yet. Ask your developer." };

  const rows = await getCapabilityRequests(supabase);
  const row = rows.find((request) => request.id === parsed.data.id);
  if (!row) return { ok: false, error: "That request is gone." };
  if (row.status !== "built" || row.removedAt || row.fix) return { ok: false, error: "Only a live feature can be undone." };
  if (isReopened(row)) return { ok: false, error: "Something is already being built for this feature. Finish or set that aside first." };

  const result = await requestFeatureBuild(supabase, github, row, featureUndoIssue(row, rows), "undo");
  if (result.ok) revalidatePath("/admin/events/feature-requests");
  return result.ok ? { ok: true } : result;
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

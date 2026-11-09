import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { getCapabilityRequests } from "@/src/services/ai/capability-requests";
import { getBuildProgress } from "@/src/services/ai/feature-build-progress";
import { featureRequestStage, featureRequestStatus } from "@/src/services/ai/feature-request-status";
import { EVENT_HELPER_ROLES } from "@/src/constants/admin/event-helper";

// One feature request's build status, for the card in the AI helper's chat.
// The card polls this while Claude is building. RLS limits which requests
// the caller can read (admins all, property managers their own).
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !role || !EVENT_HELPER_ROLES.has(role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const row = (await getCapabilityRequests(supabase)).find((request) => request.id === id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const github = createGitHubIssuesClient();
  const progress =
    github && row.build && featureRequestStage(row) === "building" ? await getBuildProgress(github, row.build) : null;
  return NextResponse.json(featureRequestStatus(row, progress, ADMIN_ROLES.has(role) && github !== null));
}

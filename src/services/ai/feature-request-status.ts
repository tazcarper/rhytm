import type { CapabilityRequestRow } from "@/src/services/ai/capability-requests";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";

// Where a feature request stands, in the terms the AI helper's chat shows
// staff: waiting for someone to press Build it, being built, ready to try
// on the preview, live, or stopped.

export type FeatureRequestStage = "waiting" | "building" | "ready" | "live" | "declined" | "set-aside";

export interface FeatureRequestStatus {
  id: string;
  summary: string;
  isFix: boolean;
  stage: FeatureRequestStage;
  // The test copy of the site with the build on it, once Vercel has made it.
  previewUrl: string | null;
  // Claude's checklist while it works. Null before it posts one.
  progress: BuildProgress | null;
  // This person can press Build it (admins, with GitHub set up).
  canBuild: boolean;
}

export function featureRequestStage(row: CapabilityRequestRow): FeatureRequestStage {
  if (row.status === "built") return "live";
  if (row.status === "declined") return "declined";
  const pullRequest = row.build?.pullRequest ?? null;
  if (!row.build) return "waiting";
  if (!pullRequest) return "building";
  if (pullRequest.state === "merged") return "live";
  if (pullRequest.state === "closed") return "set-aside";
  // The pull request is open: ready once its preview exists.
  return row.build.previewUrl ? "ready" : "building";
}

export function featureRequestStatus(
  row: CapabilityRequestRow,
  progress: BuildProgress | null,
  canBuild: boolean,
): FeatureRequestStatus {
  return {
    id: row.id,
    summary: row.summary,
    isFix: row.fix !== null,
    stage: featureRequestStage(row),
    previewUrl: row.build?.previewUrl ?? null,
    progress,
    canBuild,
  };
}

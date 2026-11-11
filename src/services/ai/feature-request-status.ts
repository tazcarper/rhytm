import { isReopened, type CapabilityRequestRow } from "@/src/services/ai/capability-requests";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";
import { buildStepOf, type BuildStep } from "@/src/services/ai/build-steps";

// Where a feature request stands, for the card in the AI helper's chat: the
// build step (see build-steps.ts), or that it was declined or set aside.

export interface FeatureRequestStatus {
  id: string;
  summary: string;
  isFix: boolean;
  step: BuildStep;
  declined: boolean;
  // Built once and set aside without going live; it can be built again.
  setAside: boolean;
  // The test copy of the site with the build on it, once Vercel has made it.
  previewUrl: string | null;
  // Claude's checklist while it works. Null before it posts one.
  progress: BuildProgress | null;
  // This person can press Build it (admins, with GitHub set up).
  canBuild: boolean;
}

// Builds whose GitHub progress is worth reading: started and not finished.
export function needsBuildProgress(row: CapabilityRequestRow): boolean {
  const state = row.build?.pullRequest?.state;
  return row.build !== null && (row.status !== "built" || isReopened(row)) && state !== "merged" && state !== "closed";
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
    step: buildStepOf({ status: row.status, build: row.build, progress, reopened: isReopened(row) }),
    declined: row.status === "declined",
    setAside: row.build?.pullRequest?.state === "closed",
    previewUrl: row.build?.previewUrl ?? null,
    progress,
    canBuild,
  };
}

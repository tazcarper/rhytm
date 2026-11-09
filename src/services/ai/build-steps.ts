import type { FeatureBuild } from "@/src/services/ai/capability-requests";
import type { BuildProgress } from "@/src/services/ai/feature-build-progress";

// The steps every Claude build goes through, as staff see them on the
// feature request card and in the AI helper's chat. One place decides which
// step a build is on, so both always agree.

export type BuildStep = "requested" | "building" | "preview" | "ready" | "live";

// "requested" (nothing started yet) has no dot of its own: the tracker
// shows every step still ahead (Taz, 2026-11-09).
export const BUILD_STEPS: ReadonlyArray<{ key: BuildStep; label: string }> = [
  { key: "building", label: "Building" },
  { key: "preview", label: "Setting up preview" },
  { key: "ready", label: "Ready to try" },
  { key: "live", label: "Live" },
];

export interface BuildStepInput {
  // The request's status: "built" counts as live, whatever GitHub says.
  status: string;
  build: FeatureBuild | null;
  progress: BuildProgress | null;
}

export function buildStepOf({ status, build, progress }: BuildStepInput): BuildStep {
  if (status === "built") return "live";
  if (!build) return "requested";
  const pullRequest = build.pullRequest;
  if (pullRequest?.state === "merged") return "live";
  // Set aside: it can be built again, so it's back at the start.
  if (pullRequest?.state === "closed") return "requested";
  // Claude is working, either on the first build or on staff's notes.
  if (progress?.state === "working") return "building";
  if (pullRequest?.state === "open") return build.previewUrl ? "ready" : "preview";
  // No pull request yet: Claude is still going, unless it has finished
  // and the pull request and preview are on their way.
  return progress && progress.state === "finished" ? "preview" : "building";
}

// Steps where something is happening without staff: shown animated.
export function isWorkingStep(step: BuildStep): boolean {
  return step === "building" || step === "preview";
}

import type { LucideIcon } from "lucide-react";
import { Eye, Hammer, Rocket } from "lucide-react";

// The three steps of a Claude build, named and drawn the same on every
// feature request card. Build it is the solid (primary) one; Preview and
// Publish are the lighter (secondary) ones (Taz, 2026-11-06).

export type BuildAction = "build" | "preview" | "publish";

export const BUILD_ACTIONS: Record<
  BuildAction,
  { label: string; icon: LucideIcon; variant: "primary" | "secondary" }
> = {
  build: {
    label: "Build it",
    icon: Hammer,
    variant: "primary",
  },
  preview: {
    label: "Preview it here",
    icon: Eye,
    variant: "secondary",
  },
  publish: {
    label: "Publish to production",
    icon: Rocket,
    variant: "secondary",
  },
};

// Icon sized to sit inside a small button; it takes the button's text
// colour, so it always contrasts with the button's background.
export function BuildActionIcon({ action }: { action: BuildAction }) {
  const Icon = BUILD_ACTIONS[action].icon;
  return <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />;
}


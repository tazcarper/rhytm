import type { LucideIcon } from "lucide-react";
import { Eye, Hammer, Rocket } from "lucide-react";
import { Button } from "@/lib/ui";

// The three steps of a Claude build, named and drawn the same everywhere:
// the real buttons on a feature request card and the how-it-works list at
// the top of the page. Build it is the solid (primary) one; Preview and
// Publish are the lighter (secondary) ones (Taz, 2026-11-06).

export type BuildAction = "build" | "preview" | "publish";

export const BUILD_ACTIONS: Record<
  BuildAction,
  { label: string; icon: LucideIcon; variant: "primary" | "secondary"; description: string }
> = {
  build: {
    label: "Build it",
    icon: Hammer,
    variant: "primary",
    description: "Claude starts work. Follow its checklist on the card as it goes.",
  },
  preview: {
    label: "Preview it here",
    icon: Eye,
    variant: "secondary",
    description: "When it's done, try it on a test copy of the site. Nothing there reaches guests.",
  },
  publish: {
    label: "Publish to production",
    icon: Rocket,
    variant: "secondary",
    description: "Happy with it? Put it on the real site. Or tell Claude what to change.",
  },
};

// Icon sized to sit inside a small button; it takes the button's text
// colour, so it always contrasts with the button's background.
export function BuildActionIcon({ action }: { action: BuildAction }) {
  const Icon = BUILD_ACTIONS[action].icon;
  return <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />;
}

// The how-it-works list: each step's button as it looks on the card (not
// clickable here), with what it does beside it.
export function BuildActionsGuide() {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {(Object.keys(BUILD_ACTIONS) as BuildAction[]).map((action) => {
        const { label, variant, description } = BUILD_ACTIONS[action];
        return (
          <li key={action} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 sm:grid-cols-[16.5rem_1fr]">
            <Button asChild variant={variant} size="sm">
              <span aria-hidden className="pointer-events-none !inline-flex w-fit items-center gap-2 whitespace-nowrap">
                <BuildActionIcon action={action} />
                {label}
              </span>
            </Button>
            <span className="text-body leading-body text-olive">
              <span className="sr-only">{label}: </span>
              {description}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

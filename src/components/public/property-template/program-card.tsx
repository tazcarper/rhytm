import type { ReactNode } from "react";
import { PropertyButton } from "./property-button";

type PropertyButtonVariant = NonNullable<Parameters<typeof PropertyButton>[0]["variant"]>;

interface ProgramCardProps {
  title: string;
  body: string;
  linkHref?: string | null;
  ctaLabel?: ReactNode;
  variant?: PropertyButtonVariant;
}

// One "Programs" track card on an Education page — bordered box with a
// title, body, and a single CTA. Same "single card, caller owns the grid
// and SectionHeading" shape as FacilityCard: eyebrow/description/section
// tone differ enough per property (Horseshoe Bay's "Book a Lesson" vs.
// everyone else's "See X Classes", for one) that only the truly mechanical
// card markup is pulled out here.
export function ProgramCard({ title, body, linkHref, ctaLabel, variant = "primary" }: ProgramCardProps) {
  return (
    <div className="flex flex-col border border-property-ink/5 bg-property-surface p-8 transition-colors hover:border-property-accent">
      <h3 className="property-headline mb-4 font-property-display text-2xl uppercase text-property-ink">{title}</h3>
      <p className="mb-8 flex-grow font-property-sans text-property-ink-variant">{body}</p>
      <PropertyButton href={linkHref ?? "#"} variant={variant} size="sm">
        {ctaLabel ?? `See ${title} Classes`}
      </PropertyButton>
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Full-bleed background color band; content still constrains to the
      container width inside it. Omit for a section with no background
      treatment of its own. */
  tone?: "bg" | "surfaceHighest" | "sage" | "oliveDeep";
  /** Skip the container/gutter wrapper — for sections (like the hero)
      that need true full-bleed content. */
  bleed?: boolean;
}

const TONE_CLASS: Record<NonNullable<SectionProps["tone"]>, string> = {
  bg: "bg-property-bg",
  surfaceHighest: "bg-property-surface-highest",
  sage: "bg-property-sage",
  oliveDeep: "bg-property-ink-dark",
};

// The section wrapper every property page composes with — enforces the
// mockup's section padding (120px desktop / 64px mobile) and container
// max-width (1280px) via the theme tokens, so no page hand-rolls those
// numbers. Property-agnostic: reads entirely off the --property-* CSS
// vars in scope, so it works unchanged once hog-heaven/packsaddle wrap
// their own pages in [data-property="..."].
export function Section({ children, tone, bleed = false, className, ...rest }: SectionProps) {
  return (
    <section
      className={cn(
        "w-full py-property-section-mobile md:py-property-section-desktop",
        tone && TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {bleed ? (
        children
      ) : (
        <div className="mx-auto w-full max-w-property-max px-property-gutter">
          {children}
        </div>
      )}
    </section>
  );
}

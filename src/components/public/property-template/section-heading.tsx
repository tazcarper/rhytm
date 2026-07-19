import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
import { RuleDivider } from "./rule-divider";

interface SectionHeadingProps {
  eyebrow?: ReactNode;
  heading: ReactNode;
  description?: ReactNode;
  /** default: left-aligned, divider hugs the left edge. center: everything centered. */
  align?: "left" | "center";
  /** default: text-property-headline (the standard section heading size).
      large: the bigger text-6xl "property-display" treatment used for a
      handful of emphasis headings (Programs, Meet the Instructors, ...).
      cta: text-5xl, used for the heading directly above a single CTA
      button (no supporting grid/form below it).
      display: the page-hero-scale property-display token, used for the
      one or two biggest headings per page (e.g. "Membership Inquiry"). */
  size?: "default" | "large" | "cta" | "display";
  /** ink: for light-background sections (the default). white: for dark
      Section tones (sage, moss, oliveDeep, the property-ink SplitGallery
      band, ...). */
  tone?: "ink" | "white";
  /** Most sections put the rule divider under the heading. CTA bands that
      go straight from heading to a button skip it (divider=false), which
      shifts the heading's bottom margin so the button still gets its gap. */
  divider?: boolean;
  className?: string;
}

// The eyebrow + heading + rule (+ optional description) block that opens
// nearly every section across both properties' marketing pages — pulled
// out once the same five lines started showing up, hand-copied with small
// drifts, in a dozen-plus page files. Centralizing it means a change to
// the pattern (spacing, a new tone) happens once instead of at every call
// site. Callers still own their own wrapper spacing/width (mb-16,
// max-w-2xl, mx-auto, ...) via `className`; this component only renders
// the heading block itself.
export function SectionHeading({
  eyebrow,
  heading,
  description,
  align = "left",
  size = "default",
  tone = "ink",
  divider = true,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <p className="mb-3 font-property-label text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "font-property-display uppercase",
          size === "large" && "property-display text-6xl",
          size === "cta" && "property-headline text-5xl",
          size === "display" && "property-display text-property-display-mobile md:text-property-display",
          size === "default" && "property-headline text-property-headline",
          tone === "white" ? "text-white" : "text-property-ink",
          !divider && "mb-8",
        )}
      >
        {heading}
      </h2>
      {divider && <RuleDivider center={align === "center"} />}
      {description && (
        <p
          className={cn(
            "font-property-sans",
            tone === "white" ? "text-white/85" : "text-property-ink-variant",
            align === "center" && "mx-auto max-w-xl",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

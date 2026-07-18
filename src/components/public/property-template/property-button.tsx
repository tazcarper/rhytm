import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui";

type PropertyButtonVariant = "primary" | "ink" | "secondary" | "outline" | "ghost";
type PropertyButtonSize = "default" | "sm";

interface PropertyButtonOwnProps {
  variant?: PropertyButtonVariant;
  size?: PropertyButtonSize;
  children: ReactNode;
  className?: string;
}

// "primary" (bg-property-accent) and "ink" (bg-property-ink) are both
// real "main CTA" styles — which one a page reaches for depends on the
// property's own mockup (Hog Heaven's CTAs are almost all accent; Horseshoe
// Bay's are mostly ink, with accent reserved for a few highlighted spots),
// not a fixed hierarchy. `text-property-on-primary` is themed per property
// in property-themes.css (dark text where the accent itself is light,
// e.g. Horseshoe Bay's peach accent; white where it's dark, e.g. Hog
// Heaven's rust accent) so "primary" always has readable contrast without
// each call site guessing at a text color.
const VARIANT_CLASS: Record<PropertyButtonVariant, string> = {
  primary: "bg-property-accent text-property-on-primary hover:bg-property-accent-dark",
  ink: "bg-property-ink text-white hover:bg-property-ink-dark",
  secondary: "bg-property-bg text-property-ink hover:bg-property-surface-highest",
  outline: "border border-property-ink text-property-ink hover:bg-property-ink hover:text-property-bg",
  ghost: "bg-transparent text-property-ink border-b border-property-ink hover:border-property-camel",
};

const SIZE_CLASS: Record<PropertyButtonSize, string> = {
  default: "px-10 py-5",
  sm: "px-6 py-3",
};

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 font-property-sans font-semibold text-[13px] uppercase tracking-[0.1em] transition-colors duration-300";

// The mockups' single button treatment: uppercase, letter-spaced, square
// corners (rounded-property is 0px for every property), no rounded pill
// except where a component opts in explicitly. Renders as a Link when
// `href` is present, a native button otherwise.
export function PropertyButton({
  variant = "primary",
  size = "default",
  children,
  className,
  href,
  ...rest
}: PropertyButtonOwnProps &
  ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement> | { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)) {
  const classes = cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], "rounded-property", className);

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

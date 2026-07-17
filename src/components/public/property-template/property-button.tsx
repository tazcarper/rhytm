import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui";

type PropertyButtonVariant = "primary" | "secondary" | "ghost";

interface PropertyButtonOwnProps {
  variant?: PropertyButtonVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<PropertyButtonVariant, string> = {
  primary: "bg-property-accent text-property-ink hover:bg-property-accent-dark",
  secondary: "bg-property-bg text-property-ink hover:bg-property-surface-highest",
  ghost: "bg-transparent text-property-ink border-b border-property-ink hover:border-property-camel",
};

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 px-10 py-5 font-property-sans font-semibold text-[13px] uppercase tracking-[0.1em] transition-colors duration-300";

// The mockups' single button treatment: uppercase, letter-spaced, square
// corners (rounded-property is 0px for every property), no rounded pill
// except where a component opts in explicitly. Renders as a Link when
// `href` is present, a native button otherwise.
export function PropertyButton({
  variant = "primary",
  children,
  className,
  href,
  ...rest
}: PropertyButtonOwnProps &
  ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement> | { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)) {
  const classes = cn(BASE_CLASS, VARIANT_CLASS[variant], "rounded-property", className);

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

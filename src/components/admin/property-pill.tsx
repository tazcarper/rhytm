import { cn } from "@/lib/ui";
import s from "./property-pill.module.css";

const SLUG_TO_VARIANT: Record<string, string> = {
  "horseshoe-bay": s.hsb,
  "hog-heaven": s.hog,
  packsaddle: s.pack,
};

export function propertyVariant(slug: string): string {
  return SLUG_TO_VARIANT[slug] ?? s.neutral;
}

interface PropertyPillProps {
  name: string;
  slug: string;
  /** Show a small color-dot inline with the label. Useful when the pill
      sits in a tight list where the background tint alone is too subtle. */
  withDot?: boolean;
  /** Borderless variant — for headings where the pill text + dot is the
      only signal, no background fill. */
  bare?: boolean;
  className?: string;
}

export function PropertyPill({
  name,
  slug,
  withDot = false,
  bare = false,
  className,
}: PropertyPillProps) {
  return (
    <span
      className={cn(s.pill, propertyVariant(slug), bare && s.bare, className)}
    >
      {withDot && <span className={s.dot} aria-hidden="true" />}
      {name}
    </span>
  );
}

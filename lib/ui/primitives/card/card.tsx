import { Slot } from "@radix-ui/react-slot";
import { type HTMLAttributes, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./card.module.css";

export type CardElevation = "flat" | "soft" | "lift";
export type CardPadding = "tight" | "default" | "loose";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /** Visual elevation — flat (no shadow), soft (default), lift (heavier). */
  elevation?: CardElevation;
  /** Use the warmer cream-paper background. */
  warm?: boolean;
  /** Apply hover styles. Pair with `asChild` (or an interactive child) so
      the hover affordance maps to a real keyboard/click target. */
  hoverable?: boolean;
  padding?: CardPadding;
  /** Render via Radix Slot so the card styles apply to the single child
      element (e.g. a Next.js <Link>). Required for `hoverable` to be
      anything other than cosmetic. */
  asChild?: boolean;
}

export function Card({
  ref,
  elevation = "soft",
  warm = false,
  hoverable = false,
  padding = "default",
  asChild = false,
  className,
  children,
  ...rest
}: CardProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      ref={ref}
      className={cn(
        s.card,
        warm && s.warm,
        elevation === "flat" && s.flat,
        elevation === "lift" && s.lift,
        hoverable && s.hoverable,
        padding === "tight" && s.padTight,
        padding === "loose" && s.padLoose,
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

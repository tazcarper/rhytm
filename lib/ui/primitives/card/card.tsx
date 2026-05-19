import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual elevation — flat (no shadow), soft (default), lift (heavier). */
  elevation?: "flat" | "soft" | "lift";
  /** Use the warmer cream-paper background. */
  warm?: boolean;
  hoverable?: boolean;
  padding?: "tight" | "default" | "loose";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    elevation = "soft",
    warm = false,
    hoverable = false,
    padding = "default",
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <div
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
    </div>
  );
});

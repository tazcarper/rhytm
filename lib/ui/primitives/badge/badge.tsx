import type { HTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./badge.module.css";

export type BadgeVariant =
  | "neutral"
  | "open"
  | "filling"
  | "waitlist"
  | "full"
  | "past"
  | "draft"
  | "tierFounder"
  | "tierCharter"
  | "tierMember"
  | "tierLegacy";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
  variant?: BadgeVariant;
  /** Pill shape (rounded full) — used for tier indicators. */
  pill?: boolean;
}

export function Badge({
  ref,
  variant = "neutral",
  pill = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      ref={ref}
      className={cn(s.badge, s[variant], pill && s.pill, className)}
      {...rest}
    >
      {children}
    </span>
  );
}

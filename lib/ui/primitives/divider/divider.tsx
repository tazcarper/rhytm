import type { HTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./divider.module.css";

export type DividerVariant = "rule" | "accent";

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  ref?: Ref<HTMLHRElement>;
  /** "rule" (full-width thin line) | "accent" (centered 50px tan accent). */
  variant?: DividerVariant;
  thick?: boolean;
}

export function Divider({
  ref,
  variant = "rule",
  thick = false,
  className,
  ...rest
}: DividerProps) {
  return (
    <hr
      ref={ref}
      className={cn(
        variant === "rule" && s.rule,
        variant === "accent" && s.accent,
        thick && s.thick,
        className,
      )}
      {...rest}
    />
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./divider.module.css";

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  /** "rule" (full-width thin line) | "accent" (centered 50px tan accent). */
  variant?: "rule" | "accent";
  thick?: boolean;
}

export function Divider({
  variant = "rule",
  thick = false,
  className,
  ...rest
}: DividerProps) {
  return (
    <hr
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

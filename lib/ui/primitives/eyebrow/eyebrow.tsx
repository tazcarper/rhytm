import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./eyebrow.module.css";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  /** "default" (tan-deep) | "muted" (gray) | "crest" (serif with bullets). */
  variant?: "default" | "muted" | "crest";
  as?: "span" | "div" | "p";
}

// Small uppercase letter-spaced label. Used above headings, inside
// cards, anywhere editorial tag-text is needed. "crest" matches the
// `· Members' Entrance ·` ornament from the login card.
export function Eyebrow({
  variant = "default",
  as: Tag = "span",
  className,
  children,
  ...rest
}: EyebrowProps) {
  return (
    <Tag
      className={cn(
        s.eyebrow,
        variant === "muted" && s.muted,
        variant === "crest" && s.crest,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

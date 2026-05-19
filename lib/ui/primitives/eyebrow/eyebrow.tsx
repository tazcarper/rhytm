import { createElement, type HTMLAttributes, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./eyebrow.module.css";

export type EyebrowVariant = "default" | "muted" | "crest";
export type EyebrowTag = "span" | "div" | "p";

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  /** "default" (tan-deep) | "muted" (gray) | "crest" (serif with bullets). */
  variant?: EyebrowVariant;
  as?: EyebrowTag;
}

// Small uppercase letter-spaced label. Used above headings, inside
// cards, anywhere editorial tag-text is needed. "crest" matches the
// `· Members' Entrance ·` ornament from the login card. Rendered via
// `createElement` (rather than JSX `<Tag>`) so a polymorphic ref of
// `Ref<HTMLElement>` doesn't trip TS's intersection of element-specific
// ref types — same pattern Heading and PageShell use.
export function Eyebrow({
  ref,
  variant = "default",
  as = "span",
  className,
  children,
  ...rest
}: EyebrowProps) {
  return createElement(
    as,
    {
      ref,
      className: cn(
        s.eyebrow,
        variant === "muted" && s.muted,
        variant === "crest" && s.crest,
        className,
      ),
      ...rest,
    },
    children,
  );
}

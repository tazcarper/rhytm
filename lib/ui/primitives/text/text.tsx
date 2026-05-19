import { createElement, type HTMLAttributes, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./text.module.css";

export type TextVariant = "body" | "lead" | "caption";
export type TextTag = "p" | "div" | "span";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  /** "body" (default sans paragraph) | "lead" (serif italic deck) |
      "caption" (small sans helper text). */
  variant?: TextVariant;
  as?: TextTag;
}

// Prose primitive. Covers the three body-copy registers in the brand:
// the italic serif deck under a heading, the default sans paragraph,
// and the small helper line. Margins are intentionally not imposed —
// layout context owns spacing.
export function Text({
  ref,
  variant = "body",
  as = "p",
  className,
  children,
  ...rest
}: TextProps) {
  return createElement(
    as,
    {
      ref,
      className: cn(
        s.text,
        variant === "lead" && s.lead,
        variant === "caption" && s.caption,
        className,
      ),
      ...rest,
    },
    children,
  );
}

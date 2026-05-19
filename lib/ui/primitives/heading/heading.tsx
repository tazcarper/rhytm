import { createElement, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./heading.module.css";

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingSize = "display" | "h1" | "h2" | "h3" | "h4";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  ref?: Ref<HTMLHeadingElement>;
  /** Semantic level — picks h1 / h2 / h3 / h4. Defaults to 2. */
  level?: HeadingLevel;
  /** Visual size — defaults to match level, override for headlines
      that need bigger or smaller styling than their semantic level. */
  size?: HeadingSize;
  underline?: boolean;
  center?: boolean;
  children: ReactNode;
}

// Serif heading. Wraps emphasis in <em> for the italic tan accent the
// brand uses ("Horseshoe Bay /Sporting Club/"). Pass JSX containing
// <em> tags; the styling cascades automatically.
export function Heading({
  ref,
  level = 2,
  size,
  underline,
  center,
  className,
  children,
  ...rest
}: HeadingProps) {
  const sizeClass = size ?? (`h${level}` as HeadingSize);
  return createElement(
    `h${level}`,
    {
      ref,
      className: cn(
        s.heading,
        s[sizeClass],
        underline && s.underline,
        center && s.center,
        className,
      ),
      ...rest,
    },
    children,
  );
}

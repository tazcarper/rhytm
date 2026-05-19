import { createElement, type HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./page-shell.module.css";

type ShellTag = "main" | "div" | "section" | "article";

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Max content width preset. */
  width?: "narrow" | "wide" | "prose";
  /** Render a full-bleed dark olive background (login / 404 surface). */
  dark?: boolean;
  /** Render the subtle dot grid over a dark background. */
  dotGrid?: boolean;
  center?: boolean;
  /** Semantic element. Defaults to <main> for top-of-page wrappers;
      override to "div" or "section" when nesting (e.g. inside another
      PageShell as a preview / demo region). */
  as?: ShellTag;
}

// Layout primitive. "Light" mode renders a centered max-width column
// for normal content. "Dark" mode renders a full-bleed olive
// background with a centered child — used for login, 404, anywhere
// the user is outside an authenticated portal.
export function PageShell({
  width = "wide",
  dark = false,
  dotGrid = false,
  center = false,
  as = "main",
  className,
  children,
  ...rest
}: PageShellProps) {
  const className_ = dark
    ? cn(s.dark, dotGrid && s.dotGrid, className)
    : cn(s.shell, s[width], center && s.center, className);
  return createElement(as, { className: className_, ...rest }, children);
}

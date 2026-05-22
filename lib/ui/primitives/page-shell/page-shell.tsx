import { createElement, type HTMLAttributes, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./page-shell.module.css";

export type PageShellTag = "main" | "div" | "section" | "article";
export type PageShellWidth = "narrow" | "wide" | "xl" | "prose";

type PageShellBase = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement>;
  /** Semantic element. Defaults to <main> for top-of-page wrappers;
      override to "div" / "section" when nesting (e.g. inside another
      PageShell as a preview region). */
  as?: PageShellTag;
};

type LightShellProps = PageShellBase & {
  dark?: false;
  /** Max content width preset. */
  width?: PageShellWidth;
  center?: boolean;
};

type DarkShellProps = PageShellBase & {
  /** Full-bleed dark olive background (login / 404 / unauthorized). */
  dark: true;
  /** Render a subtle dot grid over the dark surface. */
  dotGrid?: boolean;
};

export type PageShellProps = LightShellProps | DarkShellProps;

// Layout primitive. The two modes are intentionally exclusive:
// `width` / `center` apply only to the light surface, `dotGrid` only
// to the dark surface. The discriminated union makes mismatched props
// a type error rather than a silent no-op.
export function PageShell(props: PageShellProps) {
  if (props.dark) {
    const { ref, as = "main", dark: _dark, dotGrid, className, children, ...rest } =
      props;
    return createElement(
      as,
      {
        ref,
        className: cn(s.dark, dotGrid && s.dotGrid, className),
        ...rest,
      },
      children,
    );
  }

  const {
    ref,
    as = "main",
    width = "wide",
    center = false,
    className,
    children,
    ...rest
  } = props;
  return createElement(
    as,
    {
      ref,
      className: cn(s.shell, s[width], center && s.center, className),
      ...rest,
    },
    children,
  );
}

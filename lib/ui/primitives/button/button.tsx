import { Slot } from "@radix-ui/react-slot";
import { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render through Radix Slot so the styles apply to a child element
      (e.g. a Next.js <Link>). The single child must be a valid element. */
  asChild?: boolean;
  /** Renders an inline spinner and disables the button. */
  loading?: boolean;
  /** Inline element placed before children (icons, brand marks).
      Ignored when `asChild` is true — Slot requires a single child. */
  leading?: ReactNode;
  /** Stretch to fill the parent block. */
  fullWidth?: boolean;
}

export function Button({
  ref,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  leading,
  fullWidth = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Radix `Slot` requires exactly one React element child so it can
  // clone styles/props onto it. When `asChild` is set, the consumer
  // owns composition — `leading` is a plain-button-only affordance.
  const content = asChild ? (
    children
  ) : (
    <>
      {leading}
      {children}
    </>
  );
  return (
    <Comp
      ref={ref}
      className={cn(
        s.button,
        s[variant],
        s[size],
        loading && s.loading,
        fullWidth && s.fullWidth,
        className,
      )}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {content}
    </Comp>
  );
}

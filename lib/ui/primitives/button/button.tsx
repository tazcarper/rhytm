import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import s from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render through Radix Slot so the styles apply to a child element
      (e.g. a Next.js <Link>). The single child must be a valid element. */
  asChild?: boolean;
  /** Renders an inline spinner and disables the button. */
  loading?: boolean;
  /** Inline element placed before children (icons, brand marks). */
  leading?: ReactNode;
  /** Stretch to fill the parent block. */
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
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
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
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
        disabled={disabled || loading}
        {...rest}
      >
        {leading}
        {children}
      </Comp>
    );
  },
);

"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./alert.module.css";

export type AlertVariant = "error" | "warn" | "info" | "success";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  ref?: Ref<HTMLDivElement>;
  variant?: AlertVariant;
  title?: ReactNode;
  // Client-only: passing a function turns Alert into an interactive
  // dismissible banner. Server Component callers should leave this
  // undefined (functions aren't serializable across the RSC boundary).
  onDismiss?: () => void;
}

// Left-border banner. Marked "use client" because the dismiss control
// uses an onClick handler — even when onDismiss isn't provided, the
// JSX shape forces a client module under the App Router.
export function Alert({
  ref,
  variant = "info",
  title,
  onDismiss,
  className,
  children,
  ...rest
}: AlertProps) {
  return (
    <div
      ref={ref}
      role={variant === "error" ? "alert" : "status"}
      className={cn(s.alert, s[variant], className)}
      {...rest}
    >
      <div className={s.body}>
        {title && <span className={s.title}>{title}</span>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className={s.dismiss}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}

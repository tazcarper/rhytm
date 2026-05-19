import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import s from "./alert.module.css";

export type AlertVariant = "error" | "warn" | "info" | "success";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
  onDismiss?: () => void;
}

// Left-border banner. Used for callbacks from server actions (login
// "invite not found"), inline form errors that need more breathing
// room than FormField gives them, success confirmations, etc.
export function Alert({
  variant = "info",
  title,
  onDismiss,
  className,
  children,
  ...rest
}: AlertProps) {
  return (
    <div
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

import type { ButtonHTMLAttributes } from "react";
import f from "./event-flow.module.css";

// Button for the event pages' larger look (event-flow.module.css): sentence
// case, 48–56px targets. Same variant names as the shared Button so the
// event components can swap it in; the shared primitive is unchanged
// everywhere else.
type FlowButtonVariant = "primary" | "secondary" | "ghost" | "link";

const VARIANT_CLASS: Record<FlowButtonVariant, string> = {
  primary: f.primary,
  secondary: f.secondary,
  ghost: f.quiet,
  link: f.quiet,
};

export interface FlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FlowButtonVariant;
  // Accepted for drop-in compatibility; every event-page button is full size.
  size?: "sm" | "md" | "lg";
}

export function FlowButton({ variant = "primary", size: _size, className, type = "button", ...rest }: FlowButtonProps) {
  return <button type={type} className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")} {...rest} />;
}

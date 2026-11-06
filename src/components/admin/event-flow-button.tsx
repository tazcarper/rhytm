import type { ButtonHTMLAttributes } from "react";
import { Plus } from "lucide-react";
import f from "./event-flow.module.css";

// Button for the event pages' larger look (event-flow.module.css): sentence
// case, 48–56px targets. Same variant names as the shared Button so the
// event components can swap it in; the shared primitive is unchanged
// everywhere else.
//
// "add" is for "Add a ticket option"-style buttons that add a row to a
// list: a dashed outline with a plus, so it can't be mistaken for a text
// box (which is white with a solid border).
type FlowButtonVariant = "primary" | "secondary" | "add" | "ghost" | "link";

const VARIANT_CLASS: Record<FlowButtonVariant, string> = {
  primary: f.primary,
  secondary: f.secondary,
  add: f.add,
  ghost: f.quiet,
  link: f.quiet,
};

export interface FlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FlowButtonVariant;
  // Accepted for drop-in compatibility; every event-page button is full size.
  size?: "sm" | "md" | "lg";
}

export function FlowButton({ variant = "primary", size: _size, className, type = "button", children, ...rest }: FlowButtonProps) {
  return (
    <button type={type} className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")} {...rest}>
      {variant === "add" && <Plus aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2.25} />}
      {children}
    </button>
  );
}

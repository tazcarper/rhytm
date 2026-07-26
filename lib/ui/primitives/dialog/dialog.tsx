"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import s from "./dialog.module.css";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  /** Set false for flows where an accidental backdrop click or Escape is costly. */
  closeOnBackdrop?: boolean;
  className?: string;
}

// Shared full-page admin dialog. Centered over a scrim, with a real Radix
// focus trap (focus enters on open, returns to the trigger on close) instead
// of hand-rolled Escape/backdrop wiring. Drop any content in as `children`;
// use the optional `footer` slot for primary/secondary actions.
export function Dialog({
  title,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={s.backdrop} />
        <RadixDialog.Content
          className={cn(s.modal, s[size], className)}
          onPointerDownOutside={(event) => {
            if (!closeOnBackdrop) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!closeOnBackdrop) event.preventDefault();
          }}
        >
          <div className={s.head}>
            <RadixDialog.Title className={s.title}>{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button type="button" className={s.closeBtn} aria-label="Close">
                ✕
              </button>
            </RadixDialog.Close>
          </div>
          <div className={s.body}>{children}</div>
          {footer && <div className={s.footer}>{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

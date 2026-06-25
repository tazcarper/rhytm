"use client";

import { useEffect, useId, type ReactNode } from "react";
import s from "./admin-modal.module.css";

export type AdminModalSize = "sm" | "md" | "lg";

// Shared full-page admin modal. Centered dialog over a scrim, with Escape /
// backdrop close and body-scroll lock. Drop any content in as `children`; use
// the optional `footer` slot for primary/secondary actions. Reusable anywhere
// in the admin (create flows, editors, confirmations, detail popovers).
export function AdminModal({
  title,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: AdminModalSize;
  /** Set false for flows where an accidental backdrop click is costly. */
  closeOnBackdrop?: boolean;
}) {
  const titleId = useId();

  // Escape to close + lock body scroll while the overlay is up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className={s.backdrop}
        aria-label="Close"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div className={`${s.modal} ${s[size]}`}>
        <div className={s.head}>
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          <button
            type="button"
            className={s.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import s from "./bid-content-drawer.module.css";

// A right-hand slide-over that hosts the experience / add-on editor inside the
// property workspace, so editing never leaves the page. Open/close is fully
// controlled by the workspace (which also keeps the URL in sync for deep
// links). Shares the visual shell with the bid content drawer.
export function CatalogItemDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
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
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className={s.backdrop}
        aria-label="Close"
        onClick={onClose}
      />
      <div className={s.panel}>
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>{title}</h2>
          <button
            type="button"
            className={s.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className={s.panelBody}>{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicAddOn } from "@/src/services/public/services";
import s from "./add-on-detail-tooltip.module.css";

// Informational add-on detail tooltip for the booking funnel. Opens on hover
// (desktop) and on tap of the add-on name (touch) — orchestrated by the host
// row, which owns the open/close timing so the hover-bridge (move from the
// trigger onto the tooltip without it closing) works. This component is the
// presenter + positioner: it renders the popover, places it next to its
// anchor, and light-dismisses on Esc / outside pointer-down.
//
// Rendered with the native popover API (`popover="manual"`) so it lives in the
// browser's top layer — never clipped by the scrolling discipline card. We use
// "manual" (not "auto") because we drive show/hide from hover + tap ourselves;
// auto's built-in light dismiss fights the open-on-hover gesture.

interface AddOnDetailTooltipProps {
  /** The add-on to describe, or `null` when closed. */
  addOn: PublicAddOn | null;
  /** The element the tooltip is positioned against (name or info button). */
  anchor: HTMLElement | null;
  /** Light-dismiss request (Esc / outside pointer-down). */
  onClose: () => void;
  /** Pointer entered the tooltip — host cancels its pending close. */
  onPointerEnter: () => void;
  /** Pointer left the tooltip — host schedules a close. */
  onPointerLeave: () => void;
}

type ImageStatus = "loading" | "loaded" | "error";

const VIEWPORT_MARGIN = 8;

export function AddOnDetailTooltip({
  addOn,
  anchor,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: AddOnDetailTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>("loading");
  const open = Boolean(addOn && anchor);

  // Place the tooltip below its anchor (flipping above when there's no room),
  // horizontally centered on the anchor and clamped to the viewport.
  const reposition = () => {
    const el = ref.current;
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = a.bottom + VIEWPORT_MARGIN;
    const flipsBelowOffscreen = top + tipH > vh - VIEWPORT_MARGIN;
    const roomAbove = a.top - VIEWPORT_MARGIN - tipH > VIEWPORT_MARGIN;
    if (flipsBelowOffscreen && roomAbove) {
      top = a.top - VIEWPORT_MARGIN - tipH;
    }

    let left = a.left + a.width / 2 - tipW / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - tipW - VIEWPORT_MARGIN));

    el.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
    el.style.left = `${left}px`;
  };

  // Show / hide the popover in step with `open`, and (re)position on show.
  // A fresh add-on resets the image to its loading state.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      setImageStatus("loading");
      try {
        if (!el.matches(":popover-open")) el.showPopover();
      } catch {
        /* popover API unsupported — tooltip simply won't show */
      }
      reposition();
    } else {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
      } catch {
        /* no-op */
      }
    }
    // anchor identity changing (hovering a different row) repositions too.
  }, [open, addOn, anchor]);

  // Keep it pinned to the anchor while open.
  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchor]);

  // Light dismiss: Esc and outside pointer-down (ignoring the anchor, whose own
  // handler toggles).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: PointerEvent) => {
      const el = ref.current;
      const target = event.target as Node;
      if (el?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, anchor, onClose]);

  const hasPhoto = Boolean(addOn?.imageUrl);

  return (
    <div
      ref={ref}
      // eslint-disable-next-line react/no-unknown-property
      popover="manual"
      className={s.tooltip}
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {addOn && (
        <>
          <div className={s.media} data-state={hasPhoto ? imageStatus : "placeholder"}>
            {hasPhoto ? (
              <>
                {imageStatus !== "loaded" && (
                  <span className={s.skeleton} aria-hidden="true" />
                )}
                <img
                  className={s.photo}
                  src={addOn.imageUrl ?? undefined}
                  alt=""
                  data-status={imageStatus}
                  onLoad={() => setImageStatus("loaded")}
                  onError={() => setImageStatus("error")}
                />
                {imageStatus === "error" && <PlaceholderScene />}
              </>
            ) : (
              <PlaceholderScene />
            )}
          </div>

          <div className={s.body}>
            <h3 className={s.title}>{addOn.name}</h3>
            {addOn.description && <p className={s.lead}>{addOn.description}</p>}
            <div className={s.priceRow}>
              <span className={s.price}>${addOn.price.toFixed(0)}</span>
              {addOn.includedDetail && (
                <span className={s.included}>{addOn.includedDetail}</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Branded duotone landscape shown until a real photo is supplied (and as the
// fallback if one fails to load). Matches the funnel's estate palette.
function PlaceholderScene() {
  return (
    <div className={s.placeholder} aria-hidden="true">
      <svg
        className={s.placeholderArt}
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <rect width="160" height="100" fill="#f5f1e5" />
        <circle cx="120" cy="30" r="14" fill="#b89c73" opacity="0.55" />
        <path d="M0 70 L46 44 L86 66 L118 48 L160 72 L160 100 L0 100 Z" fill="#3f4a21" opacity="0.22" />
        <path d="M0 84 L34 62 L70 80 L104 60 L140 82 L160 74 L160 100 L0 100 Z" fill="#3f4a21" opacity="0.4" />
        <path d="M0 100 L26 80 L60 94 L96 78 L132 96 L160 86 L160 100 Z" fill="#3f4a21" opacity="0.66" />
      </svg>
    </div>
  );
}

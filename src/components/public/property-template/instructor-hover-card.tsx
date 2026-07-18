"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicInstructor } from "@/src/services/public/instructors";
import { PersonAvatar } from "./person-avatar";
import s from "./instructor-hover-card.module.css";

const VIEWPORT_MARGIN = 8;
const CLOSE_DELAY = 140;

// Hover/focus card for a name in the event detail page's Instructors row —
// opens on mouse hover or keyboard focus, taps toggle it on touch (hover
// doesn't exist there). Uses the native popover API so the card renders in
// the browser's top layer (never clipped by an ancestor) with JS-computed
// fixed positioning that flips above the trigger and clamps to the
// viewport, same approach as the booking funnel's AddOnDetailTooltip.
// Self-contained (no shared host state) since at most a couple of these
// ever render on one page — unlike the funnel's scrolling add-on list,
// there's no need to coordinate a single shared close-timer across rows.
export function InstructorHoverCard({ instructor }: { instructor: PublicInstructor }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function openNow() {
    cancelClose();
    setOpen(true);
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
  }
  function closeNow() {
    cancelClose();
    setOpen(false);
  }

  function reposition() {
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger || !card) return;
    const anchor = trigger.getBoundingClientRect();
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = anchor.bottom + VIEWPORT_MARGIN;
    const flipsBelowOffscreen = top + cardHeight > viewportHeight - VIEWPORT_MARGIN;
    const roomAbove = anchor.top - VIEWPORT_MARGIN - cardHeight > VIEWPORT_MARGIN;
    if (flipsBelowOffscreen && roomAbove) {
      top = anchor.top - VIEWPORT_MARGIN - cardHeight;
    }

    let left = anchor.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - cardWidth - VIEWPORT_MARGIN));

    card.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
    card.style.left = `${left}px`;
  }

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (open) {
      try {
        if (!el.matches(":popover-open")) el.showPopover();
      } catch {
        /* popover API unsupported — card simply won't show */
      }
      reposition();
    } else {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
      } catch {
        /* no-op */
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (cardRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeNow();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  // Hover opens on mouse only; tap (touch/pen) toggles on click. A tap
  // fires pointerenter before click, so without the pointerType check a
  // touch would open-then-immediately-close.
  function handlePointerEnter(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") openNow();
  }
  function handlePointerLeave(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") scheduleClose();
  }
  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if ((event.nativeEvent as PointerEvent).pointerType === "mouse") return;
    setOpen((current) => !current);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="underline decoration-dotted decoration-property-ink/40 underline-offset-4 transition-colors hover:text-property-accent-dark focus-visible:text-property-accent-dark focus-visible:outline-none"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onFocus={openNow}
        onBlur={scheduleClose}
        aria-expanded={open}
      >
        {instructor.name}
      </button>
      <div
        ref={cardRef}
        // eslint-disable-next-line react/no-unknown-property
        popover="manual"
        role="tooltip"
        className={`${s.card} w-80 max-w-[calc(100vw-16px)] border border-property-ink/10 bg-property-surface-lowest p-5 shadow-lift`}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <div className="flex items-center gap-4">
          <PersonAvatar name={instructor.name} photoUrl={instructor.photoUrl} className="size-16 rounded-full" />
          <p className="property-headline font-property-display text-lg uppercase leading-tight text-property-ink">
            {instructor.name}
          </p>
        </div>
        <p className="mt-4 line-clamp-6 font-property-sans text-[13px] leading-relaxed text-property-ink-variant">
          {instructor.bio || "Bio coming soon."}
        </p>
        {instructor.disciplines.length > 0 && (
          <p className="mt-3 font-property-sans text-[11px] uppercase tracking-widest text-property-accent-dark">
            {instructor.disciplines.join(" · ")}
          </p>
        )}
      </div>
    </>
  );
}

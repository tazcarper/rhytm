"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { cn } from "./utils";

// A small ⓘ button that shows an explanation on hover, focus or tap. The
// bubble is drawn in a portal with fixed positioning, so it isn't clipped
// by scrolling containers such as data tables.
const BUBBLE_WIDTH = 288;
const GAP = 8;

function InfoTip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - BUBBLE_WIDTH / 2), window.innerWidth - BUBBLE_WIDTH - GAP);
    setPosition({ top: rect.bottom + GAP, left });
  };
  const hide = () => setPosition(null);

  React.useEffect(() => {
    if (!position) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [position]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (position ? hide() : show())}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-gray hover:text-olive-darker focus-visible:outline-2 focus-visible:outline-olive",
          className,
        )}
      >
        <Info size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ top: position.top, left: position.left, width: BUBBLE_WIDTH }}
            className="pointer-events-none fixed z-50 rounded-[10px] bg-olive-darker px-3.5 py-3 text-left text-[13px] font-normal normal-case leading-[1.45] tracking-normal text-white shadow-lg"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export { InfoTip };

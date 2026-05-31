"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";
import s from "./sticky-header.module.css";

// Below this scroll position the header is always shown — near the top
// of the page there's nothing to gain by hiding it.
const REVEAL_AT_TOP_PX = 80;
// Ignore sub-pixel / jitter scrolls so the bar doesn't flicker.
const DIRECTION_THRESHOLD_PX = 6;

// Sticky chrome wrapper with a "smart" hide-on-scroll behavior: pins to
// the top, slides up out of view when the reader scrolls down, and slides
// back in the moment they scroll up. Purely presentational — it takes the
// already-rendered header as children, so the server component that owns
// the header's data fetch stays untouched (single responsibility).
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    let ticking = false;

    const evaluate = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      if (currentScrollY < REVEAL_AT_TOP_PX) {
        setHidden(false);
      } else if (delta > DIRECTION_THRESHOLD_PX) {
        setHidden(true); // scrolling down — get out of the way
      } else if (delta < -DIRECTION_THRESHOLD_PX) {
        setHidden(false); // scrolling up — come back
      }

      lastScrollY.current = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(evaluate);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <div className={cn(s.sticky, hidden && s.hidden)}>{children}</div>;
}

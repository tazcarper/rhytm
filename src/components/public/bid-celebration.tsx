"use client";

import { useEffect, useState, type CSSProperties } from "react";
import s from "./bid-celebration.module.css";

// One-shot confetti burst for the fully-finalized bid (deposit paid + waiver
// signed). CSS-only — no animation library — to match the project's
// vanilla-CSS-modules approach.
//
// Fires ONCE per bid: the first time the finalized state mounts in this
// browser we rain confetti and persist a flag keyed by the bid slug, so the
// guest can reload / revisit the saved link without it replaying every time.
// Polling-driven re-renders (router.refresh) keep the React tree mounted, so
// the burst lands exactly when the bid transitions to finalized, not on each
// refresh tick.
//
// Honors prefers-reduced-motion: motion-averse guests get the calm finalized
// banner with no confetti at all.

const PIECE_COUNT = 56;

// Brand palette — referenced as CSS vars so the confetti stays on-brand if
// the tokens are ever retuned.
const COLORS = [
  "var(--olive)",
  "var(--tan)",
  "var(--tan-deep)",
  "var(--accent-success)",
  "var(--cream)",
  "var(--gray-light)",
];

interface ConfettiPiece {
  id: number;
  left: number; // vw start position
  delay: number; // s
  duration: number; // s
  width: number; // px
  height: number; // px
  color: string;
  drift: number; // px horizontal travel
  spin: number; // deg total rotation
}

export function BidCelebration({ celebrationKey }: { celebrationKey: string }) {
  const [pieces, setPieces] = useState<ReadonlyArray<ConfettiPiece> | null>(
    null,
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const storageKey = `rythm:bid-celebrated:${celebrationKey}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, "1");
    } catch {
      // Private mode / storage disabled: celebrate this once anyway rather
      // than suppress it.
    }

    const generated: ConfettiPiece[] = Array.from(
      { length: PIECE_COUNT },
      (_, i) => {
        const width = 7 + Math.random() * 8;
        return {
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.6,
          duration: 2.6 + Math.random() * 1.6,
          width,
          height: width * (0.35 + Math.random() * 0.25),
          color: COLORS[i % COLORS.length],
          drift: (Math.random() - 0.5) * 160,
          spin: (Math.random() - 0.5) * 720,
        };
      },
    );
    setPieces(generated);

    // Unmount after the longest piece finishes so we don't leave dead nodes
    // (max delay 0.6s + max duration 4.2s, with headroom).
    const timer = window.setTimeout(() => setPieces(null), 5200);
    return () => window.clearTimeout(timer);
  }, [celebrationKey]);

  if (pieces === null) return null;

  return (
    <div className={s.overlay} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={s.piece}
          style={
            {
              left: `${piece.left}vw`,
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--drift": `${piece.drift}px`,
              "--spin": `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

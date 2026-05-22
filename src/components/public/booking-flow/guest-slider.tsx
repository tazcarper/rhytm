"use client";

import type { ChangeEvent, CSSProperties } from "react";
import s from "./guest-slider.module.css";

interface GuestSliderProps {
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  /** Used for ARIA on the buttons and range input. */
  label: string;
}

// Visual: [ − ] ─●━━━━━○━━━━━━━━ [ + ]
// The native <input type=range> sits invisibly on top of a styled track so
// click/drag/keyboard work out-of-the-box; the visible thumb circle is
// positioned with a CSS variable derived from the current value.
export function GuestSlider({
  value,
  min = 1,
  max,
  onChange,
  label,
}: GuestSliderProps) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  function handleRange(e: ChangeEvent<HTMLInputElement>) {
    const n = Number(e.target.value);
    if (Number.isFinite(n)) onChange(n);
  }

  function bump(delta: number) {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  }

  return (
    <div
      className={s.root}
      style={{ "--pct": `${pct}%` } as CSSProperties}
    >
      <button
        type="button"
        className={s.btn}
        onClick={() => bump(-1)}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>

      <div className={s.trackWrap}>
        <div className={s.trackBg} aria-hidden="true" />
        <div className={s.trackFill} aria-hidden="true" />
        <div className={s.thumb} aria-hidden="true">
          {value}
        </div>
        <input
          type="range"
          className={s.range}
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={handleRange}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>

      <button
        type="button"
        className={s.btn}
        onClick={() => bump(1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

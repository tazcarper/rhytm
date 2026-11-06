"use client";

import type { ReactNode } from "react";
import s from "./event-flow.module.css";

// One optional feature on an event step (early-bird pricing now; group
// discounts, waitlists and so on later). Off, it's a single line: a switch,
// a name and what it does. On, its fields open underneath. This keeps a
// step short however many options the builder grows: staff only see the
// fields for what they've switched on.

export function EventOptionPanel({
  title,
  summary,
  on,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={[s.option, on ? s.optionOn : ""].filter(Boolean).join(" ")}>
      <label className={s.optionHead}>
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          checked={on}
          onChange={(evt) => onToggle(evt.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-olive"
        />
        <span className="flex flex-col gap-1">
          <span className={s.groupTitle}>{title}</span>
          <span className={s.sectionDesc}>{summary}</span>
        </span>
      </label>
      {on && <div className={s.optionBody}>{children}</div>}
    </div>
  );
}

import type { ReactNode } from "react";
import s from "./adventure-attributes.module.css";

// "Type of stay" icon system for adventures. Each attribute key maps to a
// label + a stroke SVG glyph (24×24, inherits stroke/fill from the parent
// <svg>). Stored as keys in member_adventures.details.attributes; the
// detail page renders them as an at-a-glance strip. Unknown keys are
// skipped, so the catalog can grow without breaking older content.

const ICON: Record<string, ReactNode> = {
  wingshooting: (
    <path d="M20 4C9 4 4 12 4 20c8 0 16-5 16-16zM4 20l8-8M12 12l5 .5M12 12l.5-5" />
  ),
  "big-game": (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4M12 10v4M10 12h4" />
    </>
  ),
  "sporting-clays": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  fishing: (
    <path d="M3 12c4-5 14-5 18 0-4 5-14 5-18 0zM21 12l1.5-1.5M21 12l1.5 1.5M8 11.5v.01" />
  ),
  lodge: <path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" />,
  camping: <path d="M12 3L3 20h18L12 3zM12 9l-4 11M12 9l4 11" />,
  "all-inclusive": (
    <path d="M6 3v8a2 2 0 004 0V3M8 11v10M17 3c-1.5 0-2 2-2 5s.5 4 2 4M17 3v18" />
  ),
  "warm-climate": (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
  "cold-climate": (
    <path d="M12 2v20M3 7l18 10M21 7L3 17M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M4 8.5L4 5.5l2.6 1.5M20 15.5l0 3-2.6-1.5M20 8.5l0-3-2.6 1.5M4 15.5l0 3 2.6-1.5" />
  ),
  temperate: (
    <path d="M11 21c-5-1-8-5-8-10C8 11 11 14 11 21zM13 21c5-1 8-5 8-10-5 0-8 3-8 10zM12 21V9" />
  ),
  guided: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  travel: <path d="M2 13l20-7-7 20-3-8-8-3z" />,
  water: <path d="M3 8c3-3 6 3 9 0s6-3 9 0M3 14c3-3 6 3 9 0s6-3 9 0" />,
  "multi-day": <path d="M20 14a8 8 0 11-9-11 7 7 0 009 11z" />,
  "dog-work": (
    <>
      <circle cx="7" cy="9" r="1.6" />
      <circle cx="17" cy="9" r="1.6" />
      <circle cx="4.5" cy="13.5" r="1.4" />
      <circle cx="19.5" cy="13.5" r="1.4" />
      <path d="M12 13c-2.5 0-4.5 2-4.5 4S9.5 22 12 22s4.5-3 4.5-5-2-4-4.5-4z" />
    </>
  ),
};

const LABEL: Record<string, string> = {
  wingshooting: "Wingshooting",
  "big-game": "Big game",
  "sporting-clays": "Sporting clays",
  fishing: "Fishing",
  lodge: "Lodge stay",
  camping: "Camping",
  "all-inclusive": "All meals",
  "warm-climate": "Warm climate",
  "cold-climate": "Cold climate",
  temperate: "Temperate",
  guided: "Guided",
  travel: "Air travel",
  water: "On the water",
  "multi-day": "Multi-day",
  "dog-work": "Dog work",
};

export const ADVENTURE_ATTRIBUTE_KEYS = Object.keys(LABEL);

export function AdventureAttributes({ keys }: { keys: string[] }) {
  const known = keys.filter((key) => key in LABEL);
  if (known.length === 0) return null;

  return (
    <ul className={s.list} aria-label="What to expect">
      {known.map((key) => (
        <li key={key} className={s.item}>
          <svg
            className={s.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICON[key]}
          </svg>
          <span className={s.label}>{LABEL[key]}</span>
        </li>
      ))}
    </ul>
  );
}

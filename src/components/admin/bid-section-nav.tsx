"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import s from "./bid-section-nav.module.css";

export interface BidSection {
  id: string;
  label: string;
}

// Small inline icons (no icon dependency in the project). Stroke = currentColor
// so they inherit the active/inactive tab color.
const ICONS: Record<string, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <line x1="12" y1="7.5" x2="12" y2="8" />
    </>
  ),
  quote: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M16 7c0-2-2-3-4-3S8 5 8 7s2 3 4 3 4 1 4 3-2 3-4 3-4-1-4-3" />
    </>
  ),
  bidpage: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </>
  ),
  waiver: (
    <>
      <path d="M4 20h16" />
      <path d="M14 5.5l4 4-9 9H5v-4Z" />
    </>
  ),
  activity: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  actions: <path d="M13 3 4 14h7l-1 7 9-11h-7Z" />,
};

function SectionIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[id] ?? ICONS.info}
    </svg>
  );
}

// Page-scoped section navigation for the bid detail page. On desktop the nav is
// hidden and every section renders (the existing two-column layout, untouched).
// On tablet / mobile the long page collapses to one section at a time: tap an
// icon tab to swap sections. When the tabs can't fit the width, the bar becomes
// a dropdown instead. `children` is the existing layout; this component only
// wraps it and drives which section is shown via `data-active-section`.
export function BidSectionNav({
  sections,
  scopeClassName,
  children,
}: {
  sections: BidSection[];
  scopeClassName: string;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [overflow, setOverflow] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Switch tabs ⇆ dropdown based on whether the tabs actually fit. The tab row
  // keeps its intrinsic width whether shown (in flow) or hidden (absolute), so
  // comparing its content width to the available width is stable — no flip-flop.
  useEffect(() => {
    const nav = navRef.current;
    const tabs = tabsRef.current;
    if (!nav || !tabs) return;
    const measure = () => setOverflow(tabs.scrollWidth > nav.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [sections.length]);

  // Keep the active section valid if the section list changes (e.g. the waiver
  // tab appears/disappears).
  useEffect(() => {
    if (!sections.some((section) => section.id === activeId) && sections[0]) {
      setActiveId(sections[0].id);
    }
  }, [sections, activeId]);

  function onTabKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = sections[(index + delta + sections.length) % sections.length];
    if (next) setActiveId(next.id);
  }

  return (
    <>
      <div ref={navRef} className={s.nav} data-overflow={overflow}>
        <div
          ref={tabsRef}
          className={s.tabs}
          role="tablist"
          aria-label="Bid sections"
          aria-hidden={overflow}
        >
          {sections.map((section, index) => {
            const selected = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={selected ? `${s.tab} ${s.tabActive}` : s.tab}
                onClick={() => setActiveId(section.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                <span className={s.tabIcon}>
                  <SectionIcon id={section.id} />
                </span>
                <span className={s.tabLabel}>{section.label}</span>
              </button>
            );
          })}
        </div>

        <label className={s.select}>
          <span className={s.selectIcon}>
            <SectionIcon id={activeId} />
          </span>
          <select
            className={s.selectControl}
            aria-label="Jump to section"
            value={activeId}
            onChange={(event) => setActiveId(event.target.value)}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
          <span className={s.selectCaret} aria-hidden="true">
            ▾
          </span>
        </label>
      </div>

      <div className={scopeClassName} data-active-section={activeId}>
        {children}
      </div>
    </>
  );
}

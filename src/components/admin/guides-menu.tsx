"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";
import s from "./guides-menu.module.css";

interface GuideLink {
  label: string;
  href: string;
  hint: string;
}

// The published manual lives as static HTML in /public (served at /guide*.html),
// outside the Next.js app router — so these are plain anchors that open in a new
// tab. They're public (no login), which is what lets an admin paste a link to a
// staffer, instructor, or member and have it just work.
const GUIDE_LINKS: ReadonlyArray<GuideLink> = [
  { label: "All guides", href: "/guide.html", hint: "The manual hub" },
  { label: "Staff guide", href: "/guide-staff.html", hint: "Day-to-day for every staff role" },
  { label: "Admin & super-admin", href: "/guide-admin.html", hint: "The privileged controls" },
  { label: "Instructor guide", href: "/guide-instructor.html", hint: "The Gameplan portal" },
  { label: "Member guide", href: "/guide-member.html", hint: "For club members" },
  { label: "Guest guide", href: "/guide-public.html", hint: "Public booking" },
];

export function GuidesMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={s.container} ref={containerRef}>
      <button
        type="button"
        className={cn(s.trigger, isOpen && s.triggerOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Guides
        <span className={s.caret} aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className={s.menu} role="menu">
          <p className={s.menuHead}>Share with your team</p>
          {GUIDE_LINKS.map((guide) => (
            <a
              key={guide.href}
              className={s.menuLink}
              href={guide.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <span className={s.menuLinkLabel}>{guide.label}</span>
              <span className={s.menuLinkHint}>{guide.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

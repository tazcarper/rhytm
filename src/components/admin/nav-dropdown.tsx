"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";
import s from "./nav-dropdown.module.css";

export interface NavDropdownItem {
  label: string;
  href: string;
  /** Open in a new tab as a plain anchor (e.g. static files in /public). */
  external?: boolean;
}

interface NavDropdownProps {
  label: string;
  items: ReadonlyArray<NavDropdownItem>;
}

/**
 * A single top-level admin nav group that opens a menu of routes. Mirrors the
 * dismiss behaviour of GuidesMenu (outside-click + Escape) and lights up its
 * trigger when the current route lives under one of its internal items.
 */
export function NavDropdown({ label, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  const isItemActive = (item: NavDropdownItem) =>
    !item.external &&
    (pathname === item.href || pathname.startsWith(`${item.href}/`));

  const sectionActive = items.some(isItemActive);

  return (
    <div className={s.container} ref={containerRef}>
      <button
        type="button"
        className={cn(
          s.trigger,
          isOpen && s.triggerOpen,
          sectionActive && s.triggerActive,
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {label}
        <span className={s.caret} aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className={s.menu} role="menu">
          {items.map((item) =>
            item.external ? (
              <a
                key={item.href}
                className={s.menuLink}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                <span>{item.label}</span>
                <span className={s.externalIcon} aria-hidden="true">↗</span>
              </a>
            ) : (
              <Link
                key={item.href}
                className={cn(s.menuLink, isItemActive(item) && s.menuLinkActive)}
                href={item.href}
                role="menuitem"
                aria-current={isItemActive(item) ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                <span>{item.label}</span>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { DevNavItem } from "../_lib/types";
import s from "../dev.module.css";

// Grouped section navigation for the dev dashboard. Shows ONE section at a
// time by toggling the `hidden` attribute on the server-rendered
// `[data-dev-section]` panels (the panels stay server components — this is a
// thin client controller over them). Remembers the last section in
// localStorage + the URL hash, so a form submit (which reloads the page)
// returns you to where you were instead of the top.
//
// `items` is plain data passed from the server page, so this client module
// never imports the section components or the registry.
export function DevSidebar({
  items,
  defaultId,
}: {
  items: DevNavItem[];
  defaultId: string;
}) {
  const [active, setActive] = useState(defaultId);

  // On mount, prefer the URL hash, then the last-used section.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    const fromStore = window.localStorage.getItem("dev:section");
    const next =
      items.find((i) => i.id === fromHash)?.id ??
      items.find((i) => i.id === fromStore)?.id;
    if (next) setActive(next);
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect the active section onto the panels + persist it.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-dev-section]").forEach((el) => {
      el.hidden = el.getAttribute("data-dev-section") !== active;
    });
    window.localStorage.setItem("dev:section", active);
    try {
      window.history.replaceState(null, "", `#${active}`);
    } catch {
      /* no-op */
    }
  }, [active]);

  const groups: { group: string; items: DevNavItem[] }[] = [];
  for (const item of items) {
    let group = groups.find((g) => g.group === item.group);
    if (!group) {
      group = { group: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <nav className={s.sidebar} aria-label="Developer tools sections">
      {groups.map((group) => (
        <div key={group.group} className={s.sidebarGroup}>
          <div className={s.sidebarGroupLabel}>{group.group}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              aria-current={active === item.id ? "page" : undefined}
              className={`${s.sidebarLink} ${active === item.id ? s.sidebarLinkActive : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

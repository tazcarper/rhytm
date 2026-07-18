"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/ui";
import type { AdminProperty } from "@/src/services/admin/properties";
import type { AdminEventListRow } from "@/src/services/admin/events";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import type { PropertyPageKey } from "@/src/services/public/property-page-content";
type PropertyPageContentMap = Record<PropertyPageKey, Record<string, AdminPropertyPageSection | null>>;
import {
  DEFAULT_PROPERTY_SECTION,
  PROPERTY_SECTIONS,
  isPropertySectionKey,
  type PropertySectionKey,
} from "@/src/constants/admin/property-sections";
import { PropertyPageContentPanel } from "./property-page-content-panel";
import { PropertyBasicsPanel } from "./property-basics-panel";
import { EventsDataTable } from "./events-data-table";
import w from "./property-workspace.module.css";

interface PropertyWorkspaceProps {
  property: AdminProperty;
  pageContent: PropertyPageContentMap;
  upcomingEvents: ReadonlyArray<AdminEventListRow>;
}

// The URL is the single source of truth for which section is showing. We
// read it with usePathname and change it with `window.history.pushState` —
// Next keeps usePathname in sync, so tab switches re-render instantly with
// no server round-trip, while refresh / deep-link / browser back all "just
// work".
function parseSection(pathname: string, propertyId: string): PropertySectionKey {
  const prefix = `/admin/properties/${propertyId}`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const sectionRaw = rest.split("/").filter(Boolean)[0] ?? DEFAULT_PROPERTY_SECTION;
  return isPropertySectionKey(sectionRaw) ? sectionRaw : DEFAULT_PROPERTY_SECTION;
}

function buildPath(propertyId: string, section: PropertySectionKey): string {
  const base = `/admin/properties/${propertyId}`;
  return section === DEFAULT_PROPERTY_SECTION ? base : `${base}/${section}`;
}

export function PropertyWorkspace({ property, pageContent, upcomingEvents }: PropertyWorkspaceProps) {
  const pathname = usePathname();
  const section = parseSection(pathname, property.id);

  const selectSection = useCallback(
    (next: PropertySectionKey) => {
      window.history.pushState(null, "", buildPath(property.id, next));
    },
    [property.id],
  );

  return (
    <div className={w.workspace}>
      <nav className={w.sectionNav} aria-label="Property sections">
        {PROPERTY_SECTIONS.map((entry) => {
          const selected = entry.key === section;
          return (
            <button
              key={entry.key}
              type="button"
              aria-current={selected ? "page" : undefined}
              className={selected ? `${w.sectionTab} ${w.sectionTabActive}` : w.sectionTab}
              onClick={() => selectSection(entry.key)}
            >
              {entry.label}
            </button>
          );
        })}
      </nav>

      <div className={w.body}>
        {section === "basics" && (
          <PropertyBasicsPanel propertyId={property.id} sections={pageContent.basics ?? {}} />
        )}

        {section === "content" && (
          <PropertyPageContentPanel propertyId={property.id} sections={pageContent} />
        )}

        {section === "events" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-serif text-[15px] text-olive">Upcoming events at {property.name}.</p>
              <Button asChild variant="primary" size="sm">
                <Link href={`/admin/events/new?propertyId=${property.id}`}>Add event</Link>
              </Button>
            </div>
            <EventsDataTable rows={upcomingEvents} />
          </div>
        )}
      </div>
    </div>
  );
}

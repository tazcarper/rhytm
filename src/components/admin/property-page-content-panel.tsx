"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/ui";
import type { PropertyPageKey } from "@/src/services/public/property-page-content";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import { PROPERTY_CONTENT_PAGES, getSectionsForPage } from "@/src/constants/admin/property-page-sections";
import { PropertyPageSectionsList } from "./property-page-sections-list";

interface PropertyPageContentPanelProps {
  propertyId: string;
  sections: Record<PropertyPageKey, Record<string, AdminPropertyPageSection | null>>;
}

// Sub-picker over every marketing page's editable sections. Not URL-driven
// (unlike the outer PropertySection tabs) — a flat picker is enough here;
// nothing inside needs to be deep-linkable. Each section renders its own
// independent form (single-block or items, per its config), so a save in
// one section never risks another's unsaved edits.
export function PropertyPageContentPanel({ propertyId, sections }: PropertyPageContentPanelProps) {
  const [activePage, setActivePage] = useState<PropertyPageKey>("home");
  const activeLabel = PROPERTY_CONTENT_PAGES.find((page) => page.key === activePage)?.label ?? "";
  const activeSections = getSectionsForPage(activePage);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 border-b border-rule">
        {PROPERTY_CONTENT_PAGES.map((page) => (
          <button
            key={page.key}
            type="button"
            onClick={() => setActivePage(page.key)}
            className={
              page.key === activePage
                ? "border-b-2 border-tan-deep px-4 py-2 text-[13px] font-medium uppercase tracking-label text-olive"
                : "px-4 py-2 text-[13px] uppercase tracking-label text-gray hover:text-olive"
            }
          >
            {page.label}
          </button>
        ))}
      </div>

      {activePage === "events" && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-rule bg-cream p-4">
          <p className="font-serif text-[15px] text-olive">
            The content below is just the surrounding page copy — events themselves (dates, capacity,
            pricing) are managed on the property's Events tab.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href={`/admin/events/new?propertyId=${propertyId}`}>Add event</Link>
          </Button>
        </div>
      )}

      <PropertyPageSectionsList
        propertyId={propertyId}
        pageKey={activePage}
        sectionConfigs={activeSections}
        sections={sections[activePage] ?? {}}
      />

      <p className="font-serif italic text-[13px] text-gray">
        {activeLabel} has {activeSections.length} editable section{activeSections.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

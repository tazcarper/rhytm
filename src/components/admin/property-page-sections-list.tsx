import type { PropertyPageKey } from "@/src/services/public/property-page-content";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import type { PropertyPageSectionConfig } from "@/src/constants/admin/property-page-sections";
import { PropertyPageContentForm } from "./property-page-content-form";
import { PropertyPageItemsForm } from "./property-page-items-form";

interface PropertyPageSectionsListProps {
  propertyId: string;
  pageKey: PropertyPageKey;
  sectionConfigs: ReadonlyArray<PropertyPageSectionConfig>;
  sections: Record<string, AdminPropertyPageSection | null>;
}

// Renders one page's configured sections as independent forms (single-block
// or items, per each section's kind) — shared by PropertyPageContentPanel
// (which adds a page-picker on top) and PropertyBasicsPanel (which doesn't
// need one, since "basics" is only ever one fixed page).
export function PropertyPageSectionsList({
  propertyId,
  pageKey,
  sectionConfigs,
  sections,
}: PropertyPageSectionsListProps) {
  return (
    <div className="flex flex-col gap-6">
      {sectionConfigs.map((sectionConfig) =>
        sectionConfig.kind === "items" ? (
          <PropertyPageItemsForm
            key={`${pageKey}-${sectionConfig.sectionKey}`}
            propertyId={propertyId}
            pageKey={pageKey}
            sectionKey={sectionConfig.sectionKey}
            sectionLabel={sectionConfig.label}
            helpText={sectionConfig.helpText}
            section={sections[sectionConfig.sectionKey] ?? null}
            itemFields={sectionConfig.itemFields}
            maxItems={sectionConfig.maxItems}
          />
        ) : (
          <PropertyPageContentForm
            key={`${pageKey}-${sectionConfig.sectionKey}`}
            propertyId={propertyId}
            pageKey={pageKey}
            sectionKey={sectionConfig.sectionKey}
            sectionLabel={sectionConfig.label}
            helpText={sectionConfig.helpText}
            section={sections[sectionConfig.sectionKey] ?? null}
            fields={sectionConfig.fields}
            itemFields={sectionConfig.kind === "hybrid" ? sectionConfig.itemFields : undefined}
            maxItems={sectionConfig.kind === "hybrid" ? sectionConfig.maxItems : undefined}
          />
        ),
      )}
    </div>
  );
}

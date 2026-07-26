import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import { getSectionsForPage } from "@/src/constants/admin/property-page-sections";
import { PropertyPageSectionsList } from "./property-page-sections-list";

interface PropertyBasicsPanelProps {
  propertyId: string;
  sections: Record<string, AdminPropertyPageSection | null>;
}

// Logo, address, contact, office hours, and social links — the property
// facts the public header/footer chrome reads. Unlike PropertyPageContentPanel
// there's no page-picker: "basics" is a single fixed page, so its sections
// render directly.
export function PropertyBasicsPanel({ propertyId, sections }: PropertyBasicsPanelProps) {
  return (
    <PropertyPageSectionsList
      propertyId={propertyId}
      pageKey="basics"
      sectionConfigs={getSectionsForPage("basics")}
      sections={sections}
    />
  );
}

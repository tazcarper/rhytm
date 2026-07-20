import type { PropertyPageKey } from "@/src/services/public/property-page-content";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import type { PropertyPageSectionConfig } from "@/src/constants/admin/property-page-sections";
import { PropertyPageContentForm } from "./property-page-content-form";
import { PropertyPageItemsForm } from "./property-page-items-form";
import g from "./property-page-sections-list.module.css";

interface PropertyPageSectionsListProps {
  propertyId: string;
  pageKey: PropertyPageKey;
  sectionConfigs: ReadonlyArray<PropertyPageSectionConfig>;
  sections: Record<string, AdminPropertyPageSection | null>;
}

type SectionChunk =
  | { kind: "grid"; configs: PropertyPageSectionConfig[] }
  | { kind: "full"; config: PropertyPageSectionConfig };

// Groups consecutive kind:"single" sections into one grid run — see
// property-page-sections-list.module.css for why. "items"/"hybrid"
// sections each break the run and render on their own, full-width.
function chunkSections(configs: ReadonlyArray<PropertyPageSectionConfig>): ReadonlyArray<SectionChunk> {
  const chunks: SectionChunk[] = [];
  for (const config of configs) {
    if (config.kind !== "single") {
      chunks.push({ kind: "full", config });
      continue;
    }
    const last = chunks[chunks.length - 1];
    if (last?.kind === "grid") {
      last.configs.push(config);
    } else {
      chunks.push({ kind: "grid", configs: [config] });
    }
  }
  return chunks;
}

function renderSection(
  propertyId: string,
  pageKey: PropertyPageKey,
  sectionConfig: PropertyPageSectionConfig,
  sections: Record<string, AdminPropertyPageSection | null>,
) {
  return sectionConfig.kind === "items" ? (
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
  );
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
  const chunks = chunkSections(sectionConfigs);

  return (
    <div className="flex flex-col gap-6">
      <p className="font-serif italic text-[13px] text-gray">
        Blank fields fall back to this page&apos;s built-in copy — list sections below show only the cards
        you&apos;ve added.
      </p>

      {chunks.map((chunk, index) =>
        chunk.kind === "grid" ? (
          <div key={index} className={g.singleGrid}>
            {chunk.configs.map((config) => renderSection(propertyId, pageKey, config, sections))}
          </div>
        ) : (
          renderSection(propertyId, pageKey, chunk.config, sections)
        ),
      )}
    </div>
  );
}

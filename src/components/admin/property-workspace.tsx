"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import type { AdminProperty } from "@/src/services/admin/properties";
import type { PropertyCatalog } from "@/src/services/admin/catalog";
import type { AdminCateringOption } from "@/src/services/admin/catering";
import type { EstimateGuestFeeBand } from "@/src/services/admin/estimate-guest-fees";
import {
  DEFAULT_PROPERTY_SECTION,
  DRAWER_SECTIONS,
  PROPERTY_SECTIONS,
  isPropertySectionKey,
  type PropertySectionKey,
} from "@/src/constants/admin/property-sections";
import { PropertySettingsForm } from "./property-settings-form";
import { CatalogServicesPanel } from "./catalog-services-panel";
import { CatalogAddOnsPanel } from "./catalog-add-ons-panel";
import { CatalogCateringPanel } from "./catalog-catering-panel";
import { EstimateGuestFeesEditor } from "./estimate-guest-fees-editor";
import { AdminModal } from "./admin-modal";
import { ServiceEditorForm } from "./service-editor-form";
import { AddOnEditorForm } from "./add-on-editor-form";
import w from "./property-workspace.module.css";

interface PropertyWorkspaceProps {
  property: AdminProperty;
  catalog: PropertyCatalog;
  cateringOptions: ReadonlyArray<AdminCateringOption>;
  guestFeeBands: ReadonlyArray<EstimateGuestFeeBand>;
}

// The URL is the single source of truth for which section is showing and which
// item (if any) is open in the editor drawer. We read it with usePathname and
// change it with `window.history.pushState` — Next keeps usePathname in sync,
// so section/drawer switches re-render instantly with no server round-trip,
// while refresh / deep-link / browser back all "just work".
interface WorkspaceLocation {
  section: PropertySectionKey;
  itemId: string | null;
}

function parseLocation(pathname: string, propertyId: string): WorkspaceLocation {
  const prefix = `/admin/properties/${propertyId}`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const segments = rest.split("/").filter(Boolean);
  const sectionRaw = segments[0] ?? DEFAULT_PROPERTY_SECTION;
  const section = isPropertySectionKey(sectionRaw)
    ? sectionRaw
    : DEFAULT_PROPERTY_SECTION;
  const itemId = DRAWER_SECTIONS.includes(section) ? (segments[1] ?? null) : null;
  return { section, itemId };
}

function buildPath(
  propertyId: string,
  section: PropertySectionKey,
  itemId: string | null,
): string {
  const base = `/admin/properties/${propertyId}`;
  const path =
    section === DEFAULT_PROPERTY_SECTION ? base : `${base}/${section}`;
  return itemId && DRAWER_SECTIONS.includes(section)
    ? `${path}/${itemId}`
    : path;
}

export function PropertyWorkspace({
  property,
  catalog,
  cateringOptions,
  guestFeeBands,
}: PropertyWorkspaceProps) {
  const pathname = usePathname();
  const { section, itemId } = parseLocation(pathname, property.id);

  const navigate = useCallback(
    (nextSection: PropertySectionKey, nextItemId: string | null) => {
      window.history.pushState(
        null,
        "",
        buildPath(property.id, nextSection, nextItemId),
      );
    },
    [property.id],
  );

  const selectSection = (next: PropertySectionKey) => navigate(next, null);
  const openItem = (next: string) => navigate(section, next);
  const closeDrawer = () => navigate(section, null);

  // `itemId === "new"` is the create sentinel (deep-linkable at /<section>/new).
  const creatingService = section === "experiences" && itemId === "new";
  const openService =
    section === "experiences" && itemId && itemId !== "new"
      ? catalog.services.find((service) => service.id === itemId)
      : undefined;
  const openAddOn =
    section === "add-ons" && itemId && itemId !== "new"
      ? catalog.addOns.find((addOn) => addOn.id === itemId)
      : undefined;

  const activeAddOns = catalog.addOns.filter((addOn) => addOn.isActive);
  const linkedAddOnIds = openService
    ? catalog.links
        .filter((link) => link.serviceId === openService.id)
        .map((link) => link.addOnId)
    : [];

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
              className={
                selected
                  ? `${w.sectionTab} ${w.sectionTabActive}`
                  : w.sectionTab
              }
              onClick={() => selectSection(entry.key)}
            >
              {entry.label}
            </button>
          );
        })}
      </nav>

      <div className={w.body}>
        {section === "basics" && <PropertySettingsForm property={property} />}

        {section === "experiences" && (
          <CatalogServicesPanel
            propertyId={property.id}
            propertySlug={property.slug}
            services={catalog.services}
            links={catalog.links}
            onEditItem={openItem}
            onAddItem={() => openItem("new")}
          />
        )}

        {section === "add-ons" && (
          <CatalogAddOnsPanel
            propertyId={property.id}
            propertySlug={property.slug}
            addOns={catalog.addOns}
            links={catalog.links}
            services={catalog.services}
            onEditItem={openItem}
          />
        )}

        {section === "catering" && (
          <CatalogCateringPanel
            propertyId={property.id}
            propertySlug={property.slug}
            options={cateringOptions}
          />
        )}

        {section === "guest-fees" && (
          <EstimateGuestFeesEditor
            propertyId={property.id}
            propertySlug={property.slug}
            bands={guestFeeBands}
          />
        )}
      </div>

      {creatingService && (
        <AdminModal title="Add experience" size="lg" onClose={closeDrawer}>
          <ServiceEditorForm
            propertyId={property.id}
            propertySlug={property.slug}
            availableAddOns={activeAddOns}
            createDisplayOrder={catalog.services.length}
            onClose={closeDrawer}
          />
        </AdminModal>
      )}

      {openService && (
        <AdminModal title="Edit experience" size="lg" onClose={closeDrawer}>
          <ServiceEditorForm
            key={openService.id}
            propertyId={property.id}
            propertySlug={property.slug}
            service={openService}
            availableAddOns={activeAddOns}
            initialLinkedAddOnIds={linkedAddOnIds}
            onClose={closeDrawer}
          />
        </AdminModal>
      )}

      {openAddOn && (
        <AdminModal title="Edit add-on" size="lg" onClose={closeDrawer}>
          <AddOnEditorForm
            key={openAddOn.id}
            propertyId={property.id}
            propertySlug={property.slug}
            addOn={openAddOn}
            onClose={closeDrawer}
          />
        </AdminModal>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { AdminProperty } from "@/src/services/admin/properties";
import { PropertySettingsForm } from "./property-settings-form";
import p from "./properties-admin.module.css";

// Property settings workspace: a switcher across the properties + the
// selected property's full-width editor. `key` on the form resets its local
// state when you switch properties.
export function PropertiesWorkspace({ properties }: { properties: AdminProperty[] }) {
  const [activeId, setActiveId] = useState(properties[0]?.id ?? "");
  const active = properties.find((property) => property.id === activeId) ?? properties[0];

  if (!active) return null;

  return (
    <div className={p.workspace}>
      <div className={p.switcher} role="tablist" aria-label="Properties">
        {properties.map((property) => {
          const selected = property.id === active.id;
          return (
            <button
              key={property.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${p.tab} ${selected ? p.tabActive : ""}`}
              onClick={() => setActiveId(property.id)}
            >
              <span className={p.tabDot} data-slug={property.slug} />
              {property.name}
            </button>
          );
        })}
      </div>

      <PropertySettingsForm key={active.id} property={active} />
    </div>
  );
}

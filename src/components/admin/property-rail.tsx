"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPropertyBrandTint } from "@/src/constants/admin/property-brand-tints";
import p from "./properties-admin.module.css";

export interface PropertyRailItem {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

// The persistent property switcher at the top of the property workspace. Lives
// in the layout so it survives navigations between properties. Each property is
// a real link (load-per-property); the active one is highlighted from the URL.
export function PropertyRail({
  properties,
}: {
  properties: ReadonlyArray<PropertyRailItem>;
}) {
  const pathname = usePathname();

  return (
    <div className={p.switcher} role="tablist" aria-label="Properties">
      {properties.map((property) => {
        const href = `/admin/properties/${property.id}`;
        const selected = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={property.id}
            href={href}
            role="tab"
            aria-selected={selected}
            className={`${p.tab} ${selected ? p.tabActive : ""}`}
          >
            <span className={p.tabBadge}>
              {property.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={property.logoUrl} alt="" className={p.tabBadgeImg} />
              ) : (
                <span
                  className={p.tabBadgeInitial}
                  style={{ background: getPropertyBrandTint(property.slug) }}
                  aria-hidden="true"
                >
                  {property.name.charAt(0)}
                </span>
              )}
            </span>
            {property.name}
          </Link>
        );
      })}
    </div>
  );
}

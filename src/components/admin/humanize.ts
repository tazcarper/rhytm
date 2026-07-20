import type { InquiryType } from "@/src/services/admin/inquiries";

// Presentation helpers for raw database vocabulary. The audit
// (docs/dashboard-ui-audit.md) flagged snake_case enums leaking into the UI
// (`sold_out`, `super_admin`, `plan_a_visit`); every admin surface that has
// no bespoke label map falls back to this.

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  membership: "Membership",
  private_event: "Private event",
};

/** "sold_out" → "Sold out", "super_admin" → "Super admin". */
export function humanizeEnum(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (spaced.length === 0) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Property identity colors for charts — the solid "dot" hexes from
// property-pill.module.css, keyed by property slug. Charts can't reach
// CSS-module classes, so the hexes live here as the single TS-side copy.
export const PROPERTY_CHART_COLORS: Record<string, string> = {
  "horseshoe-bay": "#3f6e32",
  "hog-heaven": "#b88240",
  packsaddle: "#325a8c",
};

const FALLBACK_CHART_COLOR = "#6b6557";

export function propertyChartColor(slug: string): string {
  return PROPERTY_CHART_COLORS[slug] ?? FALLBACK_CHART_COLOR;
}

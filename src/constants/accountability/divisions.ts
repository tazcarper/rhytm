import type { OrgDivision } from "@/src/types/accountability";

// Display metadata for each division. Divisions are fixed company structure, so
// they live as static config; org_seats only stores the division *key*. Accents
// are drawn from the admin palette so the chart stays on-theme.
export interface DivisionMeta {
  key: OrgDivision;
  label: string;
  accent: string;
}

export const DIVISIONS: ReadonlyArray<DivisionMeta> = [
  { key: "ownership", label: "Ownership", accent: "#3f4a21" },
  { key: "executive", label: "Executive", accent: "#9a8159" },
  { key: "central", label: "Rhythm Central", accent: "#8c5e0f" },
  { key: "media", label: "Rhythm Media", accent: "#b06a2e" },
  { key: "hogheaven", label: "Hog Heaven SC", accent: "#8b3030" },
  { key: "horseshoebay", label: "Horseshoe Bay SC", accent: "#2f5482" },
  { key: "packsaddle", label: "Packsaddle Precision", accent: "#2d5520" },
];

export const DIVISION_LABEL = Object.fromEntries(
  DIVISIONS.map((d) => [d.key, d.label]),
) as Record<OrgDivision, string>;

export const DIVISION_ACCENT = Object.fromEntries(
  DIVISIONS.map((d) => [d.key, d.accent]),
) as Record<OrgDivision, string>;

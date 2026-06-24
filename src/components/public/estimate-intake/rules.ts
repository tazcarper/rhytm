// ===== Club identity + gating for the /request-estimate front door =====
//
// The catalog (experiences, add-ons, guest-fee tiers, catering) and the
// indicative-price math used to live here. They are now DB-driven:
//   - catalog  → src/services/public/estimate-catalog.ts (admin-managed tables)
//   - pricing  → src/services/estimates/estimate-pricing.ts (pure module)
//
// What remains here is club identity (slug/label maps) and the two club-level
// gates that aren't catalog data — Packsaddle "coming soon" and HSB
// members-only — plus the small shared types the form and pricing module pass
// around. These are static club rules, not editable content.

import type { HostCode } from "@/src/services/estimates/estimate-pricing";

// Shared estimate domain types live in the service layer (estimate-pricing);
// re-exported here so the form keeps a single import surface for club + host.
export type { HostCode, CustomLine } from "@/src/services/estimates/estimate-pricing";

export type ClubCode = "hsb" | "hh" | "psp";

// Club selection ↔ the seeded `properties.slug` values.
export const CLUB_TO_SLUG: Record<ClubCode, string> = {
  hsb: "horseshoe-bay",
  hh: "hog-heaven",
  psp: "packsaddle",
};

export const CLUB_LABELS: Record<ClubCode, string> = {
  hsb: "Horseshoe Bay SC",
  hh: "Hog Heaven SC",
  psp: "Packsaddle Precision",
};

// Clubs still being built — gated behind a "Coming Soon" message, not
// selectable / submittable. Packsaddle's precision program isn't quotable yet.
const COMING_SOON: Partial<Record<ClubCode, boolean>> = { psp: true };

// True when this club currently shows the "Coming Soon" gate.
export function isComingSoon(club: ClubCode): boolean {
  return !!COMING_SOON[club];
}

// True when a non-member host is blocked from booking at HSB (members-only).
// A member host bringing non-member guests is allowed.
export function isHsbBlocked(club: ClubCode, host: HostCode): boolean {
  return club === "hsb" && host === "nonmember";
}

import type { PublicService } from "@/src/services/public/services";
import type { ClubCode } from "@/src/components/public/estimate-intake/rules";

// Maps the estimate form's hand-coded experience / add-on ids (rules.ts) to the
// real catalog UUIDs needed for booking_disciplines / booking_add_ons, BY NAME
// against the live catalog (plan §8). Pure — the caller fetches services via
// getPublicServicesForProperty() and passes them in.
//
// This is intentionally LOSSY. The seeded catalog only partially overlaps the
// estimate's experiences, so anything without a clean, FK-safe match is OMITTED
// rather than risk a 23503 on insert (plan §8). The priced line still rides on
// bid_line_items regardless of whether a structural discipline/add-on attaches,
// so omission costs structure, not money. When the real catalog is seeded (a
// content task), extend the maps below — nothing else changes.

// Estimate experience id → catalog service NAME, per club. Only ids with a real
// services row are listed; the rest (lesson / class / event / facility, and HH
// pistol) have no service today and resolve to nothing by design.
const EXPERIENCE_SERVICE_NAMES: Record<ClubCode, Record<string, string>> = {
  hsb: { clays: "Sporting Clays", pistol: "Pistol Bays" },
  hh: { clays: "Sporting Clays" },
  psp: {},
};

// Estimate add-on key → catalog add_on NAME. gear (no rental add-on) and
// catering (priced via the estimate only) have no catalog row and are omitted.
const ADD_ON_NAMES: Record<string, string> = {
  ammo: "Ammunition Pack",
  cart: "Drink Cart",
};

export interface EstimateAddOnSelection {
  ammo: number;
  gear: number;
  cart: boolean;
}

export interface ResolvedCatalog {
  disciplineIds: string[];
  addOns: { serviceId: string; addOnId: string; quantity: number }[];
}

const norm = (value: string): string => value.trim().toLowerCase();

export function resolveEstimateCatalog(
  club: ClubCode,
  services: ReadonlyArray<PublicService>,
  experiences: ReadonlyArray<string>,
  addOnSelection: EstimateAddOnSelection,
): ResolvedCatalog {
  const nameMap = EXPERIENCE_SERVICE_NAMES[club] ?? {};

  // Match each selected experience to a service by name; omit the unmatched.
  const matchedServices: PublicService[] = [];
  const seen = new Set<string>();
  for (const experienceId of experiences) {
    const serviceName = nameMap[experienceId];
    if (!serviceName) continue;
    const service = services.find((svc) => norm(svc.name) === norm(serviceName));
    if (service && !seen.has(service.id)) {
      seen.add(service.id);
      matchedServices.push(service);
    }
  }

  const disciplineIds = matchedServices.map((svc) => svc.id);

  // An add-on must hang off a matched service. getPublicServicesForProperty
  // only nests add-ons that are service_add_ons-linked, so attaching to the
  // first matched service that carries the add-on is FK-safe by construction.
  const wanted: { name: string; quantity: number }[] = [];
  if (addOnSelection.ammo > 0) {
    wanted.push({ name: ADD_ON_NAMES.ammo, quantity: addOnSelection.ammo });
  }
  if (addOnSelection.cart) {
    wanted.push({ name: ADD_ON_NAMES.cart, quantity: 1 });
  }
  // gear: no catalog add-on → omitted.

  const addOns: ResolvedCatalog["addOns"] = [];
  for (const want of wanted) {
    for (const service of matchedServices) {
      const addOn = service.addOns.find((a) => norm(a.name) === norm(want.name));
      if (addOn) {
        addOns.push({
          serviceId: service.id,
          addOnId: addOn.id,
          quantity: want.quantity,
        });
        break; // attach once, to the first matched service that carries it
      }
    }
  }

  return { disciplineIds, addOns };
}

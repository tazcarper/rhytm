import type { PublicService } from "@/src/services/public/services";

// Resolves the estimate form's selections to the real catalog UUIDs needed for
// booking_disciplines / booking_add_ons. Experiences are service ids, so
// disciplines resolve 1:1; add-ons attach to a selected discipline that links
// them.
//
// This is intentionally LOSSY (plan §8): the priced lines ride on
// bid_line_items regardless, so an add-on with no service_add_ons link is
// omitted from structure rather than risk a 23503 on insert. Omission costs
// structure, not money.

export interface ResolvedCatalog {
  disciplineIds: string[];
  addOns: { serviceId: string; addOnId: string; quantity: number }[];
}

export function resolveEstimateCatalog(
  services: ReadonlyArray<PublicService>,
  experienceIds: ReadonlyArray<string>,
  // Add-on id → chosen quantity.
  addOnQuantities: Record<string, number>,
): ResolvedCatalog {
  const servicesById = new Map(services.map((svc) => [svc.id, svc]));

  // Each selected experience id that is a real, active service becomes a
  // booking discipline (deduped).
  const seen = new Set<string>();
  const matchedServices: PublicService[] = [];
  for (const id of experienceIds) {
    const svc = servicesById.get(id);
    if (svc && !seen.has(svc.id)) {
      seen.add(svc.id);
      matchedServices.push(svc);
    }
  }
  const disciplineIds = matchedServices.map((svc) => svc.id);

  // Attach each chosen add-on to the first selected discipline that links it
  // (getPublicServicesForProperty only nests service_add_ons-linked add-ons, so
  // this is FK-safe by construction). Unlinked add-ons are omitted.
  const addOns: ResolvedCatalog["addOns"] = [];
  for (const [addOnId, quantity] of Object.entries(addOnQuantities)) {
    if (quantity <= 0) continue;
    for (const svc of matchedServices) {
      if (svc.addOns.some((a) => a.id === addOnId)) {
        addOns.push({ serviceId: svc.id, addOnId, quantity });
        break;
      }
    }
  }

  return { disciplineIds, addOns };
}

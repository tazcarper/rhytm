import type { AdminBidListFilters } from "@/src/services/admin/bids";

// Merge `overrides` onto `current` and serialize to a bids-list URL. Pass a
// key as `undefined` in `overrides` to clear it (e.g. `{ status: undefined }`).
// One serializer shared by the filter chips, the advanced form, and
// pagination so they can never drift out of sync.
export function buildBidsHref(
  basePath: string,
  current: AdminBidListFilters,
  overrides: Partial<AdminBidListFilters>,
): string {
  const merged = { ...current, ...overrides };
  const queryParams = new URLSearchParams();

  if (merged.statusGroup) queryParams.set("statusGroup", merged.statusGroup);
  if (merged.status) queryParams.set("status", merged.status);
  if (merged.propertyId) queryParams.set("propertyId", merged.propertyId);
  if (merged.from) queryParams.set("from", merged.from);
  if (merged.to) queryParams.set("to", merged.to);
  if (merged.q) queryParams.set("q", merged.q);
  if (merged.page && merged.page > 0) queryParams.set("page", String(merged.page));

  const queryString = queryParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

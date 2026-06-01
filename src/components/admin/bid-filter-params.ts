import type { AdminBidListFilters } from "@/src/services/admin/bids";

// Which of the two filter layouts is on screen. Carried in the URL so the
// choice survives navigation, refreshes, and shared links — and so the two
// designs can be A/B compared on the same data without a redeploy.
export type BidFilterUi = "groups" | "signals";

export const DEFAULT_BID_FILTER_UI: BidFilterUi = "groups";

export function isBidFilterUi(value: string | undefined): value is BidFilterUi {
  return value === "groups" || value === "signals";
}

// Every URL param the bids list understands, in one place. Chips, the
// advanced form, the layout toggle, and pagination all serialize through
// buildBidsHref so they can never drift out of sync.
export interface BidFilterParams extends AdminBidListFilters {
  filterUi?: BidFilterUi;
}

// Merge `overrides` onto `current` and serialize to a URL. Pass a key as
// `undefined` in `overrides` to clear it (e.g. `{ status: undefined }`).
// The default layout is omitted from the query string to keep clean URLs.
export function buildBidsHref(
  basePath: string,
  current: BidFilterParams,
  overrides: Partial<BidFilterParams>,
): string {
  const merged = { ...current, ...overrides };
  const queryParams = new URLSearchParams();

  if (merged.filterUi && merged.filterUi !== DEFAULT_BID_FILTER_UI) {
    queryParams.set("filterUi", merged.filterUi);
  }
  if (merged.statusGroup) queryParams.set("statusGroup", merged.statusGroup);
  if (merged.status) queryParams.set("status", merged.status);
  if (merged.signature) queryParams.set("signature", merged.signature);
  if (merged.payment) queryParams.set("payment", merged.payment);
  if (merged.propertyId) queryParams.set("propertyId", merged.propertyId);
  if (merged.from) queryParams.set("from", merged.from);
  if (merged.to) queryParams.set("to", merged.to);
  if (merged.q) queryParams.set("q", merged.q);
  if (merged.page && merged.page > 0) queryParams.set("page", String(merged.page));

  const queryString = queryParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

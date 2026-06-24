// Single source of truth for who may waive/comp a bid line and when.
//
// The eligible-role set and the "can this viewer waive on this bid?" predicate
// live here so the admin UI (which hides the controls) and the Server Action
// (which enforces it) can never drift apart. Per design Q4: super_admin + admin
// (cross-property) and property_manager (own property — the property scope is
// enforced server-side, where the booking's property is known). NOT concierge /
// membership_coordinator — hasAdminAccess() is too broad here.

export const WAIVE_ROLES: ReadonlyArray<string> = [
  "super_admin",
  "admin",
  "property_manager",
];

// A line can be waived only while the bid is still in review, and only by a
// waive-eligible role. This is the role/status gate shared by the page (to hide
// the controls) and the action (to enforce). Property scoping for a
// property_manager is an additional server-side check, because only the action
// has loaded the bid's property.
export function canWaiveBid(
  role: string | null | undefined,
  bidStatus: string,
): boolean {
  return (
    bidStatus === "pending_review" &&
    role != null &&
    WAIVE_ROLES.includes(role)
  );
}

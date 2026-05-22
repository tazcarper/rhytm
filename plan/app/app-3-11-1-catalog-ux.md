# App 3.11.x — Catalog UX Improvements (Implementation Plan)

**Status:** 🔲 Not Started · **Drafted:** 2026-05-22

Follow-up sub-phase to 3.11 (`plan/app/app-3-11-catalog.md`). 3.11 landed the catalog editor; this sub-phase closes the remaining UX gaps surfaced during initial use.

## Background

The original 3.11 design split add-on creation and add-on linking into two surfaces (library panel + service edit page). First-use feedback was that this leaked the DB normalization onto the operator: an admin created an add-on, expected it to appear in the booking funnel, and got nothing because they hadn't linked it to a service. We landed a smaller fix (the inline "Available for which services?" checklist on the library create form) so new add-ons are never born orphan.

This plan covers the two larger improvements deferred from that fix.

## Improvement A — Service-first restructure (the big one)

**Goal.** Make the primary catalog surface "what services do you offer + what add-ons does each service include." The library becomes a power-user inventory tab, not the front door.

**Why.** Admins think in terms of "guests booking sporting clays need ammunition" — a service-anchored thought. The current two-column layout (Services left / Add-ons right) treats both as equal entry points, which is correct schema-wise but doesn't match the mental model. Service-first reads like: "here's what we sell; for each one, here's what comes with it."

**What this builds.**

- `app/admin/properties/[id]/catalog/page.tsx` becomes a **single column of service cards**, each card expandable to reveal the linked add-ons + per-service controls.
- Inside an expanded service card:
  - Service header — name, description preview, status pill, reorder arrows, Edit, Deactivate.
  - Linked add-ons section — checkbox list of *all* active property add-ons (linked ones checked), inline edit price/desc on each row, "+ Add add-on" inline form (same shape as today's service edit form's inline creator). Changes persist via auto-save (debounced 1s) per card, not via a Save button — feels more direct.
- The standalone Add-ons panel moves to **a secondary tab** at the top: "Services" (default) / "All add-ons (library)." The library tab keeps the current panel shape — useful for bulk price edits, deactivation, and the "Linked to N services" overview.
- Drop the dedicated `/admin/properties/[id]/catalog/services/[serviceId]/edit` route — inline editing on the catalog page replaces it for the common path. Keep the route for deep-linking or as a fallback if inline UX gets cluttered for services with many add-ons (>20).

**Implementation notes.**

- Component restructure: `<CatalogServiceCard>` (new) absorbs `<ServiceEditorForm>`'s checkbox list + inline add-on creator. `<CatalogServicesPanel>` becomes a list of `<CatalogServiceCard>` instances.
- Auto-save needs a per-card dirty flag + a debounced server call. Use the existing `updateServiceAction` — the input schema already supports the full save in one call.
- Pagination/virtualization: not needed at scale anticipated (10–20 services per property max).
- Tab UI: simple two-button row at the top of the page; URL param `?tab=library` so the chosen view is bookmarkable. Default is services tab.

**SOLID notes.**

- `<CatalogServiceCard>` owns one service's edit state — single responsibility. The page-level component orchestrates.
- The service edit Server Action is unchanged; the UI just inlines its consumer. No service-layer changes needed.

**Migration.** None.

**Estimated effort.** ~1 build session for the restructure + auto-save wiring; ~½ session for the tab UX.

---

## Improvement B — "Common" affordance + auto-link on new service

**Goal.** Codify the distinction between common add-ons (drink cart, eye/ear protection — linked to every service) and service-specific add-ons (sporting-clays ammunition).

**Why.** Admins already think in these two buckets. Today the distinction is invisible — you'd have to count links to know. And when a new service is added, common add-ons don't auto-attach, so admin has to remember to manually attach the drink cart every time. Easy thing to forget; results in inconsistent catalog state.

**What this builds.**

- **"Common" pill** on add-ons rendered in both the library view and the inline add-on lists. An add-on is "Common" when it's linked to every active service at the property. Pill renders next to the price.
  - Computed at render time (no schema flag) — link count equals active-service count.
  - If a new service appears, a previously-Common add-on may no longer qualify (one service unlinked). The pill disappears; admin gets a visual signal to act.
- **Auto-link prompt on new service creation.** When admin creates a new service via the inline "+ Add service" form (Improvement A: now on the catalog page itself), the success path raises a one-time confirm:
  > **"Link 4 common add-ons to this service?"**
  > Drink cart, Eye protection, Ear protection, Hot lunch.
  > **[Yes, link them]   [No, I'll choose manually]**
  - Computed server-side: any add-on currently "Common" (linked to every active service *before* this new service existed) is offered.
  - "Yes" inserts the junction rows in one batch (extend `createCatalogService` to accept `linkCommonAddOns: boolean` defaulting to `false`; or run a separate batch insert action invoked from the confirm Yes branch — second cleaner).
- **Library-view filter chip:** "Show common only" / "Show specific only" / "Show all" — niche but useful when the catalog grows. Defer if scope feels heavy.

**Implementation notes.**

- "Common" is a derived state, not a column. Compute once in `getPropertyCatalog` (returns a set of "common add-on IDs" alongside the rest) so the UI never duplicates the logic.
- New service confirm uses a small modal pattern — reuse `<DeactivateConfirm>`'s structure as a starting point, simplify (no impact list needed; just a copy + two buttons).
- The auto-link batch must respect RLS — property managers can already write to `service_add_ons` (post-3.11 migration), so the Server Action just calls the existing `setServiceAddOnLinks` shape with the union of current links + chosen common add-ons.

**Migration.** None.

**Estimated effort.** ~½ session for the pill + computation, ~½ session for the auto-link confirm flow.

---

## Sequencing

Improvement A first — it's the bigger UX shift and Improvement B's "auto-link on new service creation" assumes the new service is created from the catalog page itself (which Improvement A enables via inline service creation). B is awkward on the current dedicated-route service edit page.

If we're short on time, ship A standalone — the inline create form's checklist (already landed in 3.11.x mini-fix) plus A's restructure handles 80% of the friction. B is polish.

## What this phase explicitly does NOT do

- **Categories / tags on add-ons.** Useful at 30+ items per property; premature today.
- **Per-service price overrides** on add-ons. No current ask; `add_ons.property_id` already covers cross-property price variance (drink cart costs different at HSB vs Packsaddle). Adding per-service overrides means a `service_add_ons.price_override numeric NULL` column + render logic to fall back. Revisit only if a property asks.
- **Drag-drop reorder.** Up/down arrows are fine.
- **Bulk operations from the library** (attach this add-on to multiple services in one click). Improvement A's service-first card UX makes this naturally per-service; bulk-from-library becomes a niche need.
- **A "duplicate this service to another property" action.** Cross-property workflows are a separate feature class.

## Verification gates (before flipping to ✅)

- [ ] `tsc --noEmit` clean
- [ ] Manual walk: create a service from the catalog page, accept the auto-link prompt, confirm common add-ons appear linked on the new service immediately
- [ ] Create an add-on with "All services" checked, then add a new service — confirm the new service offers that add-on by virtue of the auto-link prompt (not because the original linkage carried over; new junction rows must be created)
- [ ] Tabs persist across page reloads via URL param
- [ ] Inline auto-save on a service card: change a description, wait 1s, refresh — change persists
- [ ] Booking funnel (`/book/[slug]/disciplines`) reflects all the above immediately

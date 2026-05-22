# App 3.11 — Service & Add-on Catalog (Implementation Plan)

**Status:** 🔲 Not Started · **Drafted:** 2026-05-22

Detail plan for the catalog editor described in `plan/app/app-3-admin.md` § Sub-phase 3.11. Read that section first for the *why*; this file is the *how*.

---

## Scope recap

CRUD for three tables, all per-property:

- `services` (per-property; description, is_active, display_order)
- `add_ons` (per-property; price + the same flags)
- `service_add_ons` (junction; same-property invariant enforced by trigger)

Surface lives at `/admin/properties/[id]/catalog`. Reached from a new "Manage catalog →" button on each `PropertySettingsForm` card.

Soft-delete only — `booking_disciplines.service_id` and `booking_add_ons.{service_id, add_on_id}` are `REFERENCES` without `ON DELETE`, defaulting to `RESTRICT`. Hard delete would fail loudly on any historical booking. Surface no Delete verb; surface a Deactivate verb that sets `is_active = false`.

---

## Open decisions to confirm before building

1. **Deactivate-with-active-bookings warning.** When admin clicks Deactivate on a service or add-on currently referenced by a booking in status `pending_review | awaiting_guest | signed | deposit_paid`:
   - **(A)** Warn modal with count ("3 active bookings still reference this service — deactivate anyway?"). Plan default. Adds one COUNT query per deactivate click.
   - **(B)** Deactivate silently — booking keeps its snapshot, the customer just sees the historical name. Less safe.
   - **(C)** Block deactivate entirely when active bookings exist. Most conservative.
2. **Junction editor UX.**
   - **(A)** Per-service add-on checklist (one panel per service, list of all property add-ons with checkboxes). Reads naturally when there are 4–10 services and 5–20 add-ons. Plan default.
   - **(B)** Matrix table (services as rows, add-ons as columns, X marks the link). Compact for many of each but harder to scan with long names.
3. **Reorder UX.** Both services + add-ons render in `display_order ASC, name ASC`.
   - **(A)** Up/down arrow buttons per row. Simplest. Plan default.
   - **(B)** HTML5 drag/drop. Nicer feel; more code; can land in a 3.11.x follow-up.
4. **Property-manager access.** Today they have no write policy on `services` / `add_ons`.
   - **(A)** Keep them read-only (plan default — service runs via the auth-aware client; UPDATE rejects with Postgres permission error if they try, but the surface today doesn't render edit forms for them).
   - **(B)** Add a `property_manager write own-property` RLS policy and let them edit. More work, broader trust surface.

Once these are picked, the build is mechanical.

---

## File layout

### New files

```
app/admin/properties/[id]/
  catalog/
    page.tsx                   server orchestrator
    actions.ts                 thin Server Action wrappers
    services/
      [serviceId]/
        edit/page.tsx          full edit form (server orchestrator)
    add-ons/
      [addOnId]/
        edit/page.tsx          full edit form

src/services/admin/
  catalog.ts                   PropertyCatalog read + write functions + Zod schemas

src/components/admin/
  catalog.module.css           layout (2-column services/add-ons, junction panel)
  catalog-services-panel.tsx   client list w/ inline create + reorder + deactivate
  catalog-add-ons-panel.tsx    client list w/ inline create + reorder + deactivate
  catalog-link-editor.tsx      client junction editor (per-service checkbox lists)
  service-editor-form.tsx      client edit form (name, description, is_active)
  add-on-editor-form.tsx       client edit form (name, description, price, is_active)
  deactivate-confirm.tsx       shared modal — count + confirm/cancel
```

### Edited files

```
src/services/public/services.ts     no functional change; reuse confirmed
src/components/admin/property-settings-form.tsx   add "Manage catalog →" link button
plan/app/app-3-admin.md             flip 🔲 → 🔄 → ✅ on this sub-phase as work progresses
TRACKER.md                          append "Sub-phase 3.11 landed YYYY-MM-DD"
```

### No new migration

Schema for all three tables already exists from Phase 1. RLS already covers admin write. The `service_add_ons_same_property` trigger already enforces the same-property invariant.

---

## Types

```ts
// src/services/admin/catalog.ts

export interface AdminCatalogService {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface AdminCatalogAddOn {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  price: number;            // numeric coerced from string at boundary
  isActive: boolean;
  displayOrder: number;
}

export interface AdminCatalogLink {
  serviceId: string;
  addOnId: string;
}

export interface PropertyCatalog {
  propertyId: string;
  services: AdminCatalogService[];     // ordered by display_order ASC, name ASC
  addOns: AdminCatalogAddOn[];         // same ordering
  links: AdminCatalogLink[];           // every junction row for this property
}

export interface ActiveBookingRefCount {
  serviceId?: string;
  addOnId?: string;
  count: number;     // bookings in active statuses referencing this row
}
```

---

## Service function signatures

```ts
// src/services/admin/catalog.ts

export async function getPropertyCatalog(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PropertyCatalog>

export async function countActiveBookingsForService(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<number>

export async function countActiveBookingsForAddOn(
  supabase: SupabaseClient,
  addOnId: string,
): Promise<number>

// Services
export async function createCatalogService(
  supabase: SupabaseClient,
  input: CreateServiceInput,    // { propertyId, name, description, displayOrder }
): Promise<{ ok: true; service: AdminCatalogService } | { ok: false; error: string }>

export async function updateCatalogService(
  supabase: SupabaseClient,
  input: UpdateServiceInput,    // { serviceId, name, description, isActive }
): Promise<{ ok: boolean; error?: string }>

export async function reorderCatalogServices(
  supabase: SupabaseClient,
  input: { propertyId: string; orderedIds: string[] },
): Promise<{ ok: boolean; error?: string }>

// Add-ons (parallel shape)
export async function createCatalogAddOn(...)
export async function updateCatalogAddOn(...)   // includes price
export async function reorderCatalogAddOns(...)

// Junction
export async function setServiceAddOnLinks(
  supabase: SupabaseClient,
  input: { serviceId: string; addOnIds: string[] },
): Promise<{ ok: boolean; error?: string }>
// Implementation: SELECT current links for serviceId. Compute added = new − current,
// removed = current − new. INSERT added rows + DELETE removed rows in two
// separate calls (PostgREST doesn't support multi-row delete by composite key
// in a single call without `.in()` on one column, which fits here since serviceId
// is fixed). No transaction wrapper — partial failure leaves the junction in a
// consistent superset; admin retries to converge. Acceptable for a low-frequency
// operator action; tighten via SECURITY DEFINER if a real bug surfaces.
```

### Zod schemas

```ts
const nameSchema = z.string().trim().min(1, "Name is required").max(200);
const descriptionSchema = z.string().trim().max(2000).optional().nullable();
const priceSchema = z.coerce.number().min(0, "Must be ≥ 0").max(100000);
const displayOrderSchema = z.coerce.number().int().min(0).max(9999);

export const CreateServiceInputSchema = z.object({
  propertyId: z.string().uuid(),
  name: nameSchema,
  description: descriptionSchema,
  displayOrder: displayOrderSchema.default(0),
});

export const UpdateServiceInputSchema = z.object({
  serviceId: z.string().uuid(),
  name: nameSchema,
  description: descriptionSchema,
  isActive: z.boolean(),
});

// Parallel for add-ons + price.
// Reorder schema: z.object({ propertyId, orderedIds: z.array(z.string().uuid()).max(200) })
// Links schema: z.object({ serviceId: uuid, addOnIds: z.array(uuid).max(200) })
```

---

## Server Actions

```ts
// app/admin/properties/[id]/catalog/actions.ts
"use server";

export async function createServiceAction(input)
export async function updateServiceAction(input)
export async function reorderServicesAction(input)

export async function createAddOnAction(input)
export async function updateAddOnAction(input)
export async function reorderAddOnsAction(input)

export async function setServiceAddOnLinksAction(input)

// Each action: safeParse → call service → on ok, revalidatePath the four
// affected surfaces:
//   - /admin/properties/[propertyId]/catalog
//   - /admin/properties/[propertyId]/catalog/services/[serviceId]/edit (if update)
//   - /book/[propertySlug]   (public funnel reads the catalog — fresh on next visit)
//   - /admin/properties      (in case the parent page summarizes service count later;
//                              cheap revalidate, no downside)
//
// propertySlug for that fourth revalidate: page already has it from the page-level
// fetch; actions accept it as part of input where needed.
```

---

## Page structure

### `/admin/properties/[id]/catalog/page.tsx` (server)

```
fetch propertyId from params
fetch viewer (already-authenticated admin layout)
const catalog = await getPropertyCatalog(supabase, propertyId);
const property = catalog being non-null OR notFound() — wrap getAdminPropertyById too

<PageShell width="xl">
  <Eyebrow>Admin / Properties / {property.name} / Catalog</Eyebrow>
  <Heading level={1}>{property.name} catalog</Heading>
  <Text variant="lead">Services and add-ons offered at this property. Public funnel reads these on every booking.</Text>

  <div className={s.twoCol}>
    <CatalogServicesPanel propertyId={...} services={...} propertySlug={...} />
    <CatalogAddOnsPanel propertyId={...} addOns={...} propertySlug={...} />
  </div>

  <CatalogLinkEditor
    propertyId={...}
    services={catalog.services.filter(s => s.isActive)}
    addOns={catalog.addOns.filter(a => a.isActive)}
    links={catalog.links}
    propertySlug={...}
  />
</PageShell>
```

### Panel component contract (`CatalogServicesPanel` shown; add-ons parallel)

Client component. Props: `propertyId`, `services: AdminCatalogService[]`, `propertySlug`.

```
Card heading: "Services" + count + "+ Add service" button

For each service (active first, then inactive separated by divider):
  Row showing: drag-handle/arrows · name · description preview (truncated) ·
               status pill (active/inactive) · "Edit" link → /catalog/services/[id]/edit · "Deactivate" button (when active)

"+ Add service" expands to an inline form:
  - name input
  - description textarea (markdown support like bid-editor-form)
  - Create + Cancel buttons
  on success: insert into local state optimistically, refresh from server

Deactivate flow:
  Click → fires <DeactivateConfirm> modal
  Modal mounts → service action fetches countActiveBookingsForService
  Modal renders count + "Deactivate anyway?" / "Cancel"
  On confirm → calls updateServiceAction({ ...current, isActive: false })

Reorder:
  Each row has ↑ / ↓ buttons (disabled at endpoints).
  Click reorders local state immediately; debounced 500ms call to
  reorderServicesAction with new id order. (Avoids one server roundtrip per click
  when admin rapidly clicks through.)
```

### Edit page `/admin/properties/[id]/catalog/services/[serviceId]/edit/page.tsx`

Server orchestrator. Fetches the service via the catalog service (or a single-row helper), 404 on missing. Renders `<ServiceEditorForm>` with the service + propertySlug. Form mirrors `BidEditorForm` pattern: `useTransition`, inline success/error Alert, Save + Cancel + (in this case) Deactivate confirm.

### Junction editor `<CatalogLinkEditor>`

Per-service panel: for each active service, a card showing checkbox list of all active add-ons. Current checked state from `links` prop. On checkbox change, local state updates + a debounced (1s) `setServiceAddOnLinksAction({ serviceId, addOnIds })` call. Status indicator (small spinner + "Saved" green tick) at the top of each service card.

Why debounced rather than per-click: a single service might attach to 6 add-ons; admin checks them in sequence; we want one save, not six.

Why one action per service (not one bulk action for all junctions): each service is self-contained; failures on one don't roll back the others; revalidation scope is clearer.

---

## RLS verification path

1. `services: admin write` — admin runs `INSERT/UPDATE/DELETE` from the auth-aware client. ✅ confirmed in migration.
2. `add_ons: admin write` — same. ✅.
3. `service_add_ons` has no explicit RLS policies in Phase 1; it inherits the table's RLS state. Need to verify: does `service_add_ons` have RLS enabled, and if so, what policies cover it?

Verify before build (one line in `psql` or via Supabase dashboard):

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'service_add_ons';

SELECT polname, polcmd FROM pg_policy
WHERE polrelid = 'service_add_ons'::regclass;
```

If RLS is disabled on `service_add_ons`, our admin INSERTs/DELETEs succeed without a policy (and so do anon clients, which is bad). If RLS is enabled but there's no policy, INSERTs reject. Either case may need a one-line migration adding `ENABLE ROW LEVEL SECURITY` + `admin write` policy. **Resolve at build time; don't write the catalog code blind.**

---

## SOLID compliance

- **Single Responsibility:** Each service function does one DB op. The page orchestrates; components own UI; actions own validation + revalidation.
- **Open/Closed:** Add a fourth catalog kind (e.g., `instructors`) later by adding parallel service functions + a new panel component. No edits to existing services/add-ons code.
- **Liskov:** No subtyping shenanigans here — services/add-ons are sibling concepts, not a hierarchy.
- **Interface Segregation:** Each editor form gets only the input shape it writes (CreateServiceInput vs. UpdateServiceInput vs. links). No fat "save anything" envelope.
- **Dependency Inversion:** Every service function takes `supabase` as a parameter; nothing instantiates a client internally. Server Actions inject `createServerSupabaseClient()` and pass it down.

---

## Out of scope (do NOT do in 3.11)

- Pricing rules editor (`pricing_rules` table) — separate sub-phase if needed.
- Time slots editor (`time_slots`) — separate.
- Instructors editor — separate.
- Photo / media upload per service — not in any plan yet.
- Public-facing copy preview (admin sees the funnel view of their service) — could land as a 3.11.x polish.
- Hard delete + cascade clean-up — `is_active=false` is the answer; if a row needs to be truly gone, hand-edit the DB.

---

## Sequencing (build order)

1. **RLS check on `service_add_ons`** — settle the open question above. If a one-line migration is needed, write it before any TS.
2. **`src/services/admin/catalog.ts`** — read function first (`getPropertyCatalog`), then create/update/reorder for services, then same for add-ons, then `setServiceAddOnLinks`.
3. **`/admin/properties/[id]/catalog/page.tsx`** — orchestrator that just renders the data. No interactivity yet. Confirms the read path end-to-end against live DB.
4. **`<CatalogServicesPanel>`** + service create/update/deactivate Server Actions + Zod schemas. End-to-end one CRUD path before mirroring it.
5. **`<CatalogAddOnsPanel>`** — copy the services panel, swap fields.
6. **`<CatalogLinkEditor>`** + `setServiceAddOnLinks` action.
7. **Reorder UX** — add ↑/↓ buttons + debounced reorder action.
8. **"Manage catalog →" link** on `<PropertySettingsForm>`.
9. **tsc + manual smoke** (Node-20 env) — create + edit + deactivate + reactivate + link / unlink + reorder. Walk one property end-to-end. Verify a freshly active service appears in the booking funnel.
10. **TRACKER.md** entry.

Estimated effort: ~1 build session for steps 1–5, ~½ session for 6–7, ~½ session for 8–10. Three sub-sessions total.

---

## Verification gates (must pass before flipping to ✅)

- [ ] RLS on `service_add_ons` confirmed (and migration added if needed)
- [ ] `tsc --noEmit` clean
- [ ] Manual walk in Node-20 env: create/edit/deactivate/reactivate one service, one add-on, link/unlink in both directions, reorder both lists
- [ ] Public funnel at `/book/[slug]` immediately reflects the new catalog (post-revalidate)
- [ ] Try to deactivate a service that has at least one active booking attached: warning modal fires with correct count
- [ ] Property manager role hits `/admin/properties/[id]/catalog`: page loads (read works), Save buttons present a Postgres permission error if clicked (or the surface gates the buttons — confirm chosen approach)
- [ ] App 2 booking funnel still completes end-to-end (no regression on getPublicServicesForProperty shape — we didn't change it, but the smoke test seals it)

---

## What lands in TRACKER.md when this is done

A "Sub-phase 3.11 landed YYYY-MM-DD" block on the App 3 row that:

- Names every file created and the key edits
- Calls out the 4 open decisions and which way each landed
- Notes the RLS resolution on `service_add_ons`
- Confirms `tsc --noEmit` clean
- Flags any deferred polish (e.g., drag/drop reorder if we shipped the arrow-button version)

# App 3 — Admin Portal

**Status:** 🔲 Not Started
**Depends on:** App 1 (auth gate, middleware, design system, Supabase clients), App 2 (the public funnel that produces `bookings` + `bids` rows for staff to review). Database Phases 1–6 complete.
**Unblocks:** App 6 (a bid must be `confirmed` by staff before Stripe deposit becomes payable), App 7 (e-sign envelope is created off a confirmed bid), App 8 (real Resend transport replaces the dev-emails shim, with staff-triggered resends), App 9 (Inngest workflows trigger off status transitions managed here).

**Epic goal.** Give staff (admins, property managers, concierges) a working surface to review bids that come in from the public funnel, edit the bid content (quote, deposit, gear list, FAQ, schedule), and transition status (`pending_review → confirmed → ...`) — which is what makes a bid actually transactable. Today `pending_review` bids pile up in the database with no UI to act on them; this phase closes that gap.

App 3 deliberately stays **read+light-write** for the bid lifecycle. It does **not** build Stripe / Dropbox Sign / Resend integration — those are Apps 6/7/8. It does **not** build admin-side member-editing or partner-side flows — those are Apps 4 (remaining work) and 5. The minimum viable cut (3.1–3.5) makes the App 2 → bid lifecycle work end-to-end; the later sub-phases add the broader admin surface.

---

## Open questions that affect content but not structure

| Question | Affects | Workaround during App 3 |
|---|---|---|
| Property manager scope detail | Whether property managers see only their property's bids, or all bids read-only | Default: scoped via `auth_property_id()` JWT helper. Easy to change later by adjusting the bid-list query. |
| Bid quote authoring shape (Q5 follow-on) | `bids.quote_amount` is a single number today; if pricing rules support partner discounts or multi-line items, this may want to be JSONB | Phase 1 ships a single `quote_amount` numeric edit. If Q5 introduces line items, add via `O — Open/Closed`: new column + new editor section, no rewrites. |
| Deny copy | Public bid page already renders "denied" status; the admin needs a reason/notes field for staff context (not shown to guest) | Add `bids.internal_notes` (already in Phase 3 schema) editor — denying records a reason in `internal_notes`, public denied banner is generic. |

---

## Sub-phase 3.1 — Admin Shell + Navigation

**Goal.** Replace the current `/admin` stub with a proper portal shell: persistent navigation, role-aware menu, signed-in identity badge, sign-out. Everything subsequent admin pages render *inside*.

What this builds:

- `app/admin/layout.tsx` — server component reads the current user + role, passes display info to a client `<AdminNav>` component. Wraps `{children}` in the portal shell (sidebar or topbar, TBD during build — sidebar matches the staff-tool conventions, topbar matches the existing `PageShell`).
- `<AdminNav>` at `src/components/admin/admin-nav.tsx` — nav items: Dashboard (`/admin`), Bids (`/admin/bids`), Bookings (`/admin/bookings`), Members (`/admin/members`), Properties (`/admin/properties`). Items that aren't built yet render as disabled (visually "coming soon" — clearer than hiding, sets up the eventual surface).
- Admin theme primitives: a denser table-friendly variant of `Card` if needed, an `<AdminPageShell>` analogous to the existing `<PageShell>` but with the nav reserved. Don't pre-build primitives we don't use yet — only add what 3.1's surfaces actually need.
- `/admin` dashboard placeholder: signed-in identity, quick links to Bids queue, count summary (count of pending_review bids, today's bookings) — minimal but live data, not lorem.
- Strict portal allowlist already in place (`proxy.ts`) gates the route to the five staff roles. No middleware changes needed.

**Out of scope for 3.1.** Real bid queue (that's 3.2). Real dashboard widgets beyond a count or two (later sub-phase). Members index + membership detail (3.8).

---

## Sub-phase 3.2 — Bid Review Queue (`/admin/bids`)

**Goal.** List all bids with filtering, sorting, and quick scan info — the primary staff queue. Click a row → bid detail page.

What this builds:

- `app/admin/bids/page.tsx` — server component fetches bids via service-role (admins) or scoped via `auth_property_id()` (property managers; property managers see only their property's bids).
- Default filter: `status=pending_review` sorted by `created_at DESC` — the queue staff actually need to clear.
- Filter UI: status (pending_review | confirmed | denied | signed | paid | expired), property (HSB / Hog Heaven / Packsaddle — admins only; property managers locked to theirs), date range. URL-driven (`?status=&property=&from=&to=`) so the queue is bookmarkable + shareable.
- Sort UI: by created_at, by booking date, by status. Default created_at DESC.
- Table columns: guest email, booking type, property, date+slot, current status, created_at relative ("3 hours ago"), action — `View →`.
- Empty state: "No bids match — adjust filters above."
- Service layer: `src/services/admin/bids.ts` — `getAdminBidsList(filters)` returns a typed result shape; consumers in the page do no PostgREST surgery.
- Pagination: page-size 50, "Load more" button (cursor-style via the last row's created_at + id tiebreak — robust against new bids landing mid-pagination). If 50 is enough for now, skip cursor and ship a simple limit.

---

## Sub-phase 3.3 — Bid Detail (`/admin/bids/[id]`)

**Goal.** Single canonical page that shows everything about a bid + its booking in one read-only render. The form for editing it lands in 3.4, but 3.3 builds the read surface first so the data shape is locked.

What this builds:

- `app/admin/bids/[id]/page.tsx` — fetches bid + booking + property + disciplines + add-ons + instructor (similar shape to `get-bid.ts` from App 2, but server-side and admin-scoped).
- Sections:
  - **Status banner** — current status + when it transitioned (from `bids.confirmed_at` / `signed_at` / `paid_at` / `denied_at` if available; if not, fall back to a single "Created at X" line).
  - **Guest** — name, email, phone, party size.
  - **Booking** — type, property, date, slot, duration, instructor (with name), capacity reserved.
  - **Disciplines + Add-ons** — nested list, with prices snapshotted at booking time.
  - **Bid content** — quote_amount, deposit_amount, gear_list, faq, schedule, internal_notes. Each rendered read-only; "Edit" button at the top opens the 3.4 editor.
  - **Public preview link** — opens the customer-facing `/bids/<slug>/<code>` URL in a new tab so staff can see exactly what the guest sees.
- Service layer: `src/services/admin/get-bid-detail.ts` returns a typed `AdminBidDetail` shape used by both this page and the 3.4 editor.

---

## Sub-phase 3.4 — Bid Editor

**Goal.** Let staff edit bid content: quote, deposit, gear list (JSONB authoring), FAQ (JSONB), schedule (JSONB), internal notes. Saving does not change status — that's 3.5.

What this builds:

- Two options for surface: (a) inline edit on the 3.3 detail page (toggle a section to edit mode); (b) dedicated `/admin/bids/[id]/edit` page. Decision during build — (b) tends to win for a complex form like this because back-nav semantics are clearer.
- Form covers:
  - **Quote** — `quote_amount` numeric input (USD, two decimals).
  - **Deposit** — `deposit_amount` numeric input. The bid page (App 2's 2.7) already renders a deposit slot off this value.
  - **Gear list** — JSONB authoring. Repeater of `{name, description?}` rows. Per CLAUDE.md "no comments unless WHY is non-obvious", the form input itself doesn't need help text inline if the labels are good.
  - **FAQ** — JSONB authoring. Repeater of `{question, answer}` rows.
  - **Schedule** — JSONB authoring. Repeater of `{time, title, description?}` rows.
  - **Internal notes** — large textarea, staff-only, not shown to guests.
- Server Action: `src/services/admin/update-bid.ts` validates with Zod, writes via service-role (RLS is for the public/member side; admin staff actions are explicit). Server Action wrapper at `app/admin/bids/[id]/actions.ts`.
- Validation rules: quote_amount + deposit_amount ≥ 0; deposit_amount ≤ quote_amount; arrays cap at e.g. 20 items each (a sanity limit, not a product rule); strings cap at 500 chars per field.
- After save: stay on edit page with a success toast; "Done" button returns to detail page.

**SOLID note.** The save is a service function that takes a `SupabaseClient` and the new shape — it doesn't reach for the client itself. The Server Action wraps the service. CLAUDE.md "Dependency Inversion."

---

## Sub-phase 3.5 — Status Actions (Confirm / Deny / Regenerate)

**Goal.** The bid lifecycle's status transitions, surfaced as explicit staff actions. Each transition fires the existing Phase 3 `bids_sync_booking_status` trigger (which keeps booking status in lockstep) — App 3 doesn't reinvent the state machine, it just provides the UI verbs that drive it.

What this builds:

- Action buttons on the 3.3 detail page: **Confirm** (visible when status=pending_review), **Deny** (visible when status=pending_review), **Regenerate URL** (visible when status=confirmed and staff wants a new access code; rare path).
- Each action opens a small confirm modal: brief copy explaining the consequence ("Confirming sets this bid live and emails the guest"), a notes field (for `internal_notes`), Submit + Cancel.
- Server Actions: `src/services/admin/transition-bid.ts` is the single function — takes bid id, target status, optional notes; returns the new state.
- Phase 3's `bids_sync_booking_status` workflow-guard trigger enforces the legal transitions; the service function maps trigger errors to user-friendly copy ("Can't confirm — this bid is already denied. Regenerate first.")
- **Email side-effect on confirm.** Uses the `EmailService` from App 2.9 — sends a "your bid is ready" email with the bid URL. Today the LoggingEmailService writes to `dev_email_outbox`; App 8 swaps the transport with no caller change. The send is post-response via `after()` from `next/server` — same pattern as 2.9.
- "Regenerate URL" rebuilds the slug + access_code (calls a Phase 3 function or a new service) and emails the guest the new link. The old URL goes 404.

---

## Sub-phase 3.6 — Admin Dashboard (`/admin`)

**Goal.** A landing page that gives staff at-a-glance state of the day: how many bids need review, what's confirmed and arriving today, recent activity. Optional — could be deferred to a later phase if 3.1–3.5 deliver value.

What this builds:

- Replace the 3.1 dashboard placeholder with a real-data dashboard.
- Cards: Pending bids (count + 5 most recent + "view queue →"), Confirmed today (count + 5 most recent), This week's bookings (count + 5 most recent), Recent activity (last 10 status transitions across all bids — needs the `bids_status_history` audit table from the Deferred Improvements list, OR can read `bids.updated_at` for a rough approximation; choose the simpler path here).
- Quick actions: "+ New booking" (for App 3.8 — disabled until built), "+ New member" (App 3.10 — disabled until built).
- Each card is a server component reading via service-role.

---

## Sub-phase 3.7 — Bookings Index (`/admin/bookings`)

**Goal.** A bookings-first view, separate from the bids queue. Most bookings come in via the App 2 funnel (with an attached bid), but admin-created bookings (App 3.10 path, future) won't necessarily have a bid attached, so the surface exists.

What this builds:

- `app/admin/bookings/page.tsx` — similar structure to 3.2 but the row is booking-centric (date+slot first, status second).
- Filters: status, property, date range, type.
- Click a row → bid detail (if a bid exists) OR a booking detail page (if no bid).
- Booking detail page: `/admin/bookings/[id]/page.tsx` — minimal until a real use case beyond the bid-attached path emerges.

---

## Sub-phase 3.8 — Members Index + Membership Detail (`/admin/members`), read-only

**Scope changed 2026-06-01 — preview-as-member dropped.** This sub-phase is now a read-only members directory only. The old "preview as member" surface (re-rendering the `/member` portal UI for a member from inside `/admin`) is cut — see CLAUDE.md Architecture Decisions for the rationale (the bid page staff need to inspect is already a public link; re-rendering the member portal added a parallel data path for little launch-scale value). Removing it also breaks the old dependency on App 4's member components, so 3.8 is now buildable independently.

**Goal.** An admin-facing directory of memberships (the household account is the unit, not the individual person) and a read-only detail view per membership. Admins do NOT enter `/member` directly (strict portal allowlist); they see member facts here instead.

What this builds:

- `app/admin/members/page.tsx` — list of memberships: one row per membership showing the primary person + household size, member number, property, tier, status. Filter by property, status, tier; search by name / email / member number.
- `app/admin/members/[id]/page.tsx` — read-only membership detail: the household (every person on the membership with their role + contact info), membership facts (number, tier, status, property, dates), and activity (the household's bookings + adventure RSVPs).

**Read-only by design.** No status changes, approvals, or edits in this slice — those are a later sub-phase that lands alongside the membership application flow (App 4 / App 9, gated on Q8). Member-side write actions on behalf of a member route through admin-portal write paths that explicitly attribute (e.g. `created_by_admin_id` on bookings).

**Client-gated cosmetics only.** Tier *names* (Q9) and the dues model (Q16) just fill in labels — the page renders whatever's in the columns, so neither blocks the build.

---

## Sub-phase 3.9 — Property Settings (`/admin/properties`)

**Goal.** Admin-editable property configuration: booking horizon days, max concurrent groups, default policies. The values today live in the `properties` table; this surface lets admins edit them without SQL.

What this builds:

- `app/admin/properties/page.tsx` — three-card layout (one per property), each card editable.
- Editable fields per property: `booking_horizon_days`, `max_concurrent_groups`, brand `tagline`, support email/phone.
- Server Action saves changes.
- This implements the "config in DB" rule from CLAUDE.md memory — operational knobs admins can edit, not TS constants.

---

## Sub-phase 3.10 — Admin Test Pack

**Goal.** Manual test pack analogous to App 2's P1–P12 — exercises every status transition, every filter, every preview path.

Scenarios (working title — finalize at build time):

- A1: bid queue loads with all-status filter, sort by created_at DESC, paginates correctly.
- A2: pending_review filter shows only pending bids; status filter applies to URL.
- A3: bid detail page renders all sections; public preview link opens correct customer URL.
- A4: edit bid — quote + deposit + gear list + faq + schedule + notes — save, reload, all persist.
- A5: confirm a pending bid → status updates everywhere, booking status syncs (verified in Supabase), `dev_email_outbox` row appears for the guest notification.
- A6: deny a pending bid → status updates, internal_notes saved, no email sent (or "denied" email sent, depending on Q decision).
- A7: regenerate URL → old URL 404s, new URL works, guest receives new-link email.
- A8: property manager role sees only their property's bids in the queue (RLS-scoped via auth_property_id).
- A9: super_admin / admin sees all properties' bids.
- A10: members index lists memberships (filter by property/status/tier); membership detail renders the household, facts, and activity (bookings + RSVPs) read-only, data scoped correctly.
- A11: property settings edit persists; booking funnel uses the new horizon next session.

Verification log row in `docs/manual-testing.md` matching the App 2 precedent.

---

## Sub-phase 3.11 — Service & Add-on Catalog (`/admin/properties/[id]/catalog`)

**Goal.** Admin-editable CRUD for the per-property service and add-on catalog. Today these tables (`services`, `add_ons`, `service_add_ons`) are seeded via SQL migrations only; this surface unblocks the client filling in their own catalog without engineering involvement and closes Q4 (full discipline catalog) as a hard blocker.

**Why this lives under properties:** `services.property_id` and `add_ons.property_id` scope every row to a single property; a service can only attach to an add-on that shares its property (enforced by the `service_add_ons_same_property` trigger). The natural UI hierarchy follows: pick a property → manage its services → manage its add-ons → wire add-ons to services. Reached from a "Manage catalog →" link on each card in `/admin/properties`.

What this builds:

- `app/admin/properties/[id]/catalog/page.tsx` — server page scoped to one property. Two columns: Services on the left, Add-ons on the right. A third section below shows the junction (which add-ons attach to which services).
- **Services list/edit/create** — name, description (markdown supported via `<MarkdownProse>` in the read view, plain textarea in the editor), `is_active`, `display_order`. Inline create + edit + deactivate; **no hard delete** — Phase 2's `booking_disciplines.service_id REFERENCES services(id)` is `ON DELETE RESTRICT` (no clause = default), so any historical booking pins the row. Soft-deactivate via `is_active = false` is the documented path; admin UI hides the Delete verb entirely.
- **Add-ons list/edit/create** — name, description (markdown), `price` (numeric USD), `is_active`, `display_order`. Same soft-delete rule applies — `booking_add_ons.add_on_id` references `add_ons(id)`.
- **Service ↔ add-on wiring** — junction editor (`service_add_ons`). Display as a matrix or as per-service checkbox lists of available add-ons; insert/delete junction rows is unblocked since `service_add_ons` has no inbound FKs and CASCADEs cleanly. Same-property invariant is enforced by the trigger — UI surfaces the error inline if it ever fires.
- **Display order drag-handle** — both services and add-ons render in `display_order ASC, name ASC`. Reorder via up/down arrow buttons (simplest) or HTML5 drag/drop (nicer). Updates write `display_order` in batch.
- Service layer: `src/services/admin/catalog.ts` exports `getPropertyCatalog(supabase, propertyId)` returning `{ services, addOns, links }`, plus targeted writers `createService` / `updateService` / `deactivateService`, `createAddOn` / `updateAddOn` / `deactivateAddOn`, `setServiceAddOnLinks(serviceId, addOnIds[])` (idempotent — diffs current vs. requested, INSERTs the new, DELETEs the dropped). Zod schemas at the module boundary.
- Server Actions: thin wrappers at `app/admin/properties/[id]/catalog/actions.ts`. Each `revalidatePath('/admin/properties/[id]/catalog')` on success; also `revalidatePath('/book/[propertySlug]')` so the public funnel picks up the new catalog on next visit.
- **Booking-funnel reuse confirmed** — App 2's `getPublicServices` / `getPublicAddOns` already read these tables filtered by `is_active`, so the moment admin saves a new service or activates one, the funnel sees it. No new public-side wiring required.

**Open product question to resolve at build time:** when an admin deactivates a service that's currently referenced by an *active* booking (`bookings.status IN pending_review/awaiting_guest/signed/deposit_paid`), should the deactivate succeed silently (booking keeps its snapshot, customer sees the historical name) or warn the admin first? Plan default: warn with a count ("3 active bookings still reference this service — deactivate anyway?"), since silent deactivation is a foot-gun for ops.

**RLS today.** Phase 1's `services: admin write` + `add_ons: admin write` policies cover super_admin/admin globally. Property managers currently have no write policy on these tables — keep it that way for 3.11 (they read via the same auth-aware client, no edit UI rendered for them). Promote to property_manager write later if scope expands.

**SOLID notes.** Catalog reads are one service function returning the typed `PropertyCatalog` shape; writes are six small functions, each doing one thing (create/update/deactivate × services/add-ons) + one junction setter. No fat "save the entire catalog" mega-action — that pattern hides which row changed and bloats the diff surface for revalidation.

---

## What this phase explicitly does NOT do

- **Stripe payment flow.** The bid's `quote_amount` + `deposit_amount` are authored here, but actually charging the deposit is App 6.
- **Dropbox Sign envelope creation.** Confirmed bids gain a signature slot on the public bid page (App 7 wires it).
- **Real email transport.** Notifications go through the EmailService interface from App 2.9 — `LoggingEmailService` writes to `dev_email_outbox` today, App 8 swaps in `ResendEmailService` with no caller change.
- **Adventures admin.** Member adventures (Phase 5) have an admin surface, but that's deferred to a later App 3.x or its own admin surface.
- **Reporting / analytics.** No revenue dashboards, no funnel analytics. Those land with App 10 (Observability) or a dedicated reporting App.

---

## Sequencing recommendation

Sub-phases 3.1 → 3.2 → 3.3 → 3.4 → 3.5 form the minimum viable cut to unlock the bid lifecycle. After 3.5, App 6 (Stripe) becomes valuable; without 3.5, it has nothing to plug into.

3.6 (dashboard) is polish — useful but not blocking.

3.7 (bookings index) and 3.8 (members index + membership detail, read-only) round out the admin surface but don't gate downstream Apps.

3.9 (property settings) is independent — could land anywhere.

3.11 (catalog editor) is **client-blocking** — unblocks Q4 (full discipline catalog) by letting the client populate their own services + add-ons instead of waiting on us to seed from a spreadsheet. Should land before any public-launch readiness review.

3.10 (test pack) is the App 2.10 analog — runs end-to-end before App 3 flips to ✅. Note: 3.10 should be expanded to cover 3.11's CRUD paths once that surface lands.

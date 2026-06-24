# Plan: Admin-managed Experiences, Add-ons & Pricing for `/request-estimate`

## Goal

Let admins manage, per property, the **experiences** and **add-ons** shown on
`/request-estimate`, including their **prices**, from the existing
`/admin/properties/[id]/catalog` admin area. The public estimate page keeps its
automatic price calculation, but sources every value from the database instead
of the hardcoded `src/components/public/estimate-intake/rules.ts`. Seed the DB
with the current `rules.ts` values for each property.

## Confirmed decisions

1. **Experiences = the existing `services` catalog**, relabeled. We reuse the
   `services` / `add_ons` backend and the existing catalog CRUD (built for
   `/book`); we do **not** build a parallel system.
2. **All pricing becomes admin-editable now** — guest-fee tiers, add-on prices,
   the private-lesson ladder, member/non-member class rates, and catering.
3. **Catering = Hog Heaven + Packsaddle only** (HSB dining runs through The
   Club). This corrects the original request, which named HSB.

## What we reuse as-is (no work)

| Capability | Where |
|---|---|
| Service (experience) CRUD per property | `src/components/admin/catalog-services-panel.tsx`, `app/admin/properties/[id]/catalog/actions.ts`, `src/services/admin/catalog.ts` (`createCatalogService`/`updateCatalogService`/`reorderCatalogServices`) |
| Add-on CRUD + **price** per property | `src/components/admin/catalog-add-ons-panel.tsx`, `add-on-editor-form.tsx`, same actions/service; `add_ons.price` column already exists & is edited |
| Tiered guest fees (price by guest-count band, adult + junior) | `pricing_rules.tiers` JSONB + `per_guest_fee`/`junior_per_guest_fee`; read by `src/services/public/pricing.ts` |
| Public reads | `getPublicServicesForProperty` (`src/services/public/services.ts`), `getPublicPricingForProperty` (`src/services/public/pricing.ts`) |
| Catalog page shell / section layout | `app/admin/properties/[id]/catalog/page.tsx` |

## What needs new schema (the gaps)

`rules.ts` expresses pricing shapes the current tables can't hold. Each maps to
a small, co-located extension rather than a new subsystem:

1. **Per-experience pricing strategy.** Experiences price differently (clays =
   guest-fee tier, lesson = ladder, class = per-person member/public, event &
   facility = quote). Add to `services`:
   - `pricing_kind text NOT NULL DEFAULT 'quote'` CHECK in
     (`guest_fee_tier`, `lesson_ladder`, `class_per_person`, `quote`)
   - `show_on_estimate boolean NOT NULL DEFAULT true`
   - `members_only boolean NOT NULL DEFAULT false` (the `event` experience)
2. **Private-lesson ladder.** Add to `services`:
   - `lesson_ladder numeric(10,2)[]` (e.g. `{200,100,50,50,50}`)
   - `lesson_cohort_size int NOT NULL DEFAULT 5`
3. **Class member/public rates.** Add to `services`:
   - `class_price_member numeric(10,2)`, `class_price_public numeric(10,2)`
4. **Property guest-fee schedule.** Reuse `pricing_rules`: one row per property
   holding the estimate's tiered guest fee (bands with adult + junior rates).
   Needs a small **admin editor** (no property-level pricing_rules editor exists
   today — bid pricing editor is bid-scoped).
5. **Catering.** New table:
   ```sql
   catering_options (
     id uuid pk, property_id uuid fk->properties on delete cascade,
     tier text, vendor_name text, price_per_head numeric(10,2) check >=0,
     is_active boolean default true, display_order int default 0,
     created_at, updated_at )
   ```
   RLS: public read where `is_active`; admin write (mirror `add_ons` policies).

> All experience-specific pricing lives as columns on `services` so one
> experience row fully describes its own pricing (Single Responsibility), and a
> new `pricing_kind` slots in without touching existing branches (Open/Closed).

## Phases

### Phase 1 — Schema + seed (one migration set)
- Migration A: `ALTER TABLE services` add the 6 columns above; create
  `catering_options` with RLS + indexes; update generated types.
- Migration B (seed, idempotent): from `rules.ts`, per property
  (resolve `club` code → `property_id`):
  - **Reconcile, don't duplicate.** Services/add-ons may already exist from
    `/book`. Match existing rows by name; UPDATE pricing fields where present,
    INSERT only what's missing. Audit existing `services`/`add_ons` rows first.
  - Experiences: clays/pistol (`guest_fee_tier`), lesson (`lesson_ladder`
    `{200,100,50,50,50}`), class (`class_per_person`, HSB 65/65, HH 0/200),
    event (`quote`, HH not members-only / HSB members-only), HSB has
    facility? no — facility is HH only (`quote`, custom).
  - Add-ons (all properties): Ammunition $17, Firearm/gear $40, Drink cart $75.
  - Guest-fee `pricing_rules`: HSB & HH bands from `RULES.guestFee`; PSP none.
  - Catering: HH + PSP rows (Good/Better/Best vendors + per-head).
  - PSP stays "coming soon" (no experiences) — keep that flag/behaviour.
- Apply via `db push` against the linked cloud DB (dev workflow), then manual
  verification queries per the RLS testing rule.

### Phase 2 — Admin UI (reuse + extend)
- Relabel the services panel section to **"Experiences"** (copy only) on the
  catalog page; add-ons section stays.
- Extend the experience editor form to capture `pricing_kind` and, conditional
  on it, the kind-specific fields (ladder array, class member/public, guest-fee
  note, `members_only`, `show_on_estimate`). Thin server actions → existing
  `updateCatalogService` (extend its accepted fields).
- New **Guest-fee tiers** editor (property-level) — small form writing the
  property's guest-fee `pricing_rule` tiers (adult + junior bands).
- New **Catering** panel for HH + PSP, mirroring `catalog-add-ons-panel.tsx`
  (create/edit/remove/reorder) → new thin actions → new
  `src/services/admin/catering.ts`.
- Styling: reuse the existing catalog panel CSS modules so sections match.

### Phase 3 — `/request-estimate` goes DB-driven
- New public read: `getEstimateCatalog(supabase, propertyId)` in
  `src/services/public/` returning `{ experiences[], addOns[], guestFeeTiers,
  catering[] }` (composes existing service/pricing reads + new catering read).
- Extract the indicative-price math from `estimate-intake.tsx` into a **pure
  pricing module** that takes the DB catalog + user selections and returns the
  total — mirroring the current formulas exactly (guest-fee bands, lesson
  cohort `i % cohort_size`, class member/public, add-on units, catering
  per-head). Unit-testable, no DB.
- Server page (`app/(public)/request-estimate/[club]/page.tsx` &
  `page.tsx`) fetches the catalog and passes it as props; the intake component
  reads props instead of importing `RULES`.

### Phase 4 — Retire the hardcode + verify
- Remove `RULES` catalog/pricing fields from `rules.ts` (keep only any
  genuinely static UI copy, if any). Delete dead branches.
- `npm run typecheck`. Manual end-to-end: edit an experience price / add-on /
  catering in admin → confirm `/request-estimate` total updates for each
  property; confirm submit→bid mapping still resolves (it already reads
  services from DB at submit, so this should be unaffected or simplified).

## Open items to resolve during build
- **Existing-row reconciliation:** audit current `services`/`add_ons` per
  property before seeding so we extend rather than duplicate `/book` data.
- **Quote experiences (event/facility):** estimate should show "we'll quote
  this" rather than a number — confirm exact copy/behaviour.
- **club→property_id mapping:** reuse whatever `getEstimateClubScheduling`
  already uses; don't reinvent.
- **Junior pricing:** carry adult+junior through guest-fee tiers and lesson/
  class where applicable (junior rates exist in `rules.ts` and in
  `pricing_rules`).

## Constraints / workflow notes
- Follows SOLID + project structure (services in `src/services`, thin actions,
  pure pricing module). RLS on the new `catering_options` table per project RLS
  rules (SECURITY DEFINER not needed — single-table policy).
- DB changes go to the **linked cloud Supabase** via `db push` (dev workflow),
  with manual RLS verification — not local Docker.
- Claude will **not** commit or push; the developer does that in Cursor.

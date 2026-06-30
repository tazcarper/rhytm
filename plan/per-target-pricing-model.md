# Per-target pricing (Helice) — recommended model

**Status:** design, for review before build.
**Scope:** Horseshoe Bay + Hog Heaven. Not Packsaddle.
**Author:** DB/engineering review of the client's per-target proposal.

---

## TL;DR — the shape I'd bless

Most of what this request needs **already exists** and should be reused untouched. The only
genuinely *new* modeling is two small, reusable primitives:

1. **A per-unit, member/public rate** — sold in fixed allotments. (The per-target rate.)
2. **A flat per-outing fee charged to everyone, every time.** (The setup / ring fee.)

So we add **one new pricing kind** (`per_target`) and **one reusable fee column** (`session_fee`),
both on the existing `services` row. Everything else — guest fees on non-members, members shooting
on dues, the 1:5 RSO ratio, the 9+ = Private Event rule, ammo — is **already in the system** and
needs no new data model. This keeps it a small PR and follows the open/closed rule: we *add* a
strategy branch, we don't *modify* the existing ones.

---

## Why this fits the architecture

The estimate catalog already prices experiences by a `services.pricing_kind` discriminator
(`guest_fee_tier` / `lesson_ladder` / `class_per_person` / `quote`), with each kind's parameters
co-located on the `services` row, and a single pure strategy switch in
`src/services/estimates/estimate-pricing.ts` (`computeEstimate`). `class_per_person` is already
"rate × quantity, member rate vs public rate." **`per_target` is the same shape** — the only
differences are (a) the quantity is *targets sold in allotments* instead of *heads*, and (b) it
carries a flat per-outing fee. That's a textbook new-strategy addition, not a schema rethink.

### The "think bigger" part — what's reusable beyond Helice

- **`session_fee` is not Helice-specific.** "We staff the ring every session" is just *a flat fee
  charged once per outing, to everyone.* Modeling it as a generic optional column on `services`
  (with a label) means any future experience can carry a setup/lane/range fee without new code. It
  snapshots cleanly as the already-existing `line_item_kind = 'fee'`.
- **`per_target` is written generically enough to cover future per-target games.** The columns are
  "per-unit rate" + "allotment size," not "Helice bird price." A future flush/station game sets the
  same columns with a different `unit_label`. The client explicitly wants this to cover future
  per-target games — the generic naming delivers that without a second kind.

I deliberately do **not** fold the existing `class_per_person` into a single mega `per_unit` kind
right now. It would mean migrating live catalog rows for no functional gain and a bigger, riskier
PR. If a third "rate × quantity" variant ever shows up, that's the moment to consolidate the two
into one parameterized `per_unit` kind — noted as future work, not this PR.

---

## Schema

One migration, additive only.

```sql
-- Widen the pricing-kind check to admit per_target.
alter table public.services
  drop constraint services_pricing_kind_check;
alter table public.services
  add constraint services_pricing_kind_check
  check (pricing_kind in
    ('guest_fee_tier','lesson_ladder','class_per_person','quote','per_target'));

-- Per-target rate (member vs public) + allotment size.
alter table public.services
  add column if not exists per_target_rate_member numeric(10,2),
  add column if not exists per_target_rate_public numeric(10,2),
  add column if not exists target_allotment_size  int not null default 30,
  add column if not exists target_unit_label       text not null default 'target';

-- Reusable per-outing flat fee — NOT specific to per_target. Charged once per
-- outing to everyone (member + non-member). Null = no session fee.
--   session_fee_label       — short name on the line item (e.g. "Setup / ring fee")
--   session_fee_description — optional admin-editable "what this fee is for" copy
alter table public.services
  add column if not exists session_fee             numeric(10,2),
  add column if not exists session_fee_label       text,
  add column if not exists session_fee_description text;
```

Per-property rates fall out for free — `services.property_id` is `NOT NULL`, so HSB's Helice row and
Hog Heaven's Helice row each carry their own rates:

| Club | `per_target_rate_public` | `per_target_rate_member` | `session_fee` |
|---|---|---|---|
| Horseshoe Bay | 2.95 | 2.50 | 49.50 |
| Hog Heaven | 2.75 | 2.25 | 49.50 |

(`target_allotment_size = 30`, `session_fee_label = 'Setup / ring fee'` on both;
`session_fee_description` optional, e.g. "We staff the ring every session.")

---

## What gets reused with zero new modeling

| Requirement | Already handled by | Change needed |
|---|---|---|
| Guest fee on **non-member** Helice guests, tiered by count | `guest_fee_tier` schedule (`pricing_rules`, `audience='estimate'`) + `usesGuestFee` | Add `per_target` to the `usesGuestFee` set so it triggers guest fees |
| **Members pay no guest fee** (shoot on dues) | Guest fees apply to `guests` only; members excluded | None |
| **Ammo separate** | Existing add-on | None |
| **RSO 1:5**, members excluded | `booking-advisories.ts` (`rsoPerGuests: 5`) | None |
| **9+ total = Private Event**, 72-hr notice | `booking-advisories.ts` (`privateEventAt: 9`) | None |
| Bid/quote snapshot | `bid_line_items`; `fee` line-item kind already exists | None (session fee → `fee`, targets → `base_experience`) |
| Tournament pricing | — | **Not built** (client says TBD) |

---

## Pricing logic (new branch in `computeEstimate`)

Add one strategy branch alongside `class_per_person`, and add `per_target` to `usesGuestFee`:

```ts
// per_target participates in guest fees (non-member guests pay tiered fees on top).
const usesGuestFee = selected.some(
  (e) => e.pricingKind === "guest_fee_tier"
      || e.pricingKind === "lesson_ladder"
      || e.pricingKind === "per_target",
);

// Per-target experiences — rate × targets (member rate vs public rate),
// plus a flat session fee charged once per outing to everyone.
for (const exp of selected.filter((e) => e.pricingKind === "per_target")) {
  const targets = Math.max(0, selections.targetQuantities[exp.id] ?? 0); // multiple of allotment
  const rate = memberHost ? (exp.perTargetRateMember ?? 0) : (exp.perTargetRatePublic ?? 0);
  if (targets > 0) {
    lines.push({ label: `${exp.name} · ${targets} ${exp.targetUnitLabel}s × ${money(rate)}`,
                 amount: targets * rate });
    total += targets * rate;
  }
  if (exp.sessionFee) {
    lines.push({ label: exp.sessionFeeLabel ?? "Setup fee", amount: exp.sessionFee });
    total += exp.sessionFee;
  }
}
```

Targets are selected as a multiple of `target_allotment_size` (30/60/90…). New input on
`EstimateSelections`: `targetQuantities: Record<string, number>` (mirrors `addOnQuantities`),
validated to a positive multiple of the allotment.

---

## Worked example (matches the client's math)

**Non-member, HSB, 30 birds, party of 4 adult guests:**
- Guest fee (HSB tier 1–4, $85/adult) → 4 × 85 = **$340**
- Targets → 30 × $2.95 = **$88.50**
- Setup / ring fee → **$49.50**
- **Total $478.00** (+ ammo add-on if chosen)

**Member, same outing:**
- No guest fee (shoots on dues)
- Targets → 30 × $2.50 = **$75.00**
- Setup / ring fee → **$49.50**
- **Total $124.50**

Reproduces the client's `(30 × rate) + 49.50`, with the guest-fee tier resolved from the existing
HSB schedule.

---

## Build checklist (one small PR)

1. **Migration** — the additive DDL above; widen `services_pricing_kind_check`.
2. **Domain type** — add `"per_target"` to `EstimatePricingKind`; add the new fields to
   `EstimateExperience`, `ServiceRow`, and the `rowToExperience` mapper
   (`src/services/public/estimate-catalog.ts`).
3. **Strategy switch** — the branch above + `usesGuestFee` change
   (`src/services/estimates/estimate-pricing.ts`); add `targetQuantities` to `EstimateSelections`.
4. **Admin write-side** — add `"per_target"` to `pricingKindSchema` and the new fields to
   `servicePricingFields` + create/update mappers (`src/services/admin/catalog.ts`).
5. **Admin editor UI** — per-target rate (member/public), allotment size, and session fee +
   label + optional description inputs in `service-editor-form.tsx` / `pricing-editor.tsx`.
6. **Public form** — a "targets / birds" stepper (steps of the allotment size) for `per_target`
   experiences feeding `targetQuantities`.
7. **Seed/dashboard** — set the HSB + Hog Heaven Helice rows (rates + $49.50 fee). The client can do
   this in the admin dashboard once the kind exists.

**Not in scope:** tournament pricing (TBD), Packsaddle, any change to `class_per_person`.

---

## Decision — settled

- **Session fee is a generic `services` column** (not an auto-attached add-on). It snapshots as a
  `fee` line item, is reusable across any experience, and keeps "add-ons = optional extras" clean.
- The admin can give it a **short label** (`session_fee_label`, shown on the line item) and an
  **optional description** (`session_fee_description`) explaining what the fee is for. The
  description is admin-editable and may be blank.

---

## Phases

**Status (2026-06-30): Phases 1–5 implemented; typecheck green; both migrations applied to
the linked DB and the Helice rows verified live. The only open item is the manual app-run
walkthrough (Phase 5 verify), which is a developer handoff per `CLAUDE.local.md` — Claude does
not start the dev server.**

Five phases, each independently shippable and verifiable. Phases 1–4 are pure dev work (typecheck
+ unit reasoning); phase 5 needs the running app, which is handed to the developer to launch
(per `CLAUDE.local.md` — Claude does not start the dev server). Run `npm run typecheck` at the end
of every phase.

### Phase 1 — Schema + domain types (foundation)

The additive migration plus the read-side type plumbing. Nothing renders or prices yet; this just
makes `per_target` a legal, round-trippable value end to end.

- **Files:**
  - New migration `supabase/migrations/<ts>_per_target_pricing.sql` — the DDL from §Schema (widen
    `services_pricing_kind_check`; add `per_target_rate_member/_public`, `target_allotment_size`,
    `target_unit_label`, `session_fee`, `session_fee_label`, `session_fee_description`).
  - `src/services/public/estimate-catalog.ts` — add `"per_target"` to `EstimatePricingKind`; add the
    new fields to `EstimateExperience` and `ServiceRow`; map them in `rowToExperience`.
  - Regenerate Supabase TS types if the project commits them.
- **Done when:** migration applies cleanly against the linked dev DB (`db push`); `npm run
  typecheck` passes; a `per_target` row can be inserted by hand and read back through
  `getEstimateCatalog` with all fields populated.

### Phase 2 — Pricing engine + carried-line classification (the heart)

The pure strategy branch. This is the part that must be exactly right; it is unit-testable with no
DB or React.

- **Files:**
  - `src/services/estimates/estimate-pricing.ts` — add `targetQuantities: Record<string, number>`
    to `EstimateSelections`; add `per_target` to the `usesGuestFee` set; add the `per_target`
    strategy branch (rate × targets, member vs public, + session fee line). See §Pricing logic.
  - `app/(public)/request-estimate/submit/action.ts` — extend `carriedKind()`: a per-target **target
    line** → `base_experience`, the **session fee** line → `fee`. Today both fall through to
    `"other"` (the classifier keys off `guest fee` / `exempt` / `tbd` only), which would mis-label
    the snapshot. Classify on a stable signal, not a label regex — simplest is to have
    `computeEstimate` tag these `EstimateLine`s (e.g. an optional `kind?: "fee" | "base"` field) so
    the classifier reads intent instead of guessing from text.
- **Done when:** the §Worked example numbers reproduce exactly for both member and non-member
  ($478.00 / $124.50); guest fees fire for a non-member per-target party and are absent for a
  member; the carried lines come out as `base_experience` + `fee` (+ `guest_fee`), none as `other`.
  Add golden-number cases here if/when a test runner lands (the module's existing TODO).

### Phase 3 — Admin write-side + editor UI

Let staff create and edit a per-target experience and its rates/fee from `/admin`.

- **Files:**
  - `src/services/admin/catalog.ts` — add `"per_target"` to `pricingKindSchema`; add the new fields
    to `servicePricingFields` (with validation: rates ≥ 0, `target_allotment_size` ≥ 1); wire them
    into the create/update field mappers.
  - `src/components/admin/service-editor-form.tsx` / `pricing-editor.tsx` — a `per_target` branch
    with inputs for member rate, public rate, allotment size, unit label, and session fee + label +
    optional description.
- **Done when:** an admin can create a `per_target` service, set both rates + the $49.50 fee + an
  optional description, save, reload, and see the values persist; `npm run typecheck` passes.

### Phase 4 — Public estimate form (targets input)

Surface the targets selector so the live preview prices per-target experiences.

- **Files:**
  - `src/components/public/estimate-intake/*` — a "targets / birds" stepper that steps by
    `target_allotment_size` (30/60/90…) and feeds `targetQuantities`, shown only when a `per_target`
    experience is selected; the live preview already calls `computeEstimate`, so it picks up the
    branch from Phase 2.
- **Done when:** selecting a per-target experience reveals the stepper; the preview total updates
  with each allotment and matches the worked example.

### Phase 5 — Seed the real Helice rows + end-to-end verify

Populate the two clubs and confirm the whole path, estimate → submitted bid snapshot.

- **Work:**
  - Set the HSB + Hog Heaven Helice rows (rates per the §Schema table, $49.50 fee, allotment 30).
    The client can do this in the admin dashboard once Phase 3 ships; alternatively seed in the
    migration for repeatable dev DBs.
  - **Developer runs the app** (Claude hands off per `CLAUDE.local.md`): walk the
    `/request-estimate` flow for a non-member HSB party and a member, submit, and confirm the
    resulting `bid_line_items` snapshot carries the target line (`base_experience`), the session fee
    (`fee`), and the guest fee (`guest_fee`) with correct amounts and the right per-club rate.
- **Done when:** both example outings produce the expected bid totals and correctly-kinded line
  items on a real submitted bid.

**Sequencing notes:** Phases 1→2→3 are a hard chain (types before engine before admin schema).
Phase 4 depends only on Phase 2. Phase 5 depends on 3 (to enter rates) and 4 (to exercise the
form). A reasonable single-PR cut is Phases 1–4 together with seed data, since each is small; split
only if review prefers the engine landing before the UI.

**Out of scope (all phases):** tournament pricing (TBD), Packsaddle, and any change to the existing
`class_per_person` kind.

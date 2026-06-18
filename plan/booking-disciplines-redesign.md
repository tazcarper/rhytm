# Plan: Redesign the booking "Choose Your Discipline" step + summary panel

## Goal
Restyle the disciplines step of the public booking funnel and the shared summary
panel to match the editorial mockup (`checkoutPage.png`): large serif header, a
vertical stack of big **photo cards** per discipline with a circular select
toggle and inline add-on rows, and a refined sticky summary (eyebrow → title →
line-item pricing → large serif total → dark full-width CTA).

**Funnel steps, navigation, and state logic are unchanged** — this is
presentation plus one new admin-managed image field.

## Scope (confirmed with the developer)
- **Disciplines step** (`booking-builder.tsx` step 1, lines ~412–554) + its CSS.
- **Shared summary panel** (`booking-summary.tsx` + CSS). Note: this renders on
  *every* funnel step and on `/details`, so restyling it touches all of those
  visually (by design).
- **New:** admin-managed image per discipline (`services.image_url`), mirroring
  the existing add-on image feature (migration `20260618120000`).
- **Out of scope:** guests step, when/calendar step, booking-type picker,
  details form layout, any flow/IA/state change.

## Decisions captured
- Image source: **admin-managed image per discipline** (migration + admin upload
  + service field). Developer mode — backend work is fine.
- Reach: **disciplines step + shared summary panel** only.
- Behavior: **visual restyle only** — no funnel/state/nav changes.

---

## Phase 1 — Discipline image: data + storage (mirror of add-on images)
1. **Migration** `supabase/migrations/<ts>_service_image.sql`:
   - `alter table services add column if not exists image_url text;` with a
     comment (NULLABLE → card falls back to a branded placeholder).
   - Create public `service-images` bucket (copy the `add-on-images` bucket
     insert: public, 10 MB cap, raster MIME allowlist, `on conflict do nothing`).
     Existing `services` RLS already covers the new column — no policy change.
   - Apply via `db push` (linked cloud DB, per dev workflow).
2. **Storage adapter** `lib/storage/service-image-storage.ts` — thin alias over
   `createPublicImageStorage` pinned to `service-images`, copying
   `add-on-image-storage.ts` verbatim (`createServiceImageStorage`).

## Phase 2 — Admin: upload a discipline photo
3. In the services edit surface
   (`app/admin/properties/[id]/catalog/services/[serviceId]/edit/page.tsx` + its
   `actions.ts`/editor component), add an image upload field, reusing the exact
   pattern the add-on edit page already uses (upload control → server action →
   `service-image-storage` → save `image_url`). Clone the add-on image field.

## Phase 3 — Surface the image to the public funnel
4. `src/services/public/services.ts`: add `imageUrl: string | null` to
   `PublicService`, add `image_url` to the `services` select and `ServiceRow`,
   map it through (identical to how `PublicAddOn.imageUrl` is already handled).

## Phase 4 — Redesign the discipline cards (core visual change)
5. `booking-builder.tsx` step-1 markup: restructure each
   `<article className={s.disciplineCard}>` into the editorial layout — **photo
   (left/top)** + text block (serif name + description) + **circular select
   toggle** (replacing the `+`/`✓` mark glyph). Render `svc.imageUrl` via
   `next/image`, with a branded placeholder when null. Add-on rows stay
   functionally identical (same toggle/qty/tooltip handlers) but get refined
   inline styling under the selected card.
6. Update the section header to the editorial treatment: eyebrow (property +
   booking-type context) → large serif "Choose Your Discipline" → hairline rule.
7. `booking-builder.module.css`: rewrite `.disciplineCard`, `.disciplineHeader`,
   `.disciplineTitle`, `.mark`, `.addOnGroup`/`.addOnRow` etc. to the photo-card
   layout using existing tokens (`--paper`, `--cream`, `--olive`, `--serif`,
   `--shadow-soft/-lift`, `--radius-card`). Keep the `data-selected` hooks.
   Preserve the 960px stack and touch behavior.

## Phase 5 — Refine the summary panel
8. `booking-summary.tsx` + `booking-summary.module.css`: tighten to the
   mockup — eyebrow label, serif booking-type title, cleaner line-item rows
   (right-aligned prices), prominent large-serif total, dark full-width primary
   CTA styling (the `cta` prop already exists; no logic change). Keep the
   team-quoted branch, remove-add-on buttons, and per-guest-fee section intact.

## Phase 6 — Verify
9. `npm run typecheck` (Claude runs this).
10. Hand off to the developer to run `npm run dev` for visual verification:
    multi-select visit, single-select private lesson, host-an-occasion bypass
    (no disciplines), a discipline with/without a photo, and the summary on
    `/details`. (Claude does not start the dev server — `/mnt/c` 9p mount blocks
    Turbopack's lockfile; this repo is on ext4 now but the hand-off stands.)

## Notes / smaller decisions
- **`next/image`** for discipline photos; confirm `next.config` `remotePatterns`
  already allows the Supabase storage domain (add-on/adventure images use it).
  If not, that's a foundational file → flag to developer.
- **Placeholder** when `image_url` is null: branded olive/cream block (same
  graceful-degradation principle as the add-on detail pop-up).
- Multi-file change spanning migration + admin + public, but low-risk: follows
  the proven add-on image pattern.

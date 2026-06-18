# Plan — populate add-on detail content (photo + "what's included")

Status: **implemented 2026-06-18** · Scope: data/admin follow-up to the add-on detail pop-up UI

> **Done.** Two migrations:
> `20260618120000_add_on_detail_content.sql` adds `add_ons.image_url` +
> `included_detail` and the public `add-on-images` bucket;
> `20260618130000_add_on_max_quantity.sql` adds `add_ons.max_quantity`
> (admin-set ceiling, default 1). `getPublicServicesForProperty` +
> `catalog.ts` select/map all three; the admin add-on editor gained a
> "what's included" textarea, a photo upload (`uploadAddOnImageAction` →
> `add-on-image-storage`), and a "Maximum quantity" field. In the funnel the
> learn-more is now a hover/tap **tooltip** (`add-on-detail-tooltip.tsx`,
> popover API, informational) and the right slot shows a quantity stepper
> when selected for add-ons whose `max_quantity > 1`. **Remaining:** apply
> BOTH migrations to the linked DB (`npx supabase db push`) — the public +
> admin reads now select these columns, so they error until applied — then
> have staff set photos / "what's included" / max-quantity in `/admin`.
> Original plan kept below for reference.

## Why this exists

The add-on detail pop-up (`<AddOnDetailDialog>`) shipped UI-first. Its image
slot and "what's included" line read from two **optional** fields on
`PublicAddOn` that are not yet sourced from the database:

```ts
// src/services/public/services.ts
imageUrl?: string | null;
includedDetail?: string | null;
```

Today both are always `undefined`, so the dialog renders a branded placeholder
panel and omits the included line — intentional, non-broken degradation. This
plan wires real content end-to-end: a column pair on `add_ons`, admin editing,
and the public read mapping.

## Picking this up cold

- **What already exists (don't rebuild):**
  - The pop-up + trigger: `src/components/public/booking-flow/add-on-detail-dialog.tsx`
    (+ `.module.css`) and the circled-i trigger in `booking-builder.tsx`. They
    already render `imageUrl` (with skeleton → photo crossfade and an error
    fallback) and `includedDetail` when present. **No funnel UI work remains.**
  - `add_ons` table (migration `20260520...` / foundation): `id, property_id,
    name, description, price, is_active, display_order, created_at, updated_at`,
    `handle_updated_at` trigger, RLS = public-read-active + admin-read-all
    (+ admin write policies).
  - Admin catalog editor: `src/components/admin/add-on-editor-form.tsx`
    (name/description/price) + `catalog-add-ons-panel.tsx`.
  - Public read: `getPublicServicesForProperty` in
    `src/services/public/services.ts`.
  - An existing Blob image-upload pattern to copy:
    `lib/storage/homepage-image-storage.ts` + `app/admin/homepage/*` (Vercel
    Blob is the project's file store).
- **Dev environment:** Node 24 via nvm (on PATH). Developer applies migrations
  against the LINKED cloud Supabase with `npx supabase db push` (no Docker, not
  `db reset`). Keep `npm run typecheck` clean. Don't start the dev server —
  hand anything that needs the running app to the user.

## Decision: two new columns, not a side table

`add_ons` is small and one-photo-per-add-on. Add the fields directly; a child
`add_on_media` table is over-engineering until an add-on needs a gallery.

## Steps

1. **Migration** — `npx supabase migration new add_on_detail_content`:
   ```sql
   ALTER TABLE add_ons
     ADD COLUMN image_url       text,
     ADD COLUMN included_detail text;
   ```
   No RLS change (existing `add_ons` policies cover the new columns). `image_url`
   stores the Vercel Blob URL; `included_detail` is a short "what's included"
   sentence. Both nullable — the dialog already degrades gracefully.

2. **Public read** — in `getPublicServicesForProperty`, add `image_url,
   included_detail` to the `add_ons (...)` select and map them onto the returned
   object (`imageUrl: a.image_url, includedDetail: a.included_detail`). Drop the
   `TODO(add-on-content)` comment on `PublicAddOn` once wired.

3. **Admin editing** — extend `add-on-editor-form.tsx` + its server action:
   - `included_detail`: a `<Textarea>` (short, ~160 char soft cap). Mirror the
     existing description field plumbing.
   - `image_url`: a file input that uploads to Blob via the
     `homepage-image-storage.ts` pattern (landscape crop guidance ~16:10; store
     the returned URL). Reuse the homepage hero's upload action shape; do not
     hand-roll a second Blob client.
   - Validate/trim like the existing fields; keep the action thin (validate →
     service → return), per the SOLID notes in CLAUDE.md.

4. **Backfill content** (ops, not code): once admins can edit, staff add a photo
   + included line per add-on through `/admin` (this is managed content — the
   `dashboard-content-guard` blocks editing it via migration on purpose).

## Acceptance criteria

- An add-on with a photo + included line set in `/admin` shows them in the
  booking-funnel detail pop-up: photo crossfades in after its skeleton, included
  line sits under the price.
- An add-on with neither still renders the branded placeholder and omits the
  included line (no broken image, no empty line).
- `npm run typecheck` clean; existing add-on create/edit/price flows unaffected;
  existing booking add-on snapshots untouched (this is catalog content, not the
  per-booking `booking_add_ons` snapshot).

## Out of scope

- Multiple images / gallery per add-on.
- Alt-text authoring (detail imagery is decorative; the name + description carry
  meaning, so the dialog uses empty `alt`). Revisit only if a photo ever carries
  information not in the text.

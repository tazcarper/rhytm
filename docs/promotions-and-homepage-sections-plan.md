# Build Plan — Promotions + Homepage Sections Editor

**Date:** 2026-07-08 · **Branch:** `dashboard-migration` · **Follows:** [`headless-cms-evaluation.md`](./headless-cms-evaluation.md)
**Pattern basis:** `homepage_hero` (singleton config-in-DB) and `member_adventures` (multi-row CRUD
with images, scheduling, publish status). Both features are pure extensions of established shapes:
**migration + RLS → service → thin action → admin form → public render → nav + content-guard.**

---

## Feature A — Promotions (reusable sales/seasonal events)

The genuinely new capability from the CMS evaluation: a content type staff can compose once,
schedule, place on one or more pages, publish, then **archive and re-run** later.

### A1. Migration — `supabase/migrations/<ts>_promotions.sql`
`promotions` table:
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `title` | `text NOT NULL` | internal + heading |
| `eyebrow` | `text` | small label above title |
| `body` | `text` | Markdown, rendered via `MarkdownProse` |
| `image_url` | `text` | reuses the existing `homepage-images` bucket |
| `cta_label` / `cta_href` | `text` | optional button |
| `placements` | `text[] NOT NULL DEFAULT '{}'` | `CHECK (placements <@ ARRAY['homepage_band','property_page','adventures_page'])` — multi-page |
| `status` | `text NOT NULL DEFAULT 'draft'` | `CHECK IN ('draft','published','archived')` |
| `starts_at` / `ends_at` | `timestamptz NULL` | NULL = open-ended window |
| `sort_order` | `int NOT NULL DEFAULT 0` | tie-break when several are active |
| `created_at` / `updated_at` | `timestamptz DEFAULT now()` | `updated_at` via `handle_updated_at` trigger |

`promotion_properties` join table (multi-club targeting, chosen over a nullable FK):
- `promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE`, `property_id uuid REFERENCES properties(id) ON DELETE CASCADE`, `PRIMARY KEY (promotion_id, property_id)`.
- **Semantics: no rows = all clubs; rows present = only those clubs.** Public resolution reads the join as an embedded select and filters in JS — no cross-table RLS subquery.

- Index on `status`; no seed rows (starts empty, list has an empty state).
- **RLS** (no cross-table refs → no policy-cycle risk):
  - `promotions: public read active` — `SELECT USING (status='published' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()))`
  - `promotions: admin all` — `FOR ALL USING ((SELECT auth.jwt()->'app_metadata'->>'role') IN ('super_admin','admin'))` with matching `WITH CHECK`. (Admin-only writes, mirroring `homepage_hero` — promotions are site-wide marketing, not a per-property-manager concern.)
- No new storage bucket: the upload action reuses `createHomepageImageStorage` (`homepage-images`, public, service-role writes).

### A2. Services
- `src/services/public/promotions.ts` — `getActivePromotions(supabase, { placement, propertyId? })`: published + in-window + placement match + (`property_id IS NULL OR = propertyId`), ordered by `sort_order`. Domain `Promotion` type + row→domain mapper.
- `src/services/admin/promotions.ts` — `getPromotionsList`, `getPromotion(id)`, `savePromotion` (insert/update) with `SavePromotionSchema` (reuses the `optionalText`/`optionalHref` zod helpers from `homepage-hero.ts`). Returns `{ ok, id, error? }`.

### A3. Actions — `app/admin/promotions/actions.ts`
- `savePromotionAction(input)` — validate → service → `revalidatePath('/admin/promotions','/', '/adventures')` (+ property routes).
- `deletePromotionAction(id)` — hard delete (no FK references it); archiving is the softer path via status.
- `uploadPromotionImageAction(formData)` — auth-gate + service-role upload (copy of the hero image action).

### A4. Admin UI
- `app/admin/promotions/page.tsx` — list via a `PromotionsDataTable` client wrapper (reuses the new `DataTable` from the redesign): columns Title · Placements · Scope · Status badge · Window. "New promotion" → `/admin/promotions/new`.
- `app/admin/promotions/new/page.tsx` + `app/admin/promotions/[id]/page.tsx` — both render `PromotionEditorForm`.
- `src/components/admin/promotion-editor-form.tsx` — title, eyebrow, `MarkdownField` body, image (upload+URL, reusing `downscaleImage`), CTA label/href, placement checkboxes, property `<select>` (All + each club), status select, start/end datetime inputs, sort order. Save via `savePromotionAction`.
- `src/components/admin/promotion-status-badge.tsx` — `Badge` variants (draft→`draft`, published→`open`, archived→`past`).

### A5. Public render
- `src/components/public/promotion-band.tsx` — server-rendered band in the **estate register** (no countdowns / "only N left" / urgency theater, per `DESIGN.md`). Eyebrow + serif title + Markdown body + optional CTA + optional image.
- Wire `getActivePromotions` into: `app/page.tsx` (`homepage_band`), the public property page (`property_page`, scoped to that `propertyId`), and `app/(public)/adventures/page.tsx` (`adventures_page`).

### A6. Nav + guard
- Add **Promotions** to the admin sidebar (Programming group) in `admin-sidebar.tsx`.
- Register `promotions` in `.claude/hooks/dashboard-content-guard.mjs` → `{ label: "Promotions", path: "/admin/promotions" }` so future client SQL is redirected to the admin page.

---

## Feature B — Homepage sections editor

Move the still-hardcoded editorial blocks in `app/page.tsx` into the DB: the "Why Rhythm"
manifesto pullquote, the Adventures + How-It-Works section headers/decks, the five how-it-works
steps, the How-It-Works card title, and the final CTA block. (The hero is already DB-backed.)

### B1. Migration — `<ts>_homepage_content.sql`
Singleton `homepage_content` (`id smallint PK DEFAULT 1 CHECK (id = 1)`), exactly mirroring the
`homepage_hero` shape:
- Text columns: `manifesto_quote`, `manifesto_attribution`, `adventures_eyebrow`, `adventures_title`, `adventures_deck`, `how_eyebrow`, `how_title`, `how_deck`, `how_card_title`, `final_cta_eyebrow`, `final_cta_title`, `final_cta_deck`.
- `steps jsonb NOT NULL DEFAULT '[]'` — array of `{ num, label, desc }` (repeatable-rows precedent = adventure chapters).
- `updated_at` + trigger. RLS identical to `homepage_hero` (public read, admin write).
- **Seed id=1 with the exact current copy** so the page is pixel-identical the moment it ships.

### B2. Service
- `src/services/public/homepage-content.ts` — `getHomepageContent()` → domain type, with a `FALLBACK_HOMEPAGE_CONTENT` constant (same copy) so the page renders even if the row is missing (mirrors `getHomepageHero`).
- `src/services/admin/homepage-content.ts` — `updateHomepageContent` + `UpdateHomepageContentSchema` (steps validated as `{num,label,desc}[]`).

### B3. Action — extend `app/admin/homepage/actions.ts`
- `updateHomepageContentAction(input)` — validate → service → `revalidatePath('/admin/homepage','/')`.

### B4. Admin UI — extend `app/admin/homepage/page.tsx`
- Render a second `Card` below the existing hero form: `HomepageContentForm` (`src/components/admin/homepage-content-form.tsx`) — grouped text fields + a small repeatable steps editor (add/remove/reorder rows). Same `Group` + field styling as the hero form.

### B5. Render swap — `app/page.tsx`
- Fetch `getHomepageContent()` alongside the hero; replace the hardcoded manifesto / section headers / `Step` list / final-CTA text with values from it. **CSS and layout unchanged** — only the strings become data.

### B6. Guard
- Register `homepage_content` (and `homepage_hero`, currently unlisted) in the content-guard map → `{ label: "Homepage", path: "/admin/homepage" }`.

---

## Conventions honored (from CLAUDE.md / project rules)
- **SOLID**: thin actions (validate → service → revalidate); services take an injected `SupabaseClient`; services return clean domain types, never raw PostgREST rows.
- **RLS on every table**, `auth.jwt()` wrapped in `(SELECT …)`, no inline cross-table subqueries.
- **Config-in-DB** over TS constants; **intent-revealing names** (no `raw`/`q`/`fmt`).
- Reuses existing infra: `homepage-images` bucket, `downscaleImage`, `MarkdownField`, `Badge`, the redesign `DataTable`.

## Sequencing & verification
1. Feature A end-to-end → `npm run typecheck`.
2. Feature B end-to-end → `npm run typecheck`.
3. **Migrations:** written as files; applying them to the linked cloud Supabase (`supabase db push`, per the dev DB workflow) is a state-changing step I'll pause for your go-ahead on — or you run it.
4. Visual review by you (`npm run dev`): `/admin/promotions` (create/publish/archive, the public band on `/`, a property page, `/adventures`), and `/admin/homepage` (edit a section, confirm `/` matches).
5. No git commits/pushes (per your workflow — you push via Cursor).

## Schema decisions (locked 2026-07-08)
1. **Property scope** — full multi-club targeting via `promotion_properties` join table (empty = all clubs).
2. **Placement** — `placements text[]`; one promo can appear on several page types at once.

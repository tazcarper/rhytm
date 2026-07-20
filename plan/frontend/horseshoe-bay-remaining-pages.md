# Rhythm Outdoors — New Front-End + Events/Inquiries (Horseshoe Bay Pilot)

## Status as of 2026-07-18 (later pass): header logo vs. footer logo were the same field

Client caught that Hog Heaven's footer should use the vertical/on-dark mark
(`hogheaven_logo_primary_vertical_on-dark.png`), not the horizontal/on-light one the
header uses. Turned out `PropertyProfile` only ever had one `logoSrc` field —
`PropertyFooter` was reading the same header logo, dark band or not. **This was already
wrong for Horseshoe Bay too**, just unnoticed: its own mockup references a distinct
`horseshoebay_logo_primary_vertical_fullcolor_on-dark.png` for the footer that was never
even handed off into `assets/` (file doesn't exist in `temporary-resources/`), so nobody
caught the footer silently reusing the light-background mark on a dark band.

Fixed generically, not just for Hog Heaven:
- New `footerLogoSrc: string` field on `PropertyProfile` (`property-profiles.ts`) — every
  property sets it explicitly (no `?? logoSrc` fallback at the render site, matching this
  project's display-defaults-belong-in-state rule). Horseshoe Bay's is set to the same
  horizontal mark as a documented placeholder (no real dark-mode asset exists yet); Hog
  Heaven's is set to its real vertical/on-dark PNG.
- `PropertyFooter` now renders `profile.footerLogoSrc` instead of `profile.logoSrc`.
- **Yes, this is admin-editable, per-property, same as the header logo** — added a
  parallel `basics`/`footer-logo` single-image section to
  `src/constants/admin/property-page-sections.ts` (shows up right under "Logo" in the
  Basics tab) and wired it into `getResolvedPropertyProfile` alongside the existing logo
  read. Needed zero new DB table/migration — same `property_page_content` row shape,
  just a new `section_key`. Falls back to the hardcoded default above until an admin
  uploads one.

`npm run typecheck` clean.

---

## Status as of 2026-07-18: Hog Heaven homepage built (first page of its own migration)

Started migrating Hog Heaven onto the same property-template system, source mockup
`temporary-resources/front-end-beta/hog-heaven/*.html`. Per client instruction, built
**only the homepage first** for review before continuing to the rest of Hog Heaven's
9 pages — same page-by-page sequencing the Horseshoe Bay pilot itself didn't need, but
requested explicitly this time.

Confirmed the property-template component library (`Section`, `PropertyHeader`,
`PropertyFooter`, `PropertyImage`, `FacilityCard`, `PropertyButton`, `RuleDivider`) is
already fully property-agnostic as designed — zero component changes needed to stand up
a second property, only new theme tokens + config + a new route group, exactly as
`property-themes.css`'s own header comment promised.

**What was added:**
- `[data-property="hog-heaven"]` block in `src/styles/property-themes.css` — palette
  transcribed 1:1 from the mockup's inline tailwind config. Two new **shared** theme
  tokens/`Section` tones added (`--property-moss` / `tone="moss"`, `--property-paper` /
  `tone="paper"`) because Hog Heaven's mockup uses **two distinct dark-green section
  fields** (hunter-mid for the campaign line, moss for the Join CTA) where Horseshoe
  Bay's mockup reused one "sage" everywhere — collapsing them into the existing single
  `sage` tone would have lost that real mockup distinction (see hard-won lesson #3 in
  the section below: match the mockup's actual color semantics). `--property-ink-dark`
  (hover-darkening shade) has no source in Hog Heaven's own mockup config at all — set
  to a plain near-black since Hog Heaven's ink is already near-black.
- Hog Heaven entry in `src/constants/public/property-profiles.ts` (nav, contact,
  office hours, social links, sibling-property cross-links — same shape as Horseshoe
  Bay's entry, content transcribed from the mockup's shared footer).
- `app/(public)/hog-heaven/layout.tsx` + `page.tsx` — same structure as Horseshoe Bay's
  homepage (hero → intro → Find Your Way In → campaign line → facilities → featured
  events → Join CTA), content/copy transcribed from Hog Heaven's own `index.html`, not
  copy-pasted from Horseshoe Bay's. Notably Hog Heaven's mockup omits the eyebrow line
  above several headings (intro, facilities, featured events, join CTA) that Horseshoe
  Bay's mockup has — left those out rather than adding invented copy, per-mockup fidelity
  over template uniformity. `getPropertyPageSection`/`getPublicEvents` calls are
  identical in shape to Horseshoe Bay's — CMS integration (admin-editable home-page
  sections) works immediately with zero DB/admin changes, since `property_page_content`
  is already keyed by `property_id` + `page_key` + `section_key` and Hog Heaven's
  `properties` row already existed (seeded back in the original phase-1 migration).
  Un-provided photography renders via `PropertyImage`'s graceful placeholder, same
  pattern as Horseshoe Bay before its own photography landed.
- Placeholder font pairing: Spectral (display, has italic) + Work Sans (sans), standing
  in for the mockup's paid Typekit pair (arpona/arponasans) — deliberately a **different**
  Google Fonts pairing than Horseshoe Bay's Fraunces/Libre Franklin so the two properties
  still read as visually distinct clubs even before real licensing/fonts are confirmed.
- Copied the two real logo files (`hogheaven_logo_primary_horizontal_on-light.png`,
  `..._vertical_on-dark.png`) from the mockup's `assets/` into
  `public/properties/hog-heaven/` — `PropertyHeader`/`PropertyFooter` render `<img>` with
  no fallback, so these needed to exist as real files, unlike every other image slot on
  the page (which uses `PropertyImage`'s placeholder).
- Added `/hog-heaven` to `SUPPRESSED_PREFIXES` in `src/components/shared/site-header.tsx`
  — the global `<SiteHeader>` route-suppression list already had `/horseshoe-bay`; missing
  this would have double-rendered the global header on top of `PropertyHeader` (same class
  of bug as hard-won lesson #4 below, different mechanism).
- **Real bug fixed in a shared component, not a Hog-Heaven-only hack:** `PropertyButton`'s
  `primary` variant paired `bg-property-accent` with `text-property-ink` — but the
  `property-on-primary` token (white, for text-on-accent-surfaces) already existed and was
  simply never wired up, because `primary` had **zero existing call sites** in the
  Horseshoe Bay build (only `secondary`/`ghost` were ever used). Hog Heaven's own Join CTA
  button is the first real usage of `primary`, and its mockup explicitly specifies white
  text on the accent surface — fixed `primary` to use `text-property-on-primary`. Zero
  regression risk (nothing else calls it), and correct per the token's own purpose.

`npm run typecheck` clean. **Not yet Playwright-verified or seen by the client** — next
step is the client's visual review of the homepage before continuing to Hog Heaven's
remaining 8 pages (club-life, adventure, education, membership, events + event-detail,
private-events).

**Still open for Hog Heaven specifically:**
- No real photography for any slot yet (hero, intro, way-in tiles, facility cards) —
  all render `PropertyImage` placeholders until real assets are handed off.
- Real Adobe Typekit fonts (arpona/arponasans) — same deferred-pending-licensing status
  as Horseshoe Bay's shackleton/freight-neo-pro.
- The remaining 8 pages are untouched — this pass was homepage-only, by explicit request.

---

## Status as of 2026-07-18 (later pass): Admin nav + form simplification, Club Life built

Client feedback: (1) the admin sidebar's "Properties" item should expand in place to
list each property rather than jumping straight to the first one, and (2) the
content-management forms showed fields the public page never reads (e.g. the Logo
section showed Heading/Body/Button label/Button link/Image when only Image does
anything).

**1. Expandable Properties nav.** `app/admin/layout.tsx` now fetches the properties
list and passes it to `AdminSidebar`; "Properties" is a collapsible group (new
`ExpandableNavLink` in `admin-sidebar.tsx`) that auto-opens under `/admin/properties/*`
and lists every property as a direct link to its workspace.

**2. Per-section field visibility.** Audited every `kind:"single"`/`kind:"items"`
section in `property-page-sections.ts` against what its public page component
actually reads, then added `fields`/`itemFields`/`maxItems` to the config so each
admin form only renders inputs that do something — e.g. Logo now shows just the image
picker, Social Links shows Title + Link only. `property-page-content-form.tsx` and
`property-page-items-form.tsx` both read these to conditionally render.

**3. Found and fixed a real gap while auditing.** Club Spotlight (membership) and The
Setting (private-events) each render a 3-photo gallery on the public page by reading
`items[].imageUrl`, but the admin form for `kind:"single"` sections never rendered an
items editor — there was no way to set those photos from admin at all. Added a new
`kind:"hybrid"` (heading/body plus a small photo-only items list, saved together in
one upsert since the underlying row is one record) and converted both sections to it.

**4. Dropped `linkLabel`.** Zero UI, zero public consumer, on `PropertyContentItem`
since the type was introduced — removed from the type, the admin zod schema, and the
items form's save path.

**5. Built the Club Life page** (`/horseshoe-bay/club-life`) — previously linked from
the header nav and the homepage's "Find Your Way In" tile but 404ing, since the
original 9-page pilot explicitly left it out of scope. The source mockup
(`temporary-resources/front-end-beta/horseshoe-bay/club-life.html`) turned out to need
more than a transcription: two of its sections are live widgets pulling from a
different, throwaway Supabase project via a hardcoded URL in the mockup's own JS
(`rhythm-posts.js`, `rhythm-events.js`), not this project's schema —
  - **"The Latest"** is a full blog/post feed (`posts` table: title/body/image/
    category/featured/published_at) with a lead-row layout and a collapsing archive.
    Nothing like this exists in this project.
  - **"Standing Programs"** pulls from `events.type === 'Standing'`, but this
    project's real `events` table deliberately has no `type` column — the same
    mismatch already flagged for the Events listing page (see "Events listing has no
    type/discipline filters" below).
  Client chose (asked directly): **build the real parts now, skip the rest** — same
  precedent as the Events listing page already diverging from this mockup's throwaway
  schema. Built: hero, a real "What's Next" upcoming-events strip (reuses
  `getPublicEvents`, same card markup as the homepage's featured-events section), a
  "Join the Members' Group" Facebook CTA band, and an Instagram section (admin-editable
  handle + follow link, up to 5 photos with optional per-photo links). Both the blog
  feed and Standing Programs are **not** built — revisit only if the client asks for a
  posts table or an events schema change specifically.
  New page key `club_life` added to `PropertyPageKey`, the admin zod schema, and the
  `property_page_content_page_key_check` CHECK constraint (migration
  `20260719160000_property_page_content_club_life.sql`, applied directly to the live
  linked project via the Supabase MCP `apply_migration` tool). Three new sections in
  `property-page-sections.ts`: `community` (single), `instagram` (single),
  `instagram-photos` (items, max 5) — none seeded, the page's `DEFAULT_*` fallbacks
  already match the mockup copy exactly (same pattern as every other page before its
  later seeding pass).

`npm run typecheck` clean after all of the above. **Not yet Playwright-verified** —
same as the prior pass, this needs a browser check once the dev server is running:
sidebar expand/collapse, the simplified forms actually save/render correctly, the two
new hybrid galleries, and the new Club Life page (hero, events strip, CTA, Instagram
grid, and that the header/homepage/footer links to it no longer 404).

---

## Status as of 2026-07-19 (later pass): Admin workspace re-scoped for launch

Following the full content-coverage pass below, the client asked for two more rounds of
changes to the `/admin/properties/[id]` workspace:

**1. Audited which admin tabs the new front end actually uses.** Grepped every consumer of
`services`/`add_ons`/`service_add_ons`/`catering_options`/`pricing_rules` and the old
`property-settings-form.tsx` fields — none of it is read anywhere under
`app/(public)/horseshoe-bay/*`. All five (Basics as originally scoped, Experiences, Add-ons,
Catering, Guest fees) only feed the legacy `/request-estimate` and `/book/[property]` funnels,
which Hog Heaven/Packsaddle still use.

**2. Hid Experiences / Add-ons / Catering / Guest fees / FAQ tabs globally**, per explicit
client instruction, accepting the tradeoff that Hog Heaven/Packsaddle staff lose admin
editing of their old-funnel catalog/pricing/guest-fees until those properties get their own
front-end migration. Nothing underlying was deleted — services, components, DB tables, and
`FaqEntriesEditor`/`property_faq_entries` all still exist, just unreferenced by
`PROPERTY_SECTIONS` (`src/constants/admin/property-sections.ts`). Trivial to bring back later.

**3. Added a dedicated "Events" top-level tab** (distinct from the "Events" entry inside
Marketing pages, which still holds page *copy* like the included-with-membership band). Shows
a property-scoped upcoming-events `DataTable` (new `getUpcomingEventsForProperty` in
`src/services/admin/events.ts` — filters `events` by `property_id` + `start_at >= now()`,
ascending) plus an "Add event" button. Both this tab's button and the Marketing-pages Events
sub-tab's button link to `/admin/events/new?propertyId=<id>` — `EventEditorForm` now accepts
an optional `defaultPropertyId` prop and `NewEventPage` reads it from the `propertyId` search
param, pre-selecting the property instead of defaulting to `properties[0]`.

**4. Re-added "Basics" as its own top-level tab, re-scoped.** Not the old form (tagline,
directions, parking, booking horizon — audited as unused by any current route). New scope:
Logo, Address, Contact, Office hours, Social links — the actual facts the header/footer read.
Implemented as `page_key = 'basics'` rows in `property_page_content` (widened CHECK to add
`'basics'`/`'layout'`), reusing the exact same single-block/items form components as Marketing
pages — zero new form code, just new config entries in
`src/constants/admin/property-page-sections.ts` and a thin `PropertyBasicsPanel` (no
page-picker needed, since "basics" is only ever one fixed page). Office hours and social
links are `items` sections (Title/Body or Title/Link reused generically).

**5. Added a "Layout" entry inside Marketing pages' page-picker** for cross-page chrome —
currently just a "Footer" section (newsletter heading + blurb). `PropertyProfile` gained
`newsletterHeading`/`newsletterBlurb` fields; `PropertyFooter` reads them instead of literal
strings.

**6. The public site now actually reads Basics/Layout** — previously `PropertyHeader`/
`PropertyFooter` read 100% from the hardcoded `PROPERTY_PROFILES` constant
(`src/constants/public/property-profiles.ts`) with no DB path at all. New
`src/services/public/property-profile.ts` (`getResolvedPropertyProfile`) merges the 6
basics/layout DB sections over that hardcoded fallback (same pattern as every other
content section); `app/(public)/horseshoe-bay/layout.tsx` calls it instead of the raw
`getPropertyProfile`. Phone tel-href is derived from the stored display phone
(`+1` + digits-only) rather than stored separately. Seeded Horseshoe Bay's real
basics/layout values (identical to what was hardcoded) so nothing changed visually.
Saves revalidate with `revalidatePath('/horseshoe-bay', 'layout')` (not a single route) since
basics/layout affect every page under that layout, not one page.

**Bug caught and fixed during this pass:** the membership page's ambassador-blurb parsing
(`body.split("\n\n")`) was destructured with an off-by-one (`[name, ...rest]` when the stored
body is actually `[blurb, role]`, no name) — displayed the role text where the blurb should
render. Fixed to `const [blurb, role = "Membership Ambassador"] = body.split("\n\n")`. Lesson:
when a single `body` field is later split client-side into multiple display fields, double
check the split actually matches what was seeded, not what you assume the shape is.

**Also fixed:** a shorthand-fragment-with-key bug in the membership pricing render (`<>...</>`
returned from `.map()` can't take a `key` — needed `<Fragment key={...}>` from `"react"`
instead) caught before it ever hit typecheck (tsc doesn't flag it; would have been a silent
runtime "missing key" console warning).

**Correction note:** mid-session the client asked to seed Hog Heaven's marketing pages from
its own mockup (`temporary-resources/front-end-beta/hog-heaven/*.html` — a full mockup set
exists there, same shape as Horseshoe Bay's), then immediately corrected that to "do it for
Horseshoe Bay, we have that hooked up already" — so Hog Heaven's mockups remain untranscribed.
If a future session is asked to populate Hog Heaven content, that mockup set is the source —
same section-key vocabulary as Horseshoe Bay's, just no Hog Heaven front-end pages exist yet
to consume it (population would be "get a head start," not wire anything live).

---

## Status as of 2026-07-19: Full admin-dashboard content coverage COMPLETE

Extended the pilot's narrow "intro section only" admin editing (2026-07-18) to cover
**every hardcoded content block across all 9 pages**, per explicit client request. Summary:

- **`property_page_content` generalized**: `page_key` widened to include `home`/`events`/
  `adventures` (previously only membership/education/private_events); added an `items jsonb`
  column for repeating-card sections (benefit tiles, amenity cards, occasion cards, programs,
  onboarding steps, gallery images, pricing figures) — a section is either single-block
  (heading/body/image/cta) or items-based, decided per-section by
  `src/constants/admin/property-page-sections.ts` (property-agnostic — reused automatically
  by Hog Heaven/Packsaddle once they exist, no admin-UI changes needed per property).
- **Database is now authoritative, not a thin override layer**: every identified section
  across home/membership/private-events/education/events/adventures was seeded with the
  real current copy (migrations `20260719140000`–`20260719141000`), so the admin editors show
  real content to edit/add/remove from day one instead of blank fields.
- **Generic admin editors**: `PropertyPageContentForm` (single-block, generalized from the
  old "intro"-only form) and new `PropertyPageItemsForm` (add/remove/reorder card editor,
  same idiom as `EventInfoBoxEditor`) — both reused across every section via the config map.
  New `PropertyContentImageInput` gives every section real image upload (new
  `property-content-images` public bucket + `uploadPropertyContentImageAction`), closing the
  "no image-upload capability" gap flagged in the 07-18 pass.
- **Education's instructor roster** now reads the real `/admin/instructors` system
  (`src/services/public/instructors.ts`) instead of a hardcoded array. The real 7-person
  roster (Casey Duran, Adam McCaw, etc.) was seeded into `instructors`/`instructor_properties`/
  `instructor_disciplines` for Horseshoe Bay (migration `20260719150000`); 3 Horseshoe-Bay-only
  dev placeholder rows were deactivated. Two shared multi-property dev fixtures ("Nick", "Taz C
  C") were deliberately left untouched — they're also available at Hog Heaven/Packsaddle and
  out of scope for this pass.
- **FAQ is a new dedicated table** (`property_faq_entries`, not folded into
  `property_page_content` — a flat, freely add/edit/remove/reorder list doesn't fit the
  "named section" model). Fully authoritative (no hardcoded fallback); seeded with all 50
  Q&As across 13 categories transcribed from the old `faq-data.ts` (now deleted). Admin CRUD
  at the property workspace's new "FAQ" tab (`FaqEntriesEditor`).
- New "FAQ" tab added alongside "Marketing pages" in `PROPERTY_SECTIONS`
  (`src/constants/admin/property-sections.ts`); both tables registered in
  `dashboard-content-guard.mjs`'s table map.
- **Deliberate scope boundary**: per-page structural chrome (eyebrow labels, repeated section
  titles like "Premier Amenities") stays hardcoded, matching the intro sections' existing
  precedent (eyebrow hardcoded, heading/body/cta/items editable) — only real *content*
  (numbers, copy, cards, roster, FAQ) became data. Redraw this line if the client asks for
  section-title editing too.

---

## Status as of 2026-07-18: Horseshoe Bay pilot build COMPLETE

All 9 in-scope Horseshoe Bay pages are built, typecheck-clean, and verified in-browser via Playwright MCP (screenshots + zero-console-errors checks on every page). Full event registration flow (confirmed + waitlist fallback) exercised end-to-end against the live linked Supabase project, including admin roster verification, then test data cleaned up.

**Pages built:** homepage, membership (+ inquiry form), private-events (+ proposal form), education (+ instructor filter), events listing, event detail + registration (+ capacity/waitlist), adventures (re-skin of existing system), FAQ (13 categories, 45+ Q&As). Club Life is explicitly out of scope (unchanged from original plan).

**Also complete:** `property_page_content` schema + admin editor. One table (`property_id, page_key, section_key, heading, body, image_url, cta_label, cta_href`), scoped to `membership`/`education`/`private_events` only (deliberately excludes `home` — the homepage already has its own dedicated `homepage_hero` system; a second overlapping mechanism for the same surface would confuse which one is authoritative). Admin UI: a new "Marketing pages" tab in the existing `/admin/properties/[id]` workspace (`PROPERTY_SECTIONS` in `src/constants/admin/property-sections.ts`), with a Membership/Education/Private Events sub-picker, one form per page bound to its `intro` section (heading/body/CTA/image, all optional — blank fields fall back to the page's hardcoded default copy via `||`, so nothing ever renders empty). All three public pages read via `getPropertyPageSection` with a `DEFAULT_INTRO` fallback object. Verified end-to-end: saved a test heading override in `/admin/properties/<horseshoe-bay-id>/content`, confirmed it appeared instantly on `/horseshoe-bay/membership`, then cleaned up the test row.

**Still open / deferred (not part of this pilot pass):**
- Hog Heaven / Packsaddle — not started. The theming system and component library are built property-agnostic specifically so this is additive work (new `[data-property="..."]` block in `property-themes.css` + new `PROPERTY_PROFILES` entry + a new route-group layout per property), not a rewrite.
- Full chrome parity on `/adventures/[id]` (the reserve/Stripe/waitlist detail page) — intentionally left on its old portal chrome; only the adventures *listing* got re-skinned. Re-skinning the reserve flow's chrome is separate, larger scope (touches Stripe/guest-manifest/cancellation UI) that wasn't attempted here.
- Real Adobe Typekit fonts / Silverspoon / Fieldstone — still on Google Fonts placeholders (Fraunces + Libre Franklin) pending licensing confirmation, per the original decision.
- Deleting the legacy `/request-estimate` flow, `book/[property]`, and the global homepage redirect — still untouched, still the front door for Hog Heaven/Packsaddle traffic, per the original plan's sequencing (don't delete until all three properties are migrated).

---

## Decisions made / changed during the build

- **Auth modal removed.** Built, then explicitly reverted per user instruction — property header links straight to the existing `/login` page, no modal, no `Dialog` primitive (deleted as dead code once unused).
- **Adventures re-skin scope narrowed.** `getPublicAdventures` is deliberately cross-property (curated 3rd-party trips, not siloed per club — this is an existing, intentional design choice, not something to "fix"). `/horseshoe-bay/adventures` shows the same full catalog every property would, wrapped in Horseshoe Bay chrome; each tile still links to the existing, untouched `/adventures/[id]` reserve flow.
- ~~**Education's instructor roster and FAQ's ~50 Q&As are hardcoded page content**~~ — **superseded 2026-07-19**: both are now real, admin-editable data (instructor roster reads the live `/admin/instructors` system; FAQ got its own `property_faq_entries` table — see the "Full admin-dashboard content coverage" status entry above). The FAQ admin tab was then hidden again in the later 2026-07-19 pass per client request, but the table/CRUD code is intact, just unreferenced by the tab list.
- **Events listing has no type/discipline filters.** The mockup's `events.html` has Type/Discipline filter pills backed by fields (`type`, `discipline`, `featured`, `recurring`) that don't exist in this project's `events` schema (a deliberate simplification from the original schema design — see the events migration's own header comment on why it diverges from the client's throwaway reference schema). The listing just shows a featured event + upcoming list, sorted by date.

---

## Hard-won lessons (read before extending this to Hog Heaven/Packsaddle, or touching the theme file again)

1. **Never put `color`/`background-color` directly on a bare `[data-property="..."]` selector in `property-themes.css`.** Unlayered CSS beats Tailwind's `@layer utilities` regardless of specificity — silently overrides every `text-*`/`bg-*` class in the subtree. Apply base bg/text via Tailwind utility classes on the layout wrapper div instead.
2. **Every `@theme inline` key must reference a real CSS variable, never the bare keyword `initial`.** Tailwind silently skips generating a utility it can't resolve — verify via `getComputedStyle`, don't just eyeball a screenshot.
3. **Match the mockup's actual color semantics, not just the token name.** `surface-bright` = `background`/`sand` (light, for text-on-dark-scrim), not `surface-container-lowest`. `ink-variant` is dark (for text-on-light) — using it on a dark section is a silent low-contrast bug. Check computed contrast for every new pairing.
4. **Every property page needs `export const dynamic = "force-dynamic"`, never `"force-static"`.** The global `<SiteHeader>`'s route-suppression logic reads a per-request `x-pathname` header that isn't available during static generation — a statically-rendered property page will double-render the old global header on top of the new `PropertyHeader`. Caught on the education page; fixed by switching to `force-dynamic` (consistent with every other property page anyway).
5. **`datetime-local` inputs are naive wall-clock strings with no timezone** — writing them straight to a `timestamptz` column lets Postgres's connection timezone (UTC by default) silently misinterpret them (a 10:00 AM entry landed as 10:00 UTC = 5:00 AM Central on display). The established fix pattern already exists in this codebase's SQL (`(p_date + p_slot_start) AT TIME ZONE 'America/Chicago'` in `create_public_booking_function`) — for the Events feature this is now handled in `src/services/admin/events.ts`'s `chicagoWallClockToUtcIso()` (a dependency-free double-format offset calculation, since no timezone library is in this project). Any *new* feature that takes a `datetime-local` input and writes to a `timestamptz` column needs the same conversion — don't assume the raw string round-trips correctly.
6. **New route folders / new files sometimes need a hard dev-server restart** (`rm -rf .next` then `npm run dev` again) — Turbopack's dev cache doesn't always invalidate cleanly for brand-new route segments. If a page 404s or throws `X is not defined` despite correct source, try this before deep-debugging.
7. **Playwright MCP is set up and working** — navigate, screenshot, evaluate, console-check every page before calling it done. It caught every bug above. First-time setup in a fresh session needs `npx @playwright/mcp install-browser chrome-for-testing` if the browser isn't installed.
8. **Interactive Playwright actions (`select_option`, `fill_form`, `click`) and `Bash` occasionally hit a transient "safety classifier unavailable" error** that read-only actions (`navigate`, `screenshot`, `evaluate` for reads, `console_messages`) don't. It's a backend outage, not a real block — retry after a short wait; don't try to work around it by inventing an alternative destructive action.
9. **Do not start the dev server yourself** — the user runs/restarts `npm run dev`. Drive Playwright MCP against whatever's already running at `localhost:3000`.
10. **Test data created against the linked (live, cloud) Supabase project during verification must be cleaned up afterward** — there's no local/throwaway DB here. Use `mcp__supabase__execute_sql` to delete test rows once verification is done (as done for the test "Fall Clays Classic" event + its two test registrations this session).
11. **A shorthand fragment (`<>...</>`) returned from `.map()` cannot take a `key`** — if you need a keyed wrapper around a conditional sibling inside a map (e.g. a divider that only renders between items), import `Fragment` from `"react"` and use `<Fragment key={...}>` explicitly. `tsc --noEmit` does not catch this; it only surfaces as a React console warning at runtime.
12. **Saving a property-wide chrome section (Basics, Layout) must revalidate the whole property subtree, not one route** — use `revalidatePath('/horseshoe-bay', 'layout')` (the second arg matters) since these sections feed `layout.tsx`'s header/footer, rendered under every page, not `page.tsx` for one route.
13. **When a single DB `body` field is later split client-side into multiple display fields** (e.g. the membership ambassador's "blurb\n\nrole" → two separate `<p>`s), verify the destructuring against what was *actually seeded*, not what you assume the shape is — an off-by-one here silently swaps which field renders where, with no type error.

---

## Verification checklist (all done for this pass)

1. ✅ `npm run typecheck` clean.
2. ✅ Every page screenshotted via Playwright MCP, zero console errors.
3. ✅ Event registration exercised end-to-end including the sold-out → waitlist fallback path (temporarily set a test event's capacity low, registered twice, confirmed the second registration correctly fell back to `waitlisted` rather than erroring).
4. ✅ Admin roster view confirmed both registrations (confirmed + waitlisted) with correct guest counts and rates.
5. ✅ Adventures re-skin doesn't regress the existing reserve flow — listing renders real seeded adventures correctly in the new chrome; detail/reserve pages untouched.
6. ✅ `/admin` pages spot-checked (sidebar, DataTables) at various points during the Events/Inquiries build — no regressions observed.
7. ✅ Membership inquiry form submitted end-to-end — confirmed the row landed in `/admin/inquiries` with correct name/email/type/property, "New" tab, and sidebar badge count incremented. (Private-events form uses the identical `createInquiry` service path with a different `inquiry_type`/`details` shape — not separately click-tested, but shares 100% of the code path already verified.) Test inquiry cleaned up afterward.

All test data created against the linked Supabase project during this verification pass (one test event, two test registrations, one test inquiry) has been deleted.

---

## Not yet verified in-browser: the 2026-07-19 "admin workspace re-scoped" pass

Everything in that status section (Basics/Layout/Events tab changes, `getResolvedPropertyProfile`
wiring, the ambassador/Fragment bug fixes) is typecheck-clean and the DB rows are seeded/confirmed
via SQL, but **no Playwright pass has been run against it yet** — unlike every earlier pass in this
doc. First things to check in a fresh session:
1. `/admin/properties/<horseshoe-bay-id>` — confirm only Basics / Marketing pages / Events tabs
   show, Basics renders Logo/Address/Contact/Office hours/Social links with the seeded values
   (not blank), Marketing pages' page-picker includes "Layout" with a Footer section, and the
   Events tab lists real upcoming events with a working "Add event" button.
2. `/horseshoe-bay` (any page) — confirm the footer still renders correctly (logo, address,
   contact, hours, social links, newsletter heading/blurb) now that it's DB-sourced instead of
   the hardcoded constant — this is the highest-risk change since a header/footer regression
   would show on every single page.
3. Edit one Basics field (e.g. add a social link) in admin, confirm it appears on the public
   footer after `router.refresh()`, then revert.

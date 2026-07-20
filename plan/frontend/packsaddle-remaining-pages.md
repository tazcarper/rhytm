# Packsaddle Precision — Build Plan

## Post-build audit (2026-07-18): 4 real bugs fixed, 4 patterns componentized cross-property

A full re-read of every Packsaddle page against its own mockup found **four real
background/content bugs**, all now fixed:
- Education's "Programs" section used `bg-property-surface` instead of `bg-property-surface-low`
  for the section, and `bg-property-surface-lowest` instead of `bg-property-surface` for the
  cards — mockup calls for `surface-container-low`/`surface-container`, one step apart from what
  was built.
- Membership's tiers section used `tone="surfaceHighest"` where the mockup specifies plain
  `surface-container` (`tone="surface"`).
- Membership tier pricing was missing its second figure — the mockup shows two numbers per
  price row ("$0,000 / $000 mo"), only one was rendered ("$0,000 / mo" with no monthly number).
- **Not fixed, flagged only:** Hog Heaven's own already-shipped membership page has the same
  `surfaceHighest`-instead-of-`surface` mistake against its own mockup — inherited when this
  doc's original draft copied Hog Heaven's pattern. Horseshoe Bay's equivalent section is
  correct. Left alone since it's an already-shipped page outside this doc's scope; revisit if
  asked.

The same audit found **four markup patterns duplicated near-byte-identically across all three
properties**, now extracted into `src/components/public/property-template/`:
`upcoming-events-strip.tsx` (event-card grid + empty state, used by every homepage's "Featured
Events" and every Club Life page's "What's Next" — 6 call sites), `way-in-grid.tsx` (homepage
"Find Your Way In" tiles — 3 call sites), `instagram-grid.tsx` (Club Life's Instagram section —
3 call sites), `program-card.tsx` (Education's program-track card — 3 call sites, single-card
component matching `FacilityCard`'s existing precedent rather than owning the grid/heading).
All 9 non-Packsaddle call sites were migrated too, not just Packsaddle's — the point of
extracting a shared component is lost if only one of three call sites actually uses it.
Section-level `tone` and eyebrow/heading copy were deliberately left at each call site (not
absorbed into the components) since those are exactly where the real bugs above were found —
burying them inside a shared component would make a future per-property mismatch harder to
spot, not easier.

## Status as of 2026-07-18: all 8 pages + foundation built, typecheck-clean, NOT Playwright-verified

Foundation and all 8 pages are built: `app/(public)/packsaddle/{layout,page}.tsx`, `education/`,
`club-life/`, `adventures/`, `events/{page.tsx,[id]/page.tsx}`, `membership/`, `faq/`.
`npm run typecheck` is clean after every page. **Nobody has looked at this in a browser yet** —
the dev server needs to be started by the user first (see `CLAUDE.local.md`), then every route
needs a Playwright pass per the "Verification, every page" checklist below. Treat this as
unverified until that happens — typecheck passing is not proof the pages render correctly
(exactly the lesson from the Hog Heaven Adventures `onSubmit` bug, which typechecked fine and
only broke at runtime).

**Real content discovered mid-build, not yet acted on — flag to the user before doing anything
with it:** `education.html`'s inline script contains a full 11-person instructor roster with
real names, roles, disciplines, bios, and cross-property club assignments (some instructors
work at Horseshoe Bay AND Packsaddle, e.g. Casey Duran; some at Hog Heaven AND Horseshoe Bay).
This is genuine client content, not bracket-placeholder filler — but seeding it into the live
`/admin/instructors` system means reconciling against whatever's already there for all three
properties (risk of duplicating an instructor who already exists under a different bio), which
is a distinct, careful task from building pages. **Not done as part of this pass** — the
Education page currently reads the live (mostly-empty, for Packsaddle) instructor roster and
will show "Instructors coming soon" until someone deliberately seeds this data.

Below is the original pre-build plan, left intact as a record of what was decided and why —
this doc keeps the sibling docs' filename convention (`plan/frontend/<slug>-remaining-pages.md`)
for discoverability even though, unlike Hog Heaven's doc, nothing existed yet when this was
first written.

## Decisions made / changed during the actual build (read this before touching any of it)

- **Font placeholders picked:** Domine (display, "placa" placeholder), Space Grotesk (label,
  "Fieldstone" placeholder — corrected from this doc's original draft, which wrongly said to
  self-host Fieldstone; see the git history of this file's "New foundation work" section 1 if
  curious), Zilla Slab (sans/body, real — loads for real via `next/font/google`).
- **`--font-property-label` was given a fallback chain**, not just a bare var: `--font-property-
  label: var(--property-font-label, var(--property-font-sans));` in `property-themes.css`'s
  shared `@theme inline` block. This let `font-property-label` be wired into shared components
  (`SectionHeading`'s eyebrow, `PropertyButton`, `PropertyHeader`'s nav/Member's-Entrance,
  `PropertyFooter`'s labels/copyright bar, `AdventureNotifyForm`'s button) **without touching
  Horseshoe Bay or Hog Heaven's rendering** — their scopes never set `--property-font-label`,
  so the utility silently falls back to their existing `--property-font-sans` value, identical
  to before. Verify this actually renders identically for HSB/HH in the Playwright pass — the
  fallback is correct CSS but hasn't been visually confirmed.
- **New Packsaddle-only section tones (`bg-property-teal-mid`, `bg-property-deep-olive`)
  were NOT added to `Section`'s `tone` enum.** Applied directly via `className` on `<Section>`
  instead (e.g. `<Section className="bg-property-teal-mid text-center">`) — the CSS vars exist
  globally, `Section`'s tone map doesn't need to know about a color only one property uses.
- **Every `#inquiry`-anchored CTA on the Membership page uses `MembershipInquiryModal`** (popup
  form, doesn't move the page) from the start, not the anchor-scroll pattern the other two
  properties originally shipped with — this is now the established pattern project-wide.
- **Both unwired email-capture forms (Adventures' "Notify Me", Club Life's "The Dispatch")
  reuse existing `"use client"` components** (`AdventureNotifyForm`, `NewsletterForm`) rather
  than inlining a raw `<form onSubmit={...}>` in the Server Component page — the bug that
  originally shipped on Hog Heaven's Adventures page (fixed earlier the same day) was not
  repeated here.
- **Membership tier shape confirmed and built as static content:** three types (Individual /
  Family / Corporate) × two price points (Founding Member / Standard) each, all prices still
  literal `[$0,000]` bracket placeholders — carried through as-is, not invented.
- **The "Five disciplines share the mountain" homepage band was built as static content**,
  same judgment call flagged in the original plan below (doesn't fit any existing CMS section
  shape).
- **Contact info (address/email/phone) is still bracket-placeholder text** in
  `PROPERTY_PROFILES["packsaddle"]` and the FAQ page's "Just Ask" band — real values needed
  from the client/developer before launch.

**Read `horseshoe-bay-remaining-pages.md` and `hog-heaven-remaining-pages.md` first**
(especially their "Hard-won lessons" / "Decisions made during the build" sections) — almost
every landmine here was already hit once or twice. This doc only calls out what's genuinely
new or different for Packsaddle.

The backend already knows about this property (`properties` table has a `packsaddle` row,
`America/Chicago`, seeded in `20260517223212_phase_1_foundation.sql`) — it currently just
runs the old `/request-estimate/[club]` and `/book/[property]` funnels, same as Hog Heaven did
before its migration. This build replaces its front end only; no new DB property row needed.

Source mockups: `temporary-resources/front-end-beta/packsaddle/*.html` (8 files: index,
membership, events, event-detail, adventure, education, club-life, private-events). Skimmed
for section structure only (comment markers, not full transcription) to write this plan —
**re-read the actual mockup file in full before building each page**, same rule as the sibling
docs.

## Decisions already made by the mockup itself (don't re-litigate, don't guess)

- **Private Events is explicitly NOT launching.** `index.html`'s own header comment says
  `Pages: index · membership · events · adventures (private-events hidden, not launching with
  it)` — Horseshoe Bay's and Hog Heaven's equivalent comments both list private-events as
  included; Packsaddle's is the only one that flags it as held back. The mockup's own nav
  (`club-life.html`, footer, header) never links to `private-events.html` either. **Do not
  build `/packsaddle/private-events` or link it from nav** even though the mockup file exists
  — it's there for a future launch, not this one. If this needs revisiting, that's a
  client/developer call, not something to infer from the file being present.
- **Adventures is a "Coming Soon" page**, not the live cross-property catalog — same call Hog
  Heaven's own mockup already made (unlike Horseshoe Bay, which shows the real shared
  `getPublicAdventures()` catalog). Packsaddle's `adventure.html` has its own literal "Coming
  Soon" eyebrow + an unwired email-capture form, so there's no ambiguity to resolve here the
  way there was for Hog Heaven — just build the mockup's own state.
- **FAQ has no Packsaddle mockup**, same gap Hog Heaven had. Reuse Horseshoe Bay's FAQ page
  chrome/layout (`FaqAccordion` reads `property_faq_entries` filtered by `property_id`,
  already property-agnostic) with zero seeded content — the page's existing empty state
  ("FAQ content coming soon") covers this honestly until real Q&A copy exists.

## New foundation work (none of this is optional — do it before any page)

1. **Fonts — this property is NOT a simple 2-placeholder-font case like the other two, but
   it's also not a "two real fonts just dropped in" case either — check the existing project
   comment before assuming otherwise.** Packsaddle's mockup specifies three distinct type
   families:
   - `wordmark` / `display-lg` / `headline-md` → **"placa"** — a paid/unlicensed display face,
     same situation as Horseshoe Bay's shackleton and Hog Heaven's arpona. Needs a Google Font
     placeholder, picked to read visually distinct from Fraunces (HSB) and Spectral (HH).
   - `eyebrow` / `label-mono` → **"Fieldstone"** — the full family (Regular/Medium/Bold/Heavy/
     Italic `.otf`) does sit in `temporary-resources/front-end-beta/packsaddle/assets/fonts/`,
     but **`property-themes.css`'s own header comment already calls this font out by name as
     a "license-unresolved self-hosted OTF"** — the same bucket Horseshoe Bay's Silverspoon
     is in, and Silverspoon's files exist too (2 italic weights) yet were deliberately never
     wired up via `next/font/local`; Fraunces covers that role as a placeholder instead. Files
     being present in a mockup handoff isn't the same as Rhythm Outdoors holding a webfont-
     embedding license for them. **Treat Fieldstone exactly like "placa": a Google Font
     placeholder, not `next/font/local`,** until someone actually confirms the license.
   - `body-md` / `body-lg` → **"Zilla Slab"** — this one really is real and free (on Google
     Fonts, no license question). Load it for real via `next/font/google`.
   - This still means a **third CSS var slot**, not the existing two
     (`--property-font-display` / `--property-font-sans`) — the label placeholder and the
     display placeholder should be two different Google fonts (so the mockup's own display-
     vs-label distinction still reads), and Zilla Slab is a third, different font again for
     body. Add `--property-font-label` (+ the matching `--font-property-label` Tailwind bridge
     entry in `property-themes.css`'s shared `@theme inline` block — global, but Horseshoe Bay
     and Hog Heaven simply never reference the new utility class, so it's additive only). Wire
     `font-property-label` wherever the property-template components currently hardcode
     `font-property-sans` for eyebrows/labels/mono-tracked uppercase text — check what the
     shared components (`SectionHeading`, `PropertyButton`, etc.) actually key off of before
     assuming this is page-level-only; they may need a small prop/variant if they hardcode
     `font-property-sans` for eyebrow text today.
   - The `.otf` files (and their Zone.Identifier sidecars — Windows download metadata, pure
     noise) stay in `temporary-resources/` untouched; nothing copies them anywhere for now.
2. **`[data-property="packsaddle"]` theme block** in `src/styles/property-themes.css`, palette
   transcribed 1:1 from `index.html`'s inline `tailwind.config` (already extracted below —
   double check against the live file before pasting, mockups do get tweaked):
   ```
   bg: #EDE6D9  surface-lowest: #ffffff  surface-low: #F7F3EE  surface: #F1EDE8
   surface-high: #E7E0D2  surface-highest: #DED6C6
   ink: #3A3327  scrim: #201C15  ink-variant: #514736
   camel: #C9A461  accent: #B0613B  accent-dark: #944B2A
   accent-deep (oxblood): #722619  moss: #3A3327 (same as ink — check this isn't a mockup typo
     before copying verbatim)  deep-olive: #1A2E35  teal-mid: #24404A
   paper (cream): #F2E9CC  rock (dust): #CFC7A8
   on-primary: #ffffff (accent is a mid terracotta/rust — white text checks out, same call as
     Hog Heaven's rust accent, opposite of Horseshoe Bay's light peach)
   radius: 0px  section-desktop: 120px  section-mobile: 64px  gutter: 32px  container-max: 1280px
   ```
   Note the extra tokens (`accent-deep`/oxblood, `deep-olive`, `teal-mid`) that don't map 1:1
   onto the existing `--property-*` variable set — Hog Heaven's build already added two
   extra tones (`--property-moss`, `--property-paper`) for the same reason (its own mockup
   needed tones Horseshoe Bay's didn't). Follow that precedent: add whatever new named tokens
   Packsaddle's mockup actually uses in its section backgrounds (`bg-deep-olive`, `bg-teal-mid`
   both appear as real section tones in `index.html` and `private-events.html`), don't force
   them into existing slots that don't match.
3. **`PROPERTY_PROFILES["packsaddle"]` entry** in `src/constants/public/property-profiles.ts`.
   Real values available from the mockup's shared footer: office hours (Mon closed, Tue–Sat
   10 AM–4 PM, Sun closed), nav links (Home, Club Life, Adventure, Education, Membership,
   Events Calendar — **no Private Events**, matching the decision above), Instagram handle
   (`https://instagram.com/packsaddleprecision`, found live in `club-life.html`, not just the
   footer's placeholder `href="#"`). **Not yet real — still bracket placeholders in every
   mockup page's footer:** street address (only "Kingsland, TX [ZIP]" is filled in), email,
   phone, phoneHref, Facebook link. Don't fabricate these — either carry the bracket-style
   placeholder text through literally (visibly provisional, honest) or ask the client/developer
   for real contact info before launch. Logo asset paths:
   `packsaddle_logo_primary_horizontal_on-light.svg` (header) and
   `packsaddle_logo_primary_vertical_fullcolor.png` (footer) — both already sit in
   `temporary-resources/front-end-beta/packsaddle/assets/`, just need copying into
   `public/properties/packsaddle/` (that directory doesn't exist yet — create it).
4. **`app/(public)/packsaddle/layout.tsx`** — same shape as the other two: loads the fonts
   (three now, not two — see point 1), sets `data-property="packsaddle"`, wraps
   `PropertyHeader`/`PropertyFooter`, calls `getResolvedPropertyProfile`. Copy Horseshoe Bay's
   layout.tsx structure directly, adjust the font-loading block.
5. **Add `/packsaddle` to `SUPPRESSED_PREFIXES`** in `src/components/shared/site-header.tsx`
   (currently `["/admin", "/instructor", "/dev", "/horseshoe-bay", "/hog-heaven"]`) — otherwise
   the global site header doubles up with `PropertyHeader` on every Packsaddle page.
6. **Homepage hero is a looping video** in the mockup (`assets/video/hero.mp4` +
   `hero-poster.jpg`), same concept Horseshoe Bay's mockup specified. Horseshoe Bay's built
   homepage never received the actual `hero.mp4`/poster files either, so it just renders the
   `PropertyImage` placeholder in that slot (graceful fallback, matches the mockup's own
   `onerror="this.remove()"` behavior) — do the same here; Packsaddle's asset folder has no
   `video/` subfolder at all yet, so there isn't even a poster image to show.

## Suggested build order

1. **Foundation** (all of the above) — fonts, theme block, profile entry, layout, suppression
   list, asset folder. Nothing else can be verified without this.
2. **Homepage** (`app/(public)/packsaddle/page.tsx`) — proves the foundation works end to end
   before touching any subpage. Sections per `index.html`: video/poster hero (no headline, no
   scrim — campaign line lives in the next section on purpose, per the mockup's own comment),
   Intro/About, "Find Your Way In" (way-in cards — same pattern as the other two homepages),
   campaign line + mission band (`bg-teal-mid`), Facilities/What We Offer (mirrors membership,
   reuse `amenities` pattern), "The five disciplines that share the mountain" (`bg-deep-olive`
   — a new section shape, check if it fits an existing repeating-items config or needs static
   content, same judgment call as Hog Heaven's non-fitting sections), featured events strip,
   Join CTA band (`bg-moss`).
3. **Education** — intro, "Educational Programs" (three program tracks deep-linking into the
   events calendar filtered by discipline — **the `events.type`/`discipline` schema gap that
   blocked this for Hog Heaven is resolved now** per that property's own plan doc, but
   `getPublicEvents()` still has no type/discipline filter *parameter* — the columns exist,
   the query doesn't. Either add a filter param (a real, if small, service-layer change) or
   link to the plain unfiltered listing like Hog Heaven does today. Don't silently assume
   filtering works without checking `src/services/public/events.ts` yourself first), "Meet
   Your Instructors" (same live `/admin/instructors` roster gap Hog Heaven hit — expect a
   near-empty grid until real Packsaddle instructors are added), CTA band.
4. **Club Life** — "The Latest" (posts feed — skip, no `posts` table, same call as both other
   properties), "Always Running" (standing programmes — re-evaluate now that `events.type`
   exists; may still need the same filter-param work as Education above), "What's Next" (real
   upcoming events strip, reuse `getPublicEvents`), "The Dispatch" (a real, unwired email-
   capture form — **this is a Server Component page importing a native `<form onSubmit=...>`,
   exactly the bug just fixed on Hog Heaven's Adventures page.** Build it as its own
   `"use client"` component from the start (see `AdventureNotifyForm` /
   `src/components/public/property-template/adventure-notify-form.tsx` as the template to
   copy), don't repeat that mistake here. Instagram grid — reuse `instagram`/
   `instagram-photos` CMS sections, five images per the mockup's own "manual roll for launch"
   comment.
5. **Adventures** — "Coming Soon" state per the mockup (see decision above). Build via the
   same `"use client"` extracted-form pattern as Club Life's Dispatch and Hog Heaven's
   Adventures fix — don't inline the form in the page.
6. **Events listing + event detail** — same structure as both built properties: hero,
   included-with-membership band, filters/view-controls section (mockup has one; both other
   properties shipped the simplified no-filter-pills version — same call here unless the
   discipline-filter work from Education/Club Life above gets done, in which case revisit),
   featured + upcoming list, membership CTA band. Event detail reads live via
   `EventRegistrationForm`/`EventContentBand`, already property-agnostic.
7. **Membership** — do this last, same reasoning as both sibling docs (most complex page,
   most likely to need new static content vs. CMS-config judgment calls). **Tier shape is yet
   a third variant, matching neither prior property:** three membership types (Individual /
   Family / Corporate), each shown at **two price points** (Founding Member vs. Standard) plus
   one blurb and one "Inquire" CTA — not Horseshoe Bay's flat two-figure `pricing` list, not
   Hog Heaven's four-tier-plus-corporate shape. All prices in the mockup are literal
   `[$0,000]` / `[$000]` bracket placeholders — **no real pricing exists yet, don't invent
   numbers.** Build as static page content (same precedent as Hog Heaven's tiers), flag the
   missing prices in-code rather than guessing. Also has: benefits grid, facilities/offerings
   (reuse `amenities`), Club Life feature gallery (reuse `club-spotlight` hybrid), membership
   inquiry form (`MembershipInquiryForm`, reuse directly — and use `MembershipInquiryModal`
   from the start for every CTA that points at `#inquiry`, since that's now the established
   pattern on both other properties' membership pages, not the old anchor-scroll behavior).
8. **FAQ** — reuse Horseshoe Bay's chrome, zero seeded content, per the decision above.

## Verification, every page

Same checklist both sibling docs use:
1. `npm run typecheck` clean after each page.
2. Don't start the dev server yourself — the user runs `npm run dev` and hands off a URL (see
   `CLAUDE.local.md`).
3. Playwright MCP against whatever's running at `localhost:3000`: screenshot every new route,
   check zero console errors (the Server/Client `onSubmit` bug wouldn't typecheck-fail, it
   only shows up as a runtime error in the browser — this is exactly why this checklist step
   exists), confirm nav/footer links resolve.
4. Any inquiry-form submission testing happens against the linked, live Supabase project (no
   local stack) — clean up any test rows immediately after.
5. Confirm `/packsaddle` renders with the header suppressed (no doubled nav) and the footer's
   "Explore" links match the mockup's nav list exactly (no Private Events link).

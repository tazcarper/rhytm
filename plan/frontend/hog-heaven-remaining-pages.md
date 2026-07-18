# Hog Heaven — Remaining Pages Plan

## Status as of 2026-07-18: all 7 remaining pages built, typecheck-clean

Private Events, Education, Club Life, Adventures, Events (listing + detail), Membership, and
FAQ are all built under `app/(public)/hog-heaven/`, reusing the property-template component
library and `PROPERTY_PAGE_SECTIONS` config exactly like Horseshoe Bay's pages. `npm run
typecheck` is clean after every page. Not yet verified in-browser via Playwright — the dev
server needs to be started by the user first (see `CLAUDE.local.md`).

**The two open decisions were resolved by explicit user answer, not guessed:**
- Adventures → the "Coming Soon" state from Hog Heaven's own mockup (not Horseshoe Bay's
  live cross-property catalog pattern).
- FAQ → reuse Horseshoe Bay's FAQ chrome/layout with Hog Heaven's own content. No content
  has actually been written yet though — see below.

**Real bugs found and fixed while reusing shared components for a second property** (these
affect Horseshoe Bay too, since the components are shared):
- `EventsListing` had `/horseshoe-bay/events/...` hardcoded into its detail links three times.
  Now takes a required `basePath` prop; both properties' `events/page.tsx` pass their own.
- `registerForEventAction` (`app/(public)/horseshoe-bay/events/[id]/actions.ts`, imported
  cross-route by the shared `EventRegistrationForm`) called `revalidatePath` with hardcoded
  `/horseshoe-bay/...` paths regardless of which property's event was registered for. Now
  looks up the event's actual property slug via a join and revalidates the right paths.
- `MembershipInquiryForm` gained an opt-in `showHearAboutUs` prop — Hog Heaven's mockup has
  a "How did you hear about us?" field that Horseshoe Bay's doesn't; the component already had
  a code comment anticipating this. Value is stored in the inquiry's `details` jsonb, same
  pattern as the private-event inquiry form's extra fields.
- Note: the schema gap this doc originally flagged for Events (`events.type`/`discipline`
  missing) was already resolved by a later migration before this pass started — filters and
  featured events work on both properties now.

**Content gaps intentionally left, not silently filled in:**
- **Membership's four family tiers + corporate tier are static page content, not
  `PROPERTY_PAGE_SECTIONS`-driven.** The shape (name + blurb + two prices + coverage
  paragraph per tier) doesn't fit the existing `pricing` config (title=number, body=label,
  built for Horseshoe Bay's flat two-figure pricing) or any other existing section kind
  without extending the admin type system — flagged in-code for a future pass, not force-fit.
- **Education's "Hog Heaven PT" standing-program band is static, not CMS-driven**, for the
  same reason (heading + body + bulleted detail list + image + CTA doesn't fit "single" fields,
  which have no bullets, or "items", which isn't a repeating list).
- **FAQ has zero seeded content.** No Hog Heaven mockup ever specified real Q&A copy, and none
  was fabricated — the page's existing empty state ("FAQ content coming soon") covers this
  honestly. Needs real answers from the client/developer before it's genuinely useful. Also:
  the FAQ admin tab is still hidden for Horseshoe Bay (client request, code intact) — that
  decision needs revisiting for both properties before Hog Heaven's FAQ can be self-served.
- Club Life's "The Dispatch" reuses Horseshoe Bay's `club_life`/`community` section key but
  renders as an embedded (mockup-unwired) `NewsletterForm` instead of a CTA link, since Hog
  Heaven's mockup is genuinely different content (email capture, not a Facebook-group CTA).
  The shared config's label/helpText were broadened accordingly.
- Education's instructor roster and the homepage/membership facility cards render with real
  photography absent (`PropertyImage` placeholders) since no Hog Heaven photos are seeded yet,
  same as the already-built homepage.

Sibling doc to `plan/frontend/horseshoe-bay-remaining-pages.md` — read that doc first
(especially its "Hard-won lessons" and "Decisions made / changed during the build"
sections) before starting any of this. Almost every landmine in this plan was already
hit once during the Horseshoe Bay pilot; this doc exists so it isn't hit twice.

## Where things stand (as of 2026-07-18)

Only the **homepage** is built (`app/(public)/hog-heaven/{layout,page}.tsx`). It
established:
- `[data-property="hog-heaven"]` palette in `src/styles/property-themes.css`, plus two
  new shared `Section` tones (`moss`, `paper`) that Hog Heaven's mockups use and
  Horseshoe Bay's don't.
- Hog Heaven's entry in `src/constants/public/property-profiles.ts` (nav, contact,
  footer info, `logoSrc` + `footerLogoSrc`).
- Placeholder font pairing: Spectral (display) + Work Sans (sans) — deliberately
  different from Horseshoe Bay's Fraunces/Libre Franklin.
- `/hog-heaven` added to the global `<SiteHeader>` suppression list.
- A real bug fix in the shared `PropertyButton` (`primary` variant now pairs
  `bg-property-accent` with `text-property-on-primary`, not `text-property-ink` —
  needed for Hog Heaven's Join CTA, harmless for Horseshoe Bay since it never used
  `primary`).

**None of this needs redoing.** The remaining pages are pure content/composition work:
reading each mockup, reusing the existing property-template component library
(`src/components/public/property-template/*`), and wiring `property_page_content`
sections exactly like every Horseshoe Bay page already does. No new theme work, no new
fonts, no new nav — all already in place and shared automatically since
`data-property="hog-heaven"` scopes the CSS and `PROPERTY_PROFILES["hog-heaven"]`
already has every nav link pointed at the right (not-yet-existing) routes.

Source mockups: `temporary-resources/front-end-beta/hog-heaven/*.html`. Every page
listed below was skimmed for its section structure (comment markers only, not fully
transcribed) to write this plan — **re-read the actual mockup file in full before
building each page**, don't build from this summary alone.

## Suggested build order

1. **Private Events** — structurally closest to Horseshoe Bay's already-built
   equivalent, lowest risk, good page to re-prove the pattern on a second property.
2. **Education**
3. **Club Life**
4. **Adventures** — see the open decision below before starting this one.
5. **Events listing + event detail**
6. **Membership** — most complex page, most new admin-config surface, do last.
7. **FAQ** — no Hog Heaven mockup exists for this at all; see below.

## Per-page notes

### Private Events (`app/(public)/hog-heaven/private-events/`)
Mockup: `private-events.html`. Sections: hero, intro/"Book Your Event", "Events We
Host" (occasion cards), packages/services columns, "The Setting" gallery (hybrid
heading+body+3 photos), inquiry form. This is section-for-section the same shape as
Horseshoe Bay's built `private-events/page.tsx` — template directly off it. Reuses
`OccasionCard`, `PrivateEventInquiryForm`, the existing `setting-gallery` hybrid CMS
section kind. `PROPERTY_PAGE_SECTIONS`' `private_events` entries already cover this
shape (`intro`, `occasions`, `services`, `setting-gallery`) — no new admin config
needed unless Hog Heaven's actual copy needs a section HSB's page doesn't have.

### Education (`app/(public)/hog-heaven/education/`)
Mockup: `education.html`. Sections: intro, "Educational Programs" (three program
tracks, each deep-linking into the events calendar **pre-filtered by type/discipline**
— can't build the filter target, see "Inherited gaps" below, link to the plain events
listing instead), "Hog Heaven PT" (a standing programme — same `events.type` gap,
likely needs to become static copy or get dropped, matching how Horseshoe Bay handled
Club Life's "Standing Programs"), "Meet Your Instructors", CTA band.
**Real gap to flag before building:** the instructor grid reads the live
`/admin/instructors` system filtered by `instructor_properties`. As of this plan, no
instructor has `hog-heaven` in their `instructor_properties` (Horseshoe Bay's 7-person
roster was seeded specifically for Horseshoe Bay; only two shared dev fixtures, "Nick"
and "Taz C C", are cross-property). Building this page will show a near-empty roster
until real Hog Heaven instructors are added in `/admin/instructors` — that's expected,
not a bug, and not something to fabricate placeholder instructor rows for.

### Club Life (`app/(public)/hog-heaven/club-life/`)
Mockup: `club-life.html`. Same structural shape as Horseshoe Bay's already-built
club-life page: hero, "The Latest" (blog feed — **skip**, no `posts` table, same call
already made for Horseshoe Bay), "Always Running" (standing programs — **skip**, same
`events.type` gap), "What's Next" (real upcoming-events strip, reuse `getPublicEvents`
+ the same card markup), "The Dispatch" (an email-capture band — check whether this is
just cosmetic/unwired like the footer newsletter form, or new; Horseshoe Bay's
equivalent used a Facebook-group CTA instead, so read this section closely, it may be
genuinely different content, not a reskin), Instagram grid (reuses the existing
`instagram`/`instagram-photos` CMS sections). `club_life` section config already
exists and should cover this without new admin-config entries, unless "The Dispatch"
turns out to need its own section.

### Adventures (`app/(public)/hog-heaven/adventures/`)
Mockup: `adventure.html`. **Open decision — resolve before building, don't guess:**
Hog Heaven's own mockup shows a "Coming Soon" placeholder page with an email-capture
form, not a real catalog. Horseshoe Bay's built `/horseshoe-bay/adventures` shows the
real, cross-property `getPublicAdventures()` catalog (adventures are explicitly
cross-property/shared data, not siloed per club — an existing, intentional design
choice per the Horseshoe Bay plan doc). Two options:
  - (a) Match Horseshoe Bay's pattern and show the real shared catalog in Hog Heaven
    chrome (consistent with "adventures aren't property-specific" as already decided).
  - (b) Match Hog Heaven's own mockup and ship the "Coming Soon" state, since that's
    what was actually designed for this specific property.
  These aren't equivalent — (a) shows live bookable content, (b) deliberately doesn't.
  Ask the client/developer which one, or pass through the ambiguity in the kickoff
  prompt rather than silently picking one.

### Events listing + event detail (`app/(public)/hog-heaven/events/`)
Mockups: `events.html`, `event-detail.html`. Same structure as Horseshoe Bay's built
events pages: hero, included-with-membership band, featured event + upcoming list,
members CTA band; detail page reads one event + registration form
(confirmed/waitlist). **Inherited gap:** `events.html`'s "Filters + view controls" and
the "Standing programmes" sub-list both depend on `events.type`/`discipline`/`featured`
fields this project's schema deliberately doesn't have (same simplification already
made for Horseshoe Bay — see that page's own migration header comment for why). Build
the same simplified version Horseshoe Bay shipped: featured event + upcoming list,
sorted by date, no filter pills. `EventRegistrationForm`, `EventContentBand`, and the
capacity/waitlist logic are all already property-agnostic — reuse directly.

### Membership (`app/(public)/hog-heaven/membership/`)
Mockup: `membership.html` — the largest, most structurally different page. Notably has
**four named family tiers + a separate full-width corporate tier**, not the flat
numeric "pricing figures" list Horseshoe Bay's `pricing` CMS section
(`title`=number, `body`=label) was built for. Audit this section against the existing
`membership`/`pricing` config in `property-page-sections.ts` before assuming it fits —
it may need a new items shape (tier name + price + blurb + bullet list) rather than
reusing the existing one as-is. Also has: benefits grid, facilities/offerings (reuse
the same `amenities` items pattern already on both properties' homepages), a "Club
Life feature" gallery (reuse the `club-spotlight` hybrid pattern), the membership
inquiry form (`MembershipInquiryForm` — already property-agnostic, reuse directly),
"After You Join" onboarding steps (reuse `onboarding-steps`), and a "schedule a tour"
ambassador section (reuse `ambassador`). Do this page last — it's the one most likely
to need new `PropertyPageSectionConfig` entries, and by then the other five pages will
have already validated the reuse pattern.

### FAQ (`app/(public)/hog-heaven/faq/`)
**No Hog Heaven mockup exists for this page at all** — the mockup set has 8 files
(index, club-life, adventure, education, event-detail, events, membership,
private-events), no `faq.html`. Horseshoe Bay's FAQ page has no direct Hog Heaven
design reference to transcribe from. Options: reuse Horseshoe Bay's FAQ page chrome/
layout verbatim (it's already generic — `FaqAccordion` reads `property_faq_entries`
filtered by `property_id`) with Hog Heaven's own Q&A content once someone writes it, or
skip this page for now and revisit once a design/content source exists. Also note: the
FAQ tab was deliberately **hidden** from the admin workspace in a prior Horseshoe Bay
pass (client request, tab list edit only — the table and `FaqEntriesEditor` component
still exist, just unreferenced). If Hog Heaven's FAQ page ships, that hidden tab
decision needs revisiting too, for both properties — flag it, don't silently re-enable
or silently leave the client unable to edit it.

## Verification, every page

Same checklist Horseshoe Bay's pilot used (`horseshoe-bay-remaining-pages.md`'s
"Verification checklist" section):
1. `npm run typecheck` clean after each page.
2. Don't start the dev server — the user runs `npm run dev` and hands off a URL (see
   `CLAUDE.local.md`).
3. Playwright MCP against whatever's running at `localhost:3000`: screenshot every new
   route, check zero console errors, confirm nav/footer links resolve (no more 404s
   once a page lands).
4. Any inquiry-form submission testing happens against the **linked, live** Supabase
   project (no local stack) — clean up any test rows created (inquiries, registrations)
   immediately after.
5. Re-check `SUPPRESSED_PREFIXES` in `src/components/shared/site-header.tsx` already
   covers `/hog-heaven` (it does, added this session) — no action needed, just don't
   remove it.

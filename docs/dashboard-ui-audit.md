# Admin Dashboard — UI/UX Audit & Re-skin Direction

**Branch:** `dashboard-migration` · **Date:** 2026-07-01 · **Reviewer:** Claude (UI/UX pass)
**Method:** Playwright, headed Chromium, live admin session, desktop 1440px + a 390px mobile
spot-check. Screenshots in [`./dashboard-ui-audit-screenshots/`](./dashboard-ui-audit-screenshots).

**Scope (approved):** a **conservative re-skin** — swap hand-rolled components for the
shadcn/ui + TanStack layer, keep every layout and the top-bar nav, retain all functionality
(see `DASHBOARD_MIGRATION.md`). Findings are tagged:

- **[re-skin]** — resolved by migrating to the shadcn/TanStack component layer.
- **[decision]** — a layout/IA/behaviour smell a pure re-skin won't fix; raise separately.
- **[bug]** — looks broken today, independent of the redesign.

Register = **product** (dense, quiet). Guardrails: One-Accent (tan), Olive-Line borders,
serif for headings only, brand tokens as source of truth, WCAG 2.1 AA.

---

## Headline takeaways

1. **Brand fidelity is already excellent.** Serif headings, olive-on-paper, tan accents,
   color-coded property pills, genuinely good empty states and microcopy, and consistent
   definition-list detail cards. The re-skin must *preserve* this, not replace it — which is
   exactly the migration's stated non-goal ("don't lose the editorial brand").
2. **The single highest-value change is tables → `<DataTable>`.** Bids, Members, Adventures,
   and Team are hand-rolled `<table>`s with **no sortable headers, inconsistent pagination,
   and no responsive handling** (they overflow-truncate on mobile — see §mobile). One generic
   component fixes all four at once and is already built.
3. **Status is represented four different ways** across the app (text badges, color-only dots,
   raw plain text, link-styled labels). Unify on one shadcn `Badge` vocabulary.
4. **Raw data leaks into the UI in several places** — snake_case enums (`sold_out`,
   `super_admin`), `PLACEHOLDER` name prefixes, bare UUIDs and slugs. A humanize helper +
   Badge mapping cleans most of it up during the re-skin.
5. **A couple of real things to check** independent of the redesign — stray `0` glyphs on the
   dashboard cards and a sticky save-bar overlap to verify in a live viewport. (The floating
   "N" disc turned out to be the Next.js Dev Tools button — not a bug.)

---

## Cross-cutting findings (apply app-wide)

- **[not a bug] The floating black "N" disc is the Next.js Dev Tools button.** Confirmed via
  the accessibility tree (`button "Open Next.js Dev Tools"`). It only renders under `next dev`
  and is not shipped to production — **no action needed**. (Noted because it appears in every
  audit screenshot overlapping content.)
- **[re-skin] Hand-rolled tables lack table affordances.** No column sorting, no column
  visibility, ad-hoc pagination (Members/Bids use bespoke Prev/Next; some lists have none),
  and no overflow container. `<DataTable>` supplies all of these uniformly.
- **[decision] Status representation is inconsistent.** Team + member-detail use text badges
  (good); Members list uses a **color-only dot** (an `img` with an "Active" aria-label, so
  labeled for SR but visually color-only for sighted users); Adventures shows **raw
  `published` / `sold_out` text**; Instructors shows link-styled "ACTIVE PROFILE" / "MUST SIGN
  UP". → one shadcn `Badge` set with **text + color**, mapped per domain.
- **[bug] Raw enum & identifier leakage.** `sold_out`/`published` (Adventures), `super_admin`/
  `property_manager`/`concierge` (Team roles), `PLACEHOLDER …` name prefixes (Instructors,
  Instructor schedule), bare bid **UUID + slug** under the Bid detail title, FAQ **slug chips**
  (`test-hog-heaven-faq-588c4ac7`). Add a `humanizeEnum()` for labels and hide internal ids
  behind a "copy id" affordance rather than printing them.
- **[decision] Heading/breadcrumb pattern drifts.** Most pages = breadcrumb + `Heading size=h2
  underline` + lead text. **Adventures** uses an oversized heading and drops the breadcrumb;
  **Profile** is centered/narrow while others are left-aligned/xl. Normalize `PageShell` width
  + `Heading` size across pages.
- **[decision] Mobile top-bar nav doesn't collapse.** At 390px the identity cluster and the
  link row wrap and the links truncate ("Progra…") with no hamburger. Keeping the top-bar
  paradigm is fine, but it needs a mobile treatment (overflow menu). *(Nav change — flag for a
  follow-up, not the pure re-skin.)*

---

## Per-page findings

> Pages sharing a pattern already covered (e.g. read-only detail cards, form cards) are noted
> by reference rather than re-screenshotted. ~28 routes; 17 distinct surfaces captured.

### 1. Dashboard home — `/admin`  ✅ strong  · `admin-home.png`
Two-column "Needs review" + status-chip-filtered "Recent activity", then "Next 24 hours"
per-club timeline and "The week ahead", each with good empty states.
- **[bug]** Lone **`0`** glyph at top-right of the "Next 24 hours" and "The week ahead" card
  headers — reads as a stray count with no label. Verify intended.
- **[re-skin]** Cards, property pills, and status chips → shadcn `Card` + `Badge` + segmented
  control; no layout change.
- **[decision]** The one page where the later analytics/KPIs phase (deposit volume, open-bid
  count) would add value — out of scope now (Phase 4).

### 2. Bids list — `/admin/bids`  ← **pilot page 2** · `admin-bids-list.png`, `admin-bids-mobile.png`
Hand-rolled "Bid Review Queue" table (Guest, Booking, When, Property, Status, Created, View→).
Server-side filter chips + search + property + date range. Badges CONFIRMED/PENDING REVIEW/
DENIED + Signed / Paid-in-full ticks.
- **[re-skin]** Table → `<DataTable>`: sortable headers (none today), column visibility,
  consistent styling, pagination, **overflow container (fixes mobile truncation)**. Status →
  shadcn `Badge`.
- **[re-skin]** Whole row → `onRowClick` to `/admin/bids/[id]` (today only "View →" is a
  target — small hit area).
- **[decision]** Signed / Paid-in-full render as tiny unchecked checkboxes — look interactive
  but aren't. Use a compact two-dot status cell.

### 3. Bookings — `/admin/bookings`  · `admin-bookings-list.png`
Bespoke dual-month calendar + heat-map legend (Empty/1–2/3–4/5+) + per-club day schedule.
Property filter chips, "Book for a customer" CTA.
- **[decision]** Specialized surface — migration Phase 4 ("react-day-picker vs shadcn
  Calendar"). Not a pilot target. Legend/chips → `Badge` when touched.

### 4. Members list — `/admin/members`  ← **pilot page 1** · `admin-members-list.png`
Filter chips + search + property; table Member / Memberships (stacked pills) / Joined.
- **[re-skin]** Table → `<DataTable>`. **Note the column model is richer than the mock
  prototype**: each row has **multiple memberships** (a stacked list of status-dot + property
  pill + member #), so the Memberships cell is a custom renderer.
- **[decision]** Membership status is a **color-only green dot** — give it a text label via
  `Badge` in the new cell.

### 5. Estimates — `/admin/estimates`  · `admin-estimates-list.png`
Empty state ("No estimate requests yet… arrive from /request-estimate"). Nav-unlinked/legacy.
- **[re-skin]** When populated it buckets by status → `<DataTable>` + `Badge`. Empty state is
  clean; keep.

### 6. Adventures list — `/admin/adventures`  · `admin-adventures-list.png`
Table: Adventure (italic serif link — nice), Property, When, Status, Payment, Booked (0/10),
Requests. "New adventure" CTA.
- **[bug]** Status shows **raw snake_case** (`published`, `sold_out`) as plain text — humanize
  + `Badge`.
- **[decision]** Oversized heading + missing breadcrumb (see cross-cutting).
- **[re-skin]** Table → `<DataTable>`; Booked "0/10" is a good compact cell to keep.

### 7. Instructors — `/admin/instructors`  · `admin-instructors-list.png`
"Add an instructor" form card + long single-column list of instructor cards; placeholders get
an inline email + "Send invite".
- **[bug]** `PLACEHOLDER` prefix leaks into names.
- **[decision]** "ACTIVE PROFILE" / "MUST SIGN UP" statuses are link-styled and sit beside real
  links ("EDIT PROFILE →") — weak status/action distinction. Status → `Badge`; keep actions as
  buttons/links.
- **[re-skin]** Candidate for `<DataTable>` (Phase 2) though the inline invite-per-row form
  complicates it; may stay card-list with re-skinned primitives.

### 8. Team — `/admin/team`  · `admin-team.png`
"Add a team member" form card + table (Name, Email, Role, Status, actions). Badges ACTIVE /
INVITED (good). Actions EDIT ROLE / DEACTIVATE / RESEND LINK / REMOVE. "You" marker.
- **[bug]** Role column shows **raw snake_case** (`super_admin`, `property_manager`).
- **[re-skin]** Table → `<DataTable>`; row actions → keep text links or a `DropdownMenu` kebab.

### 9. FAQ & Gear — `/admin/templates`  · `admin-templates.png`
Tabbed (FAQ 31 / Gear 16) + scope filter + "New item". Long card list; each card = question,
answer, a monospace **slug chip**, scope pills, Edit/Delete.
- **[decision]** 31+ items with **no in-list search or pagination** — just scroll. Add search
  (or `<DataTable>`).
- **[bug/decision]** Internal **slug** shown to users in monospace — hide or make it a "copy"
  affordance.
- **[re-skin]** Scope pills → `Badge`; Edit/Delete → shadcn `Button` + `Dialog` confirm.

### 10. Waivers — `/admin/waivers`  · `admin-waivers.png`
"Edit waiver templates →", per-property kiosk-link card, search box, signed-waiver roster
(empty). Clean.
- **[re-skin]** Roster → `<DataTable>` when populated; search wires to the table filter.

### 11. Waiver templates — `/admin/settings/waivers`  · `admin-settings-waivers.png`
One form card per property: Title + Waiver body + Consent + "Active version N" + Save.
- **[re-skin]** Inputs/textareas → shadcn form primitives (Phase 3 forms sweep). Clean.

### 12. Homepage Hero — `/admin/homepage`  · `admin-homepage.png`
Well-labeled form: eyebrow / headline / support, two button label+link pairs, image upload +
URL, Save. Good helper text.
- **[re-skin]** → shadcn form primitives (Phase 3). **[decision]** no live hero preview (nice-
  to-have, out of scope).

### 13. Profile — `/admin/profile`  · `admin-profile.png`
Name card + Password card (Set-password disabled until valid). Clean.
- **[decision]** Centered/narrow layout vs left-aligned elsewhere (normalize). **[re-skin]**
  forms → shadcn primitives.

### 14. Release notes — `/admin/release-notes`  · `admin-release-notes.png`
Editorial changelog: "Patch N · date" pills, grouped sections, NEW/IMPROVED/FIXED tags. Polished.
- **[re-skin]** Tags → `Badge` variants. Static content, low priority.

### 15. Bid detail — `/admin/bids/[id]`  ✅ richest · `admin-bid-detail.png`
Two-column: left content cards (Booking, Guest, Waivers, Disciplines & Add-ons, Bid Content
[gear list, FAQ], Staff notes) + right sidebar (Actions, Bid URL, Pricing, Quote breakdown,
Pricing history [MANUAL badge], Lifecycle). Waiver banner + Scan-to-sign QR.
- **[re-skin]** The migration's **Phase 1** flagship: cards → `Card`, badges → `Badge`, add-on
  `<select>` → shadcn `Select`, "Edit bid content" modal → `Sheet`/`Dialog`. Big; beyond this
  pilot (list only), but the vocabulary maps cleanly.
- **[bug]** Bare **UUID + slug** printed under the title (`ID 05af7401…`).

### 16. Member detail — `/admin/members/[id]`  · `admin-member-detail.png`
"Has login" badge, Memberships table (Property/Member#/Status/Role/Household/Joined with ACTIVE
`Badge`), empty Bookings + Adventure RSVPs. Read-only, clean.
- **[re-skin]** Small sub-tables → `Card` + `Table`; status already a proper labeled badge here
  (use this treatment on the Members *list* too).

### 17. Property workspace — `/admin/properties/[id]`  · `admin-property-workspace.png`
Property-switcher pills + section tabs (Basics/Experiences/Add-ons/Catering/Guest fees) + long
Basics form (booking rules, home-page tagline, notifications, support, pre-visit details).
- **[bug — verify]** The "SAVE CHANGES" button appears to **overlap the Tagline textarea** in
  the full-page capture. This may be a `position: sticky` action bar that renders mid-page in a
  stitched full-page screenshot (i.e. fine in the live viewport) — **verify in a real viewport**
  before treating as a bug; if real, fix the sticky offset/z-index.
- **[re-skin]** Tabs → shadcn `Tabs`; form → shadcn primitives (Phase 3). Nice two-level IA.

### 18. Adventure edit — `/admin/adventures/[id]`  · `admin-adventure-detail.png`
Very long, complex form: Roster, Basics (rich-text description), dates/capacity, Pricing,
Visibility (Draft/Published toggle + sold-out), Card & hero display, Images (hero + gallery
grid), Type-of-stay icon checkboxes, Highlights list, repeatable Chapters (rich-text + image).
- **[bug — verify]** Same apparent sticky **SAVE/CANCEL/DELETE bar overlap** as §17 — verify in
  live viewport.
- **[decision]** Custom rich-text toolbars — keep vs replace is a Phase-3 decision.
- **[re-skin]** Major forms-sweep target; Draft/Published pill toggle → shadcn `Tabs`/toggle.
  (`/admin/adventures/new` reuses this form — not separately captured.)

### 19. Instructor schedule — `/admin/instructors/[id]/schedule`  · `admin-instructor-schedule.png`
Bespoke weekly-hours editor (per-property fieldset, +Add hours per day, "Fill week 9–5"
shortcut) + "Time off & one-off availability" exceptions form. Save button positioned fine.
- **[bug]** `PLACEHOLDER` in the title. **[decision]** Phase-4 specialized surface; keep the
  bespoke grid, re-skin its inputs/buttons only.

### Not separately captured (pattern reuse)
- `/admin/bookings/[id]` — read-only detail (type, audience, timestamps, money, status badge):
  reuses the §15/§16 definition-list card pattern.
- `/admin/estimates/[id]` — detail + status select: no data to display; reuses card + `Badge`.
- `/admin/instructors/[id]` — profile editor: reuses the §12/§18 form pattern.
- `/admin/adventures/new` — create form: identical to §18.
- `/admin/welcome`, `/admin/setup`, `/admin/bids/[id]/sign` — single-purpose forms/content
  (welcome renders without nav); `/admin/bids/[id]/edit` is a redirect stub to §15.

---

## Part B — Re-skin direction (component mapping)

The whole migration follows one brand-token-driven mapping. shadcn semantic vars are already
mapped onto brand tokens in `app/globals.css`, so components render olive/tan/paper by default;
a "shadcn-default gray" leak means an unmapped token, not a component to restyle.

| Hand-rolled today | Re-skin target | Fixes |
|---|---|---|
| `bid-list-table`, `member-list-table`, Adventures/Team `<table>` | `<DataTable>` (`src/components/ui/data-table.tsx`) + per-feature column defs | sorting, column visibility, pagination, mobile overflow |
| `bid/booking/payment/membership-status-badge`, plain-text & dot statuses | shadcn `Badge` variants (`src/components/ui/badge.tsx`) + `humanizeEnum()` | one status vocabulary; kills snake_case & color-only |
| `admin-modal`, `bid-content-drawer` | shadcn `Dialog` / `Sheet` (`npx shadcn add dialog sheet`) | accessible overlays |
| `nav-dropdown` (bespoke) | shadcn `DropdownMenu` (seeded) — **optional/deferred** | keep top-bar structure; a11y internals |
| hand-rolled form fields, `<select>` | shadcn `Input`/`Textarea`/`Select`/`Tabs` (Server-Action-backed) | consistent forms (Phase 3) |
| property/adventure tab pills | shadcn `Tabs` | consistent tabbed IA |

**Cross-cutting fixes to apply uniformly as each view migrates:** humanize enum labels; give
every status a text+color `Badge`; normalize `PageShell` width + `Heading` treatment; wrap
tables in the DataTable overflow container; hide raw ids/slugs. Keep the top-bar nav paradigm
(a mobile overflow menu is a separate follow-up).

**Rollout order** (per `DASHBOARD_MIGRATION.md`, unchanged): pilot = Members list + Bids list →
Bid detail (Phase 1) → remaining lists (Phase 2) → forms sweep (Phase 3) → calendar/schedule +
charts (Phase 4) → cleanup (Phase 5).

# Session handoff prompt — paste this to start the next session

Continue work on the Rhythm Outdoors "new front end" build for Horseshoe Bay Sporting Club.

**Read `plan/frontend/horseshoe-bay-remaining-pages.md` first — it's the authoritative,
continuously-updated status doc for this whole effort.** Read it top to bottom before doing
anything; the newest section is at the top.

## Where things stand (short version)

- All 9 Horseshoe Bay public pages are built (`app/(public)/horseshoe-bay/*`): homepage,
  membership, education, private-events, events (listing + detail/registration), adventures,
  FAQ. Fully Playwright-verified in an earlier pass.
- Every hardcoded content block across those pages was later made admin-editable via
  `property_page_content` (generic single-block / repeating-items sections, config-driven,
  property-agnostic) — database is authoritative, not just an override layer.
- Education's instructor roster reads the real `/admin/instructors` system. FAQ has its own
  `property_faq_entries` table.
- **Most recent pass (typecheck-clean, DB-seeded, but NOT YET Playwright-verified):** the
  `/admin/properties/[id]` workspace was re-scoped for launch —
  - Experiences / Add-ons / Catering / Guest fees / FAQ tabs are hidden (globally, all 3
    properties) — underlying tables/code untouched, just unreferenced by the tab list.
  - New **Basics** tab: logo, address, contact, office hours, social links.
  - New **Layout** entry inside Marketing pages' page-picker: footer newsletter copy.
  - New **Events** top-level tab: upcoming-events table scoped to that property + an
    "Add event" shortcut that pre-selects the property on `/admin/events/new`.
  - **The public site's header/footer now read from the database** (`getResolvedPropertyProfile`
    in `src/services/public/property-profile.ts`), merged over the previously-hardcoded
    `PROPERTY_PROFILES` constant — this is the highest-risk untested change, since a
    regression here would show on every single page.

## Immediate next step

Nothing is broken as far as `npm run typecheck` and direct SQL verification show, but **no
one has looked at this in a browser yet.** The plan file's final section ("Not yet verified
in-browser…") lists exactly what to check first via Playwright MCP:
1. `/admin/properties/<horseshoe-bay-id>` — only Basics / Marketing pages / Events tabs show;
   Basics shows real seeded values (not blank); Marketing pages' picker includes "Layout";
   Events tab lists real upcoming events with a working "Add event" button.
2. `/horseshoe-bay` (any page) — footer renders correctly (logo/address/contact/hours/social/
   newsletter text) now that it's DB-sourced.
3. Edit one Basics field in admin, confirm it shows up on the public footer, then revert.

## Operating constraints (don't relearn these the hard way)

- **Don't start the dev server yourself** — the user runs/restarts `npm run dev`. Drive
  Playwright MCP against whatever's already running at `localhost:3000`.
- **Never `git commit` or `git push`** — the user reviews and does both themselves (Cursor
  GUI, not terminal).
- This repo is on the developer's own machine (`.claude/.developer-mode` marker present) —
  the client-contributor guardrail hooks are disabled; you're working directly against the
  **linked, live cloud Supabase project** (no local/Docker stack). Apply migrations via the
  Supabase MCP tools (`mcp__supabase__apply_migration` for schema, `execute_sql` for reads);
  clean up any test data you create against it afterward.
- Hog Heaven and Packsaddle have **not** been migrated to this new front end yet — they still
  run on the old `/request-estimate` and `/book/[property]` funnels, which is exactly why
  Experiences/Add-ons/Catering/Guest-fees tabs weren't deleted, just hidden.
- If you're asked to populate Hog Heaven content: its real client mockup HTML exists at
  `temporary-resources/front-end-beta/hog-heaven/*.html` (same page set as Horseshoe Bay's
  own mockups were) — that's the real source to transcribe from, not invented copy. No
  Hog Heaven front-end pages exist in this app yet, so populating its content ahead of time
  is "getting a head start," not wiring anything live.

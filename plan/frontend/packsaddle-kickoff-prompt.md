# Packsaddle kickoff prompt — paste this to start the build

**Update 2026-07-18: this has been built already.** All 8 pages + foundation are done and
typecheck-clean — see `plan/frontend/packsaddle-remaining-pages.md`'s status header for what
shipped and what's still open (Playwright verification, real contact info, the discovered
instructor-roster content). This prompt is left as-is below for reference / in case a rebuild
is ever needed; if you're picking this up now, read the plan doc's status section first instead
of treating the build as not-yet-started.

Build out the third and last property front end for Rhythm Outdoors: Packsaddle Precision.

**Read `plan/frontend/packsaddle-remaining-pages.md` first — it's the authoritative plan for
this build.** Read it top to bottom before doing anything. Also skim
`plan/frontend/horseshoe-bay-remaining-pages.md` and `plan/frontend/hog-heaven-remaining-pages.md`
for their "hard-won lessons" sections — this is the third time through this exact process,
almost nothing left to discover the hard way.

## Where things stand

Nothing is built yet. Horseshoe Bay and Hog Heaven are both fully live under
`app/(public)/horseshoe-bay/*` and `app/(public)/hog-heaven/*` (9 pages each: homepage,
membership, education, private-events, events listing + detail, adventures, club-life, FAQ).
Packsaddle has none of that — no pages, no theme, no fonts, no profile entry. The backend
already has a `packsaddle` row in the `properties` table; it's currently served by the old
`/request-estimate/[club]` funnel, same as Hog Heaven was before its migration. This is a
front-end-only build, section by section, off the real client mockups.

Source mockups: `temporary-resources/front-end-beta/packsaddle/*.html` — 8 files (index,
membership, events, event-detail, adventure, education, club-life, private-events). **Read
each mockup file in full before building that page** — the plan doc only skimmed section
markers, it is not a substitute for the real file.

## Things already decided by the mockup itself — don't re-litigate

- **Private Events is explicitly not launching** with this pass (the mockup's own header
  comment says so, and its nav never links to it) — build every other page, skip this one.
- **Adventures is a "Coming Soon" page** (real content in the mockup, not the live
  cross-property catalog Horseshoe Bay shows) — no ambiguity here, just build what the mockup
  says.
- **FAQ has no Packsaddle-specific mockup** — reuse Horseshoe Bay's FAQ chrome with zero seeded
  content, same as Hog Heaven did.

## What's genuinely new this time (read the plan doc's relevant sections in full)

- **Three distinct font slots, not two.** Packsaddle's display face ("placa") and eyebrow/
  label face ("Fieldstone") are both paid/unlicensed — `property-themes.css`'s own header
  comment already names Fieldstone as a "license-unresolved self-hosted OTF" (same bucket as
  Horseshoe Bay's Silverspoon, whose files also exist but were deliberately never wired up via
  `next/font/local`). Treat both as Google Font placeholders. Its body face ("Zilla Slab") is
  genuinely real and free — load that one for real via `next/font/google`. This still means a
  third theme slot, `--property-font-label`, in the shared `property-themes.css` file (so the
  mockup's own display-vs-label-vs-body distinction still reads even in placeholder mode) —
  see the plan doc's "New foundation work" section 1 before touching that file.
- New section-background tones the other two properties' mockups don't use
  (`bg-deep-olive`, `bg-teal-mid`) — same kind of one-off addition Hog Heaven needed for
  `moss`/`paper`, not a sign something's wrong.
- A third, different membership-tier shape (three types × two price points each, all prices
  still literal `[$0,000]` placeholders in the mockup — don't invent real numbers).
- Real contact info (address, email, phone) is still bracket-placeholder text in every mockup
  page's footer — carry the placeholders through honestly rather than fabricating anything
  that looks real.

## A concrete bug to not repeat

Hog Heaven's Adventures page originally had its "Coming Soon" email-capture form inlined
directly in the (Server Component) page with an `onSubmit` handler — that throws a runtime
"Event handlers cannot be passed to Client Component props" error the moment anyone visits the
page (typecheck stays clean; it only shows up in the browser). It's already fixed there by
extracting the form into its own `"use client"` component
(`src/components/public/property-template/adventure-notify-form.tsx`) — Packsaddle's
Adventures page *and* Club Life's "Dispatch" email-capture band both need the same unwired
form, so build both as their own small client components from the start, following that file
as the template. Don't inline a raw `<form onSubmit={...}>` in any Server Component page.

## Operating constraints

- **Don't start the dev server yourself** — the user runs/restarts `npm run dev`. Drive
  Playwright MCP against whatever's already running at `localhost:3000`.
- **Never `git commit` or `git push`** — the user reviews and does both themselves.
- This repo is on the developer's own machine — you're working directly against the linked,
  live cloud Supabase project (no local/Docker stack). Apply migrations via the Supabase MCP
  tools if any schema work turns out to be needed (e.g. an events type/discipline filter
  param); clean up any test data afterward.
- Follow the plan doc's suggested build order (foundation → homepage → education → club life
  → adventures → events → membership → FAQ) — membership and FAQ are deliberately last, same
  reasoning both sibling docs already used.
- `npm run typecheck` clean after every page, before moving to the next one.

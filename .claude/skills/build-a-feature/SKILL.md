---
name: build-a-feature
description: Use when a client (or anyone in client-contributor mode) asks for something bigger than a presentation tweak — a real feature where they want to CONTROL something that needs a new place to store data plus an admin screen. Triggers on asks like "let me edit X myself", "add a page where staff can manage Y", "add a section I can update", "make Z editable from the admin area". Covers scoping the request in plain language, building it to the project's patterns (migration + RLS + admin page + service + public render), setting the localhost-vs-preview expectation, and handing off to the safe-change skill for the branch/PR mechanics.
---

# Build a feature (client-contributor mode)

This skill helps turn a **non-technical client's plain-language request** for a real
feature into a clean, reviewable pull request — when the request is bigger than a
restyle or copy edit, but still safe for a client to drive because the risky parts
(applying the database change, going live) stay with the developer.

> If `.claude/.developer-mode` exists you are on the developer's machine. You can
> still use this skill to build a feature; just skip the "talk the client through
> it" framing and work normally.

## When this applies

Use it when the client wants to **control** something that currently only a developer
can change — which means it needs a place to store the content plus a screen to edit
it. Tell-tale phrasings:

- "I'd like to be able to edit the homepage banner myself."
- "Add a page in the admin area where staff can manage the FAQ."
- "Make the seasonal announcement something I can turn on and off."
- "Let me add and reorder the gallery photos without asking you."

**Don't** use it for:
- A pure presentation tweak (restyle, re-word, move a component) → just use
  **`safe-change`** directly; there's no feature to scope.
- Anything touching the **foundation** (new npm packages, build/auth/data-layer
  config, rewriting an existing service or RLS) or **live systems** (auth roles,
  payments, real customer/money data) → build the safe slice and flag the rest for
  the developer. The guardrail hook blocks these anyway.

The clean test: **adding new** editable content + an admin control for it is in
scope. **Changing how existing foundation works** is not.

## Before you build anything — is it already editable?

The cheapest feature is the one you don't build. Before scoping anything, check
whether the thing the client wants to change is **already editable in `/admin`**. A
lot is: property info and taglines, pricing, services & add-ons, adventures, FAQ &
gear templates, waiver wording, instructors, members.

- **Already dashboard-editable** → write no code. Point the client to where they
  change it in the admin area and let them do it **live** — no branch, no PR, no
  developer. (e.g. "That's already editable — go to Admin → Properties and edit the
  tagline; it saves instantly.")
- **Hardcoded, and they'll change it again and again** → this skill: make it
  dashboard-editable **once**, then it's the case above forever.
- **Hardcoded and genuinely one-off** → a small `safe-change` copy/style edit is
  enough; don't build a whole feature.

Never hardcode a value the client will keep tweaking — that drags a developer in
every single time. Graduate it into the dashboard instead.

## The method

Work through these in order. Narrate each step to the client in plain language.

### 1. Mirror the request back as a scoped feature, and confirm
Restate, in one or two plain sentences, exactly what they'll be able to do — then
get a yes before building. This prevents building the wrong thing.

> *"So you want: a page in the admin area where you can edit the homepage banner —
> the heading, the text, the two buttons, and a background image — and the homepage
> shows whatever you set. Have I got that right?"*

### 2. Name the pieces and the developer hand-off — without jargon
Briefly tell them what it takes and what their developer will do, so there are no
surprises:

> *"To do this I'll add a place in the database to store the banner, an admin page
> to edit it, and wire the homepage to read it. The database part ships as a
> 'change request' in your pull request that your developer applies — you don't
> need to do anything for that."*

### 3. Build it to the project's patterns
Don't invent shapes — copy what the codebase already does. The canonical reference
is the worked example: **`docs/examples/editable-homepage-hero.md`** (and the code on
the `feature/editable-homepage-hero` branch). A feature like this is typically:

- **A migration** (`npx supabase migration new <desc>`) adding the table/columns,
  with **RLS**: `public read` (`USING (true)` if guests see it) and **admin write**
  gated on `app_metadata.role IN ('super_admin','admin')`, wrapped in `(SELECT …)`.
  Follow the existing config-in-DB pattern (e.g. `properties.tagline`). Apply it
  **locally only** with `npx supabase db reset`.
- **A read service** in `src/services/<scope>/…` returning a clean domain type (with
  a sensible fallback so the page never renders empty).
- **A write service** + **Zod schema** in `src/services/admin/…`.
- **A thin admin page** under `app/admin/<feature>/` (fetch via service → render
  form) + a **client form component** in `src/components/admin/…` + a **server
  action** (validate → call service → `revalidatePath`).
- **The public page** reading the service instead of hardcoded JSX.
- **A nav link** in `src/components/admin/admin-nav.tsx`.

Keep to `CLAUDE.md`: thin pages, SOLID services, the `naming` skill, RLS rules.

### 4. Set the localhost-vs-preview expectation
Because the feature includes a database change, be honest about where it shows up:

> *"On your computer (localhost:3000) you'll see it working right away. The shared
> preview link won't show it correctly until your developer applies the database
> change — so trust your local view."*

### 5. Hand off to `safe-change` for the mechanics
Branch → `npm run typecheck` → local preview → commit → push → open the PR. The
**`safe-change` skill** owns this loop; follow it. Make sure the PR body's
**"Database changes"** section lists the migration, what it does, and the risk level.

### 6. Remind the developer of the manual RLS test
In the PR notes, flag that the new policy needs an explicit manual test (sign in as a
non-admin and confirm the write is rejected; as an admin confirm it works). Per
`CLAUDE.md`, every new RLS policy gets a hand test — it is never rubber-stamped.

## Scope discipline

If the request grows mid-build into foundation or live-system territory (it now needs
a new package, an auth role, Stripe behavior, or a rewrite of an existing service),
**stop and split**: build the safe slice, and clearly flag the rest for the developer
in the PR. Don't quietly cross the line — the hook will block it, and surprising the
client with a wall is worse than naming it up front.

## Done checklist

- [ ] Request mirrored back and confirmed before building
- [ ] Migration file written, applied **locally only** (`db reset`), seeded if it
      replaces existing hardcoded content
- [ ] RLS: public read (if applicable) + admin write, InitPlan-wrapped, no
      cross-table references
- [ ] Read + write services with clean domain types and a fallback
- [ ] Admin page + form + server action; nav link added
- [ ] Public surface reads the service (no hardcoded values left)
- [ ] `npm run typecheck` passes
- [ ] Shipped via `safe-change`: branch, PR, **"Database changes"** runbook entry,
      manual-RLS-test reminder for the developer
- [ ] Client told plainly: local shows it now; preview after the developer applies

## Talking to the client

- They never need the words "migration", "RLS", or "service" — they describe what
  they want to *be able to do*; you handle the translation.
- Encourage "I want to be able to ___" framing — it scopes cleanly.
- Reassure them the database part is captured for the developer automatically; their
  job is to look at it on localhost and say whether it's right.

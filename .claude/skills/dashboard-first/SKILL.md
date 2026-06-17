---
name: dashboard-first
description: Check this BEFORE writing any SQL, migration, or code to change existing content/settings/data in client-contributor mode. A huge amount of this app is already editable by the client themselves in the admin dashboard (/admin) — FAQ & gear, property info/hours/contacts, experiences & add-ons, pricing, adventures, waiver wording, instructors, team, and the live bids/bookings/members records. The client usually doesn't know it's there. Trigger on any request to "change/update/edit/fix the FAQ, the gear list, a property description or hours, a price, an experience or add-on, an adventure, the waiver text, an instructor, a booking, a bid, a member" — or any time you're about to hand-write a migration/SQL that INSERTs/UPDATEs/DELETEs rows of existing content. Recognize it, and point them to the dashboard instead.
---

# Use the dashboard first (client-contributor mode)

Most of what a client asks to "change" in this app is **already editable by them, live,
in the admin dashboard** at `/admin`. They usually don't know that — so the instinct
(theirs or yours) is to hand-write a SQL migration or a code edit to change the data.
**That is almost always the wrong tool.** Editing managed content in the dashboard is
faster, safe, validated, instant, and needs **no branch, no pull request, and no
developer**.

This skill is the proactive version of the `dashboard-content-guard` hook: catch it in
conversation, before any file is touched.

> If `.claude/.developer-mode` exists you're on the developer's machine — this skill
> doesn't apply; work normally.

## The one question to ask yourself first

Before writing **any** SQL, migration, or code to change something, ask:

> **Is this changing *existing content/settings/records that already have a screen in
> /admin* — or is it building something genuinely new / changing how the app is built?**

That splits every request into three buckets:

| Bucket | What it is | What to do |
|---|---|---|
| **1. Dashboard-managed content** | Existing content, settings, or records that staff edit in `/admin` (see the map below) | **Don't write code.** Point the client to the exact admin page and let them edit it themselves, live. |
| **2. Front-end copy / layout in code** | Marketing-page wording, JSX, CSS, styling, a tagline that lives in a TS constant or a static page in `/public` | A normal **`safe-change`** code edit (branch → PR). |
| **3. New structure / new feature** | Something the client wants to control that has **no** screen yet, or a real schema/feature change | The **`build-a-feature`** path (migration + admin page + service), shipped via `safe-change`. |

A SQL migration that **INSERTs / UPDATEs / DELETEs rows of bucket-1 content is never
right.** Migrations are for *structure* (bucket 3), not for editing content that already
has a screen.

## What's editable in /admin (bucket 1 — the map)

If a request is about any of these, it's the dashboard, not code:

| The client wants to change… | Admin page | How they get there |
|---|---|---|
| **FAQ answers, gear-list items** (the user's classic example) | FAQ & Gear | Admin → **Programming → FAQ & Gear** (`/admin/templates`) |
| **Property info** — name, tagline, hours/booking horizon, capacity, directions, parking, map link, support/booking email & phone, arrival contact | Properties | Admin → **Programming → Properties** (`/admin/properties`) |
| **Experiences, add-ons, and their prices** (a property's catalog) | Catalog | Admin → Properties → open a property → **Catalog** |
| **Adventures** (curated trips) — title, description, dates, prices, images, roster | Adventures | Admin → **Programming → Adventures** (`/admin/adventures`) |
| **Waiver wording / templates** | Waivers | Admin → **Programming → Waivers** → settings (`/admin/settings/waivers`) |
| **Instructors** — profiles, bios, photos, disciplines, which properties, schedules | Instructors | Admin → **People → Instructors** (`/admin/instructors`) |
| **Team / staff** — profiles, invites, roles | Team | Admin → **People → Team** (`/admin/team`) |
| **Members** — households, people, their bookings | Members | Admin → **People → Members** (`/admin/members`) |
| **Bids** — content, pricing, add-ons, status, line items | Bids | Admin → **Bids** (`/admin/bids`) |
| **Bookings** — the live booking records | Bookings | Admin → **Bookings** (`/admin/bookings`) |

Keep this in sync with `src/components/admin/admin-nav.tsx` and the table map in
`.claude/hooks/dashboard-content-guard.mjs` if the dashboard's surface changes.

## A couple of honest edge cases

- **A property's tagline lives in two places.** There's an editable tagline on each
  property in `/admin/properties` (this is what the live umbrella homepage reads), AND a
  fallback editorial constant in `src/constants/public/property-copy.ts`. If the client
  wants the **live tagline** changed, that's the dashboard. Only touch the constant for
  the hardcoded fallback wording, as a `safe-change`.
- **"What's New" / release notes are NOT dashboard-editable.** They're authored in code
  (`src/constants/release-notes.ts`) by design — that's a developer task, not a client
  one. Don't try to "edit them in the dashboard"; there's no editor.

When you're unsure whether something is bucket 1 or bucket 2, **check the admin-nav and
the map above** before writing anything.

## How to respond when it's bucket 1 — the script

The client "just doesn't know it's in the dashboard." Be warm, specific, and empowering —
this is good news for them (they don't have to wait on anyone):

> *"Good news — you don't need a code change for this. The FAQ is something you can edit
> yourself, live, right in the admin area. Open the site, go to **Admin → Programming →
> FAQ & Gear** (`/admin/templates`), and edit the answer there — it saves instantly and
> shows up on new bids. Want me to walk you through where it is?"*

Then:
- **Offer to guide them**, step by step, to the right screen — they may never have seen it.
- **Don't write the SQL/code anyway "to be safe."** If you do, the `dashboard-content-guard`
  hook will block it — and more importantly it's the wrong artifact: it bypasses the
  dashboard's validation and won't update the live data the way the screen does.
- **If they insist there's no such screen**, double-check the admin-nav and the map. If
  it's genuinely missing, that's the **`build-a-feature`** path (build the screen once),
  not a one-off SQL edit.

## When it really ISN'T the dashboard

- **Bucket 2 (copy/layout in code):** marketing-page wording, styling, a static `/public`
  page, the fallback constants → just use **`safe-change`**.
- **Bucket 3 (new structure/feature):** the thing has no screen and the client will keep
  changing it → **`build-a-feature`** (which also starts by asking "is it already
  editable?" — the same check as this skill).

## Why this rule exists

- A migration that edits content is **brittle and bypasses validation** — the dashboard
  enforces scoping, required fields, and relationships that raw SQL doesn't.
- It **won't reach the live site the way the dashboard does** — managed content flows
  through services and revalidation; a hand-written row often won't.
- It **drags in a developer and a deploy** for something the client could do in ten
  seconds themselves. The whole point of the admin dashboard is client self-service.

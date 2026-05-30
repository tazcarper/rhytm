# A2 — Admin portal navigation style: sidebar or topbar?

**Category:** Admin operations (App 3 — Admin Portal, pre-build)
**Status:** Open · surfaced 2026-05-24
**Blocks:** App 3.1 (admin shell scaffold)

## The question

The admin portal at `/admin` can use one of two navigation chrome patterns:

- **Sidebar (vertical, fixed left edge)** — typical for staff tools (Linear, Notion, Stripe Dashboard, Supabase Studio). Scales well as we add more sections (bookings, members, partners, reports, settings, etc.).
- **Topbar (horizontal, fixed top edge)** — matches the member and partner portals we already built. Consistent visual language across all three portal types.

## Why it matters

- **Sidebar fits longer feature lists.** As the admin portal grows (it will), a vertical list of links remains readable. A topbar starts to look cramped past ~6 items.
- **Topbar is faster to build.** We already have the `PageShell` component used by `/member` and `/partner`. Reusing it is the path of least resistance.
- **Staff users expect a sidebar.** Most internal tools they've used (Salesforce, HubSpot, Linear, Notion) are sidebar-based.

Either works; just need to pick one before the shell goes in. Easier to choose up-front than to migrate later.

## What it unblocks

App 3.1 — admin shell layout. Until this is decided, App 3 can't start.

## Recommendation

**Sidebar** — staff-tool convention, scales as we add more sections (reports, exports, settings), and visually distinguishes the admin experience from customer-facing portals. A little more work up front than reusing `PageShell` but pays off as App 3 grows.

## Answer

_(pending)_

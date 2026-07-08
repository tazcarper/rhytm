# Admin Dashboard Redesign — Plan

**Branch:** `dashboard-migration` · **Date:** 2026-07-08 · **Author:** Claude (with Taz)
**Grounding:** [`dashboard-ui-audit.md`](./dashboard-ui-audit.md) (live UI audit, 2026-07-01),
[`dashboard-redesign-research.md`](./dashboard-redesign-research.md) (market/UX research),
`DASHBOARD_MIGRATION.md` (stack decision + Phase 0 prototype).

---

## 1. Design direction

**Keep the estate, upgrade the architecture.** The audit's verdict was that brand fidelity
is already excellent — the weakness is *application architecture*: top-bar nav that doesn't
scale or collapse, four hand-rolled tables with no sorting/pagination/overflow handling,
status rendered four different ways, no at-a-glance numbers, no charts.

The redesign therefore changes the **shell** and the **data surfaces**, not the visual
language. Olive/tan/paper, serif headings, near-sharp corners, olive-line borders all stay.
The one deliberate color-scheme move: the navigation now lives on a **deep-olive rail**
(`--olive-deep`), giving the app the dark-sidebar anatomy staff know from Shopify/Linear/
Stripe-class products while staying inside the brand palette (cream/tan on deep olive —
no new hues, One-Accent rule intact).

**Stack** (already chosen in `DASHBOARD_MIGRATION.md`, Phase 0 shipped): shadcn/ui
primitives + TanStack Table + Recharts (Tremor-style, brand-colored) — all copy-in source
we own, Tailwind-v4-native, Server Actions untouched.

### Research findings applied (see research doc for sources)

| Finding | Applied as |
|---|---|
| Sidebar is the convention for admin products with >6 destinations; top bars stop scaling | Fixed left rail, grouped, with mobile drawer |
| Operational dashboards should lead with "what needs me now," not analytics | KPI row starts with *Needs review*; queue card stays above charts' fold-weight |
| Every number needs a label and a next action | Each stat card = label + number + hint line + links to its source list |
| Delta/sparkline theater without history is a vanity anti-pattern | No fake deltas; trends live in two honest charts (30-day demand, 14-day outlook) |
| Tables beat charts for record-level ops work; charts earn their place only for time-shaped questions | Lists stay tables (now sortable); only 2 charts, both time-series |
| Status must be text + color, one vocabulary | Labeled `Badge` everywhere; color-only dots and raw `snake_case` retired |
| Row = click target, not a tiny "View →" link | Whole-row click w/ inner-link guard + keyboard access in `DataTable` |

## 2. What ships in this pass

### A. Shell — `AdminSidebar` replaces the top-bar `AdminNav`
- `src/components/admin/admin-sidebar.tsx` + `app/admin/layout.tsx`.
- Desktop ≥1024px: fixed 240px deep-olive rail — brand block, flat high-traffic links
  (Dashboard / Bids+pending-badge / Bookings), grouped sections (Programming, People,
  Company), collapsible Guides section (audience + contributor links, role-gated), footer
  identity block (profile, View site, Sign out).
- Mobile: sticky deep-olive top bar + hamburger → slide-over drawer (Escape/scrim/route-
  change close). Fixes the audit's "top bar doesn't collapse at 390px" finding.
- Old `admin-nav` / `nav-dropdown` / `guides-menu` deleted.

### B. Dashboard home — KPIs + charts above the operational cards
- New `src/services/admin/dashboard-metrics.ts` (single job: aggregates/series; the
  queue/schedule feed stays in `dashboard-data.ts`).
- KPI row (4 `StatCard`s): Needs review · Next 24 hours · Week ahead · Collected (30d).
  Each links to its filtered source list.
- Charts row: **New bids — last 30 days** (`BrandAreaChart`) and **Next 14 days by club**
  (`BrandBarChart`, stacked by property in the property identity colors).
- Kept: Needs-review queue, Recent-activity feed (status-chip filters), Next-24h
  per-club day schedule, Week-ahead columns.
- Bug fixes from the audit: stray `0` count on card headers now renders only when > 0;
  page header gains today's date.

### C. Lists — one table engine
- `DataTable` extended: `showToolbar` / `showPagination` switches (so server-paginated
  pages keep their URL-driven filters + Prev/Next), inner-link click guard, keyboard row
  activation, custom empty message.
- **Bids** → `bids-data-table.tsx` (server filters/pagination kept; adds column sort,
  whole-row click).
- **Members** → `members-data-table.tsx` (labeled `MembershipStatusBadge` replaces the
  color-only dot; household size surfaced).
- **Adventures** → `adventures-data-table.tsx` (client search/sort/pagination; humanized
  status badges replace raw `sold_out`/`published`; page normalized to breadcrumb +
  standard heading per the audit).
- `src/components/admin/humanize.ts`: `humanizeEnum()` + property chart colors.

## 3. Explicitly NOT in this pass (later phases)

- **Bid detail** re-skin (audit §15 — cards/Sheet/Select sweep). Biggest single view;
  Phase 1 of `DASHBOARD_MIGRATION.md`, follows once the shell + lists are approved.
- **Forms sweep** (property settings, adventure editor, homepage hero, team invite …).
- **Bookings calendar + instructor schedule grid** (specialized surfaces, Phase 4).
- **FAQ & Gear list** search/pagination, Team list migration (small, already-badged),
  command palette (⌘K), dark mode — candidates for the next round, listed in research.
- Deleting the remaining superseded CSS modules (`queue-list.module.css` still serves
  the filter/summary/pagination chrome on Bids/Members).

## 4. Verification

- `npm run typecheck` — clean.
- Visual review by Taz (`npm run dev`): `/admin` (KPIs, charts, cards), `/admin/bids`
  (sort, row click, filters, pagination), `/admin/members`, `/admin/adventures`,
  sidebar on desktop + drawer at ~390px, Team link hidden for non-admin roles.
- Charts + KPI queries are read-only aggregates over `bids`/`bookings`/`properties`;
  no schema or RLS changes anywhere in this pass.

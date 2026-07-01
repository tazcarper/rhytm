# Dashboard Migration — shadcn/ui + TanStack Table + Tremor

**Status:** 🟡 Prototype in progress
**Owner:** Taz
**Started:** 2026-07-01
**Tracking doc for:** replacing the hand-rolled admin dashboard views with a
composable design-system base. This is a large, multi-phase effort tracked here
separately from the main `TRACKER.md` (which covers product phases).

---

## Goal & non-goals

**Goal.** Replace the bespoke, hand-rolled admin dashboard UI (hand-written
`<table>`s, 32 co-located CSS Modules, custom modals/dropdowns) with a robust,
accessible, composable component base — **without changing functionality** and
**without losing the editorial brand** (olive / tan / cream, serif display,
near-sharp corners).

**Chosen stack.**
- **shadcn/ui** (Radix primitives + Tailwind, copy-in source we own) — the base
  component layer: Button, Table, Input, Select, Dialog, DropdownMenu, Badge, …
- **@tanstack/react-table** — the data-table engine (sorting, filtering,
  pagination, column visibility, row selection). Powers Bids, Members,
  Estimates, Bookings, Instructors lists.
- **Tremor** (Vercel-owned, Tailwind-v4-native) — charts / KPI cards for the new
  analytics surfaces. Chart primitives are built on `recharts`; we adopt them
  copy-in, brand-colored, same as shadcn.

**Non-goals.**
- Not adopting Refine or any CRUD framework — we keep Next.js **Server Actions**
  as the data/mutation path. shadcn forms wrap our existing actions.
- Not discarding the brand token system — shadcn's semantic CSS variables are
  **mapped onto** the existing `globals.css` brand tokens (see Phase 0).
- Not a big-bang rewrite — migrate **view by view**, deleting CSS Modules as each
  view is replaced. The `@/lib/ui` barrel stays as the seam so imports are stable.

## Why this stack (recap)

Our dashboards are **CRUD-heavy, not analytics-heavy**: data tables, forms,
drawers, status badges, a calendar, a schedule grid. The robustness we need is
great tables + accessible overlays + forms — not charts (we have none today,
but will add them). shadcn is Tailwind-v4-native (matches our setup), we own the
source (matches our hand-rolled philosophy), keeps Server Actions, and lets us
map the brand tokens straight in. Tremor layers in cleanly for charts because it
is also Tailwind-v4-native and Vercel-owned. See conversation research for the
full options matrix (Mantine / MUI / Refine rejected on Tailwind/brand/data-flow
fit).

---

## Phases

### Phase 0 — Foundation & token mapping  🟡 (prototype)
- [x] Install deps: `@tanstack/react-table`, `class-variance-authority`,
      `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-dropdown-menu`,
      `recharts`.
- [x] Add `components.json` so `npx shadcn add <x>` drops components into our tree.
- [x] Map shadcn semantic tokens → brand tokens in `app/globals.css`
      (`--background`→`--paper`, `--primary`→`--olive`, `--radius`→`--radius-card`,
      etc.). ⚠️ Review the global `--radius-sm/md/lg` alignment to brand-sharp
      values — intended, but touches any existing `rounded-*` utilities.
- [x] Add a shadcn-compatible `cn()` (clsx + tailwind-merge) — separate from the
      existing plain-join `lib/ui/utils/cn.ts` until migration completes.
- [x] Seed shadcn primitives: Button, Table, Input, Badge, DropdownMenu.
- [x] Build a generic `<DataTable>` (TanStack) with sort / filter / pagination /
      column visibility.
- [x] **Pilot view:** Members list re-implemented as shadcn + TanStack, on a
      `/dev/ui/dashboard-prototype` page with mock data, for brand-fidelity review.
- [x] Add one Tremor-style brand-colored chart to the prototype page (proves the
      charts path).
- [ ] **Visual review by Taz** (dev server) — approve brand fidelity before Phase 1.

### Phase 1 — Bids view (biggest, highest value)  ⬜
The Bids list + detail is the largest, most table+drawer-heavy feature. Migrating
it proves tables, dialogs, badges, and brand fidelity in one real view.
- [ ] Bids list → `<DataTable>` (replace `bid-list-table.tsx`).
- [ ] Status badges → shadcn `Badge` variants mapped to bid statuses.
- [ ] Editor drawer → shadcn `Sheet`/`Dialog` (replace `admin-modal`).
- [ ] Line-items / pricing-history / add-ons → shadcn `Card` + `Table`.
- [ ] Delete superseded CSS Modules.

### Phase 2 — Remaining list views  ⬜
- [ ] Members list (promote prototype from `/dev` into `/admin/members`).
- [ ] Estimates list + Bookings list → `<DataTable>`.
- [ ] Instructors list; keep the custom schedule grid for now (Phase 4).

### Phase 3 — Forms & overlays sweep  ⬜
- [ ] Property settings, instructor profile, adventures, homepage hero, team
      invite → shadcn form primitives (still Server-Action-backed).
- [ ] Replace `admin-modal` / `nav-dropdown` with shadcn `Dialog` / `DropdownMenu`
      app-wide; retire the bespoke versions.

### Phase 4 — Specialized surfaces & charts  ⬜
- [ ] Bookings calendar — evaluate keeping `react-day-picker` vs shadcn Calendar.
- [ ] Instructor schedule grid — bespoke; assess TanStack vs keep-as-is.
- [ ] New analytics/reporting dashboard with Tremor charts + KPI cards.

### Phase 5 — Cleanup  ⬜
- [ ] Remove dead CSS Modules and unused `lib/ui` primitives.
- [ ] Decide the fate of `tailwind-variants` (already a dep, unused) and the old
      `lib/ui/utils/cn.ts`.
- [ ] Update `CLAUDE.md` / `DESIGN.md` to document the new component layer.

---

## Key decisions & notes

- **Token mapping is the crux of brand fidelity.** shadcn ships neutral-gray
  defaults; every semantic var is remapped to a brand token so components render
  olive/tan/paper out of the box. If a component looks "shadcn-default gray,"
  a token is unmapped — fix the mapping, not the component.
- **Radius:** brand is near-sharp (2–3px). shadcn's default `rounded-lg` is 8px;
  we pin the shadcn radius scale to brand-sharp so components stay square.
- **We can't run the dev server in Claude's shell** (Turbopack lockfile on the
  mount). Visual review is done by Taz; Claude validates with `npm run typecheck`.
- **File placement:** shadcn primitives live under `src/components/ui/`; the
  generic `<DataTable>` and brand chart wrappers too. Feature tables (e.g. members
  columns) live under their admin scope. This respects the "renders JSX →
  `src/components/<scope>`" rule while keeping shadcn's `@/components/ui` ergonomics
  via `components.json` aliases.

## Prototype — how to review
1. `npm install` (new deps already in `package.json`).
2. `npm run dev`, open **`/dev/ui/dashboard-prototype`**.
3. Compare against the live `/admin/members` list for brand fidelity: header
   treatment, row striping/hover, borders, radius, type. The chart demonstrates
   the Tremor path in brand olive.

## Open questions
- [ ] Drawer vs full-page for Bids editor once on shadcn `Sheet`?
- [ ] Keep `react-day-picker` or move to shadcn Calendar (also day-picker-based)?
- [ ] Do we want dark mode? (brand is light-only today; shadcn makes it cheap.)

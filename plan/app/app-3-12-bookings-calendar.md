# App 3.12 — Bookings Calendar (`/admin/bookings`)

**Status:** Landed 2026-06-01 (count-bucket density; slot-utilization swap still pending client Q2). `tsc --noEmit` clean.
**Replaces:** the current bookings *list* view (the list/table is removed — see "Decisions").
**Owner doc for:** the `/admin/bookings` rework into a color-coded month calendar with an hourly day drill-down, across all properties.

---

## Goal

Give staff at-a-glance visibility into how booked each day is — **empty vs. light vs. busy** — across **today and future dates**, for **all properties at once** (with a per-property filter), and let them **drill into any day's hourly schedule** (the same hourly view the dashboard already uses).

This also resolves the "bids and bookings pages feel like duplicates" confusion (raised 2026-06-01): the **Bids "Review Queue" stays the work surface** for individual bids; **Bookings becomes the calendar/operations lens**. Each booking in the day drill-down still links to its bid detail.

---

## Decisions (locked 2026-06-01)

1. **Replace, don't toggle.** `/admin/bookings` becomes the calendar only. No list/table view. (The flat filterable table was redundant with the bids queue.)
2. **Density = booking-count buckets (v1).** Color each day by the number of *active* bookings (active = status NOT IN `cancelled`/`denied`/`expired`):
   - `0` → **empty** (paper)
   - `1–2` → **light** (tan)
   - `3–4` → **busy** (amber)
   - `5+` → **full** (olive-deep)
   - Per-property count **and** an aggregate count for the "All properties" view.
   - Thresholds are easy to tune; keep them in one constant.
3. **Wrap density in one pure function** `computeDayDensity()` so the metric can later be swapped for true **slot utilization** (booked slots ÷ operating slots) with **no UI change**. See "Capacity caveat".
4. **Library: `react-day-picker` v10** (already installed, `^10.0.1`; MIT; React 19-ready). Used **only for the month grid** — its date math, month navigation, and fully-custom day cells. We do **not** use FullCalendar (its multi-property resource timeline is a $480/dev/yr premium plugin and clashes with the design system).
5. **Reuse `DaySchedule` for the hourly day view** (already in-brand). No new hourly-grid library.

---

## Capacity caveat (why count-buckets for now)

"Full" in the data model is **per time-slot**, not per day: `check_property_capacity()` (`supabase/migrations/20260517225304_phase_2_booking_system.sql`) sums `capacity_reserved` of *overlapping* non-cancelled bookings and compares to `properties.max_concurrent_groups` (currently **1** for all three properties).

A true "fully booked **day**" = booked slots ÷ the day's operating slots — but **`time_slots` are not seeded yet** (blocked on **client Q2**, operating hours). So accurate slot-utilization can't ship today. We ship **count-buckets now** and swap `computeDayDensity()` to slot-utilization once Q2 lands. The UI/colors/legend don't change.

---

## Reusable assets (confirmed in code 2026-06-01)

- **`<DaySchedule>`** — `src/components/admin/day-schedule.tsx`. Fully generic hourly grid: give it a day's rows and it renders a 7am–8pm column (auto-expands), 56px/hour, dashed hour lines, a red "now" line when the date is today, and per-property brand-colored blocks (`.block_hsb/_hog/_pack`). **Currently typed to `AdminBidListRow[]` and hardcodes `America/Chicago`** — Phase 3 generalizes its prop type to a shared `ScheduleBlock` and feeds it booking rows via a tiny adapter.
- **`dashboard.module.css` `.columnGrid`** — 3-column (≥720px) / 1-column property layout. The dashboard stacks one `DaySchedule` per property inside it; reuse the same for the day drill-down.
- **`getAdminBookingsList`** — `src/services/admin/bookings.ts`. Already supports `from`/`to` date-range + `propertyId` filters and returns `AdminBookingListRow` (`id, status, bookingType, startTime, durationHours, guestName, guestEmail, guestCount, propertyId, propertyName, propertySlug, propertyTimezone, createdAt, bidId`). A month fetch is a thin wrapper (`pageSize: 1000`, `from`/`to` = month bounds).
- **Format helpers** — `src/services/public/format.ts`: `formatDateLongTz(iso, tz)`, `formatSlotLabelTz(iso, tz)`, `formatDateLong`, `formatSlotLabel`. Per-timezone `Intl` caches already in place.
- **Properties** — `getAdminPropertiesList` (`src/services/admin/properties.ts`) → `id, name, slug, timezone, bookingHorizonDays, maxConcurrentGroups, …`; or `getPublicProperties`.
- **Server-fetch → client-component page pattern** — mirror `app/admin/bids/page.tsx` (server parses searchParams, fetches, renders a client component).
- **Timezone bucketing** — bucket a booking into a calendar date using the property timezone (all `America/Chicago` today). `Intl.DateTimeFormat("en-CA", { timeZone })` → `YYYY-MM-DD`.

---

## Build phases

### Phase 1 — Data layer (`src/services/admin/bookings-calendar.ts`)
- `getAdminMonthBookings(supabase, { propertyId?, year, month })` → all bookings whose `start_time` is in the month. Implement on top of `getAdminBookingsList` with `from`/`to` month bounds + `pageSize: 1000`. Returns `AdminBookingListRow[]`.
- `computeDayDensity(rows, properties)` (**pure, no DB**) → `Map<"YYYY-MM-DD", DayCell>` where
  `DayCell = { total: number; byProperty: Record<propertyId, number>; density: Density }` and `Density = "empty" | "light" | "busy" | "full"`.
  - Bucket by **active** bookings only (exclude `cancelled`/`denied`/`expired`).
  - Bucket date by **property timezone**.
  - Keep thresholds in a `DENSITY_THRESHOLDS` constant.
- Small unit sanity around the thresholds + the active-status filter.

### Phase 2 — Month calendar (`src/components/admin/bookings-calendar.tsx`, client)
- `<BookingsCalendar>` using `react-day-picker` v10 with a **custom Day cell** colored by that date's `density` (CSS-module classes per bucket using brand tokens). Show the date number + a small active-count; ring **today**; dim **past** days; mark the **booking-horizon** boundary (`booking_horizon_days`).
- **Property filter** (All / HBSC / Hog Heaven / Packsaddle) and **month nav** (‹ Month YYYY ›). A **legend** for the color scale.
- Selecting a day updates URL state: `?month=YYYY-MM&property=<id|all>&day=YYYY-MM-DD`.
- A11y: never color-only — include the numeric count + an `aria-label` per day (e.g. "June 12 — 4 bookings, busy"). Lean on react-day-picker's keyboard nav.

### Phase 3 — Hourly day detail (reuse `DaySchedule`)
- Generalize `DaySchedule`'s prop type from `AdminBidListRow[]` to a shared `ScheduleBlock` interface (`{ id, startTime, durationHours, guestName, bookingType, propertySlug, status, bidId? }`) — keep it backward-compatible with the dashboard's existing usage.
- Adapter `AdminBookingListRow → ScheduleBlock`.
- Below the calendar, render the **selected day** as **per-property columns** (reuse `.columnGrid` + one `DaySchedule` per property). "All properties" → all three columns; a property filter → one. Each block links to `/admin/bids/<bidId>` (fallback `/admin/bookings/<id>` for the future no-bid case).

### Phase 4 — Page rewrite (`app/admin/bookings/page.tsx`)
- Server component: parse `?month/property/day`, fetch the month's bookings, compute density, render `<BookingsCalendar>` + the day detail. Remove the list/table imports (`BookingFilters`, `BookingListTable`) — delete those components if nothing else uses them (grep first). Keep `AdminBreadcrumb` + `Heading`.
- Default selected day = today (or first of month if today is outside the viewed month).

### Phase 5 — Polish
- Today ring, past-day dimming, horizon marker, responsive (calendar above detail on mobile; `.columnGrid` already stacks), loading/empty states ("No bookings this day"), and a clear legend.

### Phase 6 — Verify
- `npx tsc --noEmit` clean.
- Manual test: seed multi-property bookings across several days (via `/dev` or the public checkout), confirm day colors match counts, drill-down shows the right hourly blocks per property, month nav + property filter + URL state all work.
- Update `TRACKER.md` (mark 3.12 landed) and this doc's Status.

---

## File map

| File | Action |
|---|---|
| `src/services/admin/bookings-calendar.ts` | **new** — `getAdminMonthBookings`, `computeDayDensity`, `DayCell`/`Density` types, `DENSITY_THRESHOLDS` |
| `src/components/admin/bookings-calendar.tsx` (+ `.module.css`) | **new** — month grid (react-day-picker), property filter, legend, density day cells |
| `src/components/admin/day-schedule.tsx` | **edit** — generalize prop type to `ScheduleBlock`; keep dashboard usage working |
| `app/admin/bookings/page.tsx` | **rewrite** — calendar + day detail; drop the list |
| `src/components/admin/booking-filters.tsx`, `booking-list-table.tsx` | **remove** if unused after the rewrite (grep first) |
| `app/admin/bookings/[id]/page.tsx` | **keep** — still the no-bid fallback detail (redirects to bid when one exists) |
| `TRACKER.md` | **edit** — 3.12 status |

---

## Follow-ups / future
- **Slot-utilization density** once client Q2 (operating hours / `time_slots`) lands — swap the body of `computeDayDensity()`; UI unchanged.
- **Week view** (optional) — a denser variant if staff want it.
- **Admin-created bookings** (App 3 future) will naturally appear here, including the no-bid case the booking detail page already handles.

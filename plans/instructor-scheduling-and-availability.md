# Instructor Disciplines, Schedules & Instructor-First Booking

Status: 🔄 In progress (2026-06-08) · Extends App 14 (Instructor Profiles) · **Supersedes App 14 Phase C**

Phase progress: **A ✅** (qualifications + atomic save RPC) · **B ✅** (per-property weekly schedules + date exceptions; editor at `/admin/instructors/[id]/schedule`) · **C ✅ verified** — travel buffer (F1–3), 3 availability RPCs + early-stop, hardened `create_public_booking`, public service + actions · **D ✅ built** (instructor-first WHEN step: `requiresInstructor` config flag, `InstructorWhenStep` picker + reactive calendar/slots, `date-utils` extraction) · **F4 🔲** (travel-matrix admin UI — optional; 60-min default works until then). Applied: `…130000`,`…140000`,`…150000`,`…160000`,`…170000` (travel buffer),`…180000` (availability RPCs),`…190000` (instructor-aware booking) — all verified live. Pending apply: `…200000` (early-stop `instructor_next_available_date` — perf fold-in for `list_qualified_instructors`).

## Context — why

Today a guest booking a private lesson never chooses *who* teaches them — `create_public_booking` silently auto-assigns "the first active instructor at the property" (`display_order`), and the `get_slot_availability` RPC only checks that *some* instructor is free, never a specific one. There's also no notion of **what an instructor can teach** or **when they actually work** — any active instructor can be assigned to any discipline at any property time slot, bounded only by the `no_instructor_overlap` exclusion constraint.

This feature closes those two gaps and turns the WHEN step into an **instructor-first** experience:

1. **Qualifications** — instructors gain the disciplines (`services`) they're certified to teach.
2. **Schedules** — admins set each instructor's **per-property weekly availability** (days + time windows) plus **date-specific time-off / one-off exceptions**.
3. **Instructor-first WHEN step** — the guest picks an instructor (defaulted to the first available one), and the calendar + time grid then reflect *that instructor's* schedule minus their bookings **across all properties**, intersected with property slots and capacity. Switching instructor re-renders availability.

It builds on the instructor work shipped 2026-06-07 (`instructors`, `instructor_properties`, property-aware booking RPCs, `/admin/instructors`) and on App 14 Phase A (the admin profile editor). See migrations `20260607120000–140000` and `plans/instructor-profiles.md`.

## Decisions locked (product sync 2026-06-08)

| Question | Decision |
|---|---|
| WHEN-step UX | **Instructor-first** — pick instructor (default = first available), calendar/times reflect that instructor. |
| Schedule model | **Weekly recurring + date-specific exceptions** (time-off and one-off extra availability). |
| Schedule scope | **Per-property** — an instructor can work different days/hours at HBSC vs Hog Heaven vs Packsaddle. |
| Booking-type scope | **Instructor-required types only**, driven by a `requiresInstructor` config flag (today: `private_lesson`). |
| Cross-property travel | **Travel buffer between bookings at different properties**, from an admin-editable property-pair matrix (config-in-DB). Enforced by a DB trigger + mirrored in availability. (2026-06-08 — promoted from deferred.) |

## What already exists — reuse, don't rebuild

- **`instructors`** (name, bio, photo_url, is_active, display_order, primary `property_id`) + **`instructor_properties`** junction (multi-property, public-read RLS). App 14 Phase A admin editor for these is **built**.
- **`no_instructor_overlap`** EXCLUDE-gist constraint on `bookings` already prevents an instructor being double-booked **across all properties** (`instructor_id WITH =, tstzrange(start,end,'[)') WITH &&`, active statuses). The "busy at HBSC ⇒ not free at Hog Heaven" rule is **already enforced at write time** — this plan adds it to the *read* (availability) path and the schedule layer.
- **Disciplines = `services`** (property-scoped). Bookings link via `booking_disciplines`. **No instructor↔service link exists yet.**
- **WHEN step** = sub-step 3 of `src/components/public/booking-flow/booking-builder.tsx` (calendar + slot grid). Slots come from `time_slots` (per-property, per-day, fixed times); live availability from the `get_slot_availability` RPC via `src/services/public/slots.ts` + `app/(public)/book/[property]/disciplines/availability-action.ts`.
- **Funnel state** — `booking-flow-types.ts` already has `instructorId?: string | null`; `INITIAL_STATE` in `booking-flow-provider.tsx`; `setState` merge pattern. Submit path (`details-form.tsx → submitBookingAction → createPublicBooking → create_public_booking`) already passes `instructorId` and auto-assigns only when null.
- **Booking-type config** — `src/constants/public/booking-types.ts` (`BOOKING_TYPE_META`), the natural home for a `requiresInstructor` flag (Open/Closed).
- **Image/card patterns** — `AdventureImage` renderer + the App 14 instructor photo stack for instructor cards in the picker.
- **RLS playbook** — CLAUDE.md "RLS Rules": SECURITY DEFINER selector functions (no inline cross-table EXISTS in USING), wrap `auth.uid()`/`auth.jwt()` in `(SELECT …)`, `SET search_path = public`, manual test every policy. Mirror `instructor_properties` policies for the new junctions.

## Data model — new tables

All times stored in the **property's timezone** (`properties.timezone`); `day_of_week` is `0=Sun..6=Sat` to match `time_slots` and `EXTRACT(DOW)`.

**1. `instructor_disciplines`** — what each instructor can teach.
```sql
CREATE TABLE instructor_disciplines (
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services(id)    ON DELETE CASCADE,
  PRIMARY KEY (instructor_id, service_id)
);
CREATE INDEX instructor_disciplines_service_idx ON instructor_disciplines (service_id);
-- RLS: PUBLIC read (booking flow filters instructors by discipline);
--      staff write (super_admin/admin anywhere; property_manager for own-property instructors).
-- Admin UI only offers services belonging to the instructor's linked properties.
```

**2. `instructor_availability`** — recurring weekly windows, per property. Multiple rows per (instructor, property, day) = multiple windows (morning/afternoon).
```sql
CREATE TABLE instructor_availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  property_id   uuid NOT NULL,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_window_valid CHECK (end_time > start_time),
  -- can only declare hours for a property the instructor is actually linked to:
  CONSTRAINT availability_links_property
    FOREIGN KEY (instructor_id, property_id)
    REFERENCES instructor_properties (instructor_id, property_id) ON DELETE CASCADE
);
CREATE INDEX instructor_availability_lookup_idx
  ON instructor_availability (instructor_id, property_id, day_of_week);
-- RLS: read via SECURITY DEFINER RPCs only (NOT anon-readable — don't publish exact schedules);
--      staff write as above.
```

**3. `instructor_availability_exceptions`** — date-specific overrides.
```sql
CREATE TYPE instructor_exception_kind AS ENUM ('unavailable', 'available');

CREATE TABLE instructor_availability_exceptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  property_id    uuid REFERENCES properties(id) ON DELETE CASCADE, -- NULL = all properties (PTO)
  exception_date date NOT NULL,
  kind           instructor_exception_kind NOT NULL,
  start_time     time, -- NULL = whole day
  end_time       time, -- NULL = whole day
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exception_window_valid CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  -- one-off EXTRA availability must target a specific property + window;
  -- time-off may be whole-day and/or all-property:
  CONSTRAINT available_exception_scoped CHECK (
    kind <> 'available' OR (property_id IS NOT NULL AND start_time IS NOT NULL)
  )
);
CREATE INDEX instructor_exceptions_lookup_idx
  ON instructor_availability_exceptions (instructor_id, exception_date);
-- RLS: read via SECURITY DEFINER RPCs only; staff write.
```

**Effective availability** for (instructor, property, date) =
`recurring windows for that day-of-week` **∪** `'available' exceptions (that date, that property)` **−** `'unavailable' exceptions (that date; property-specific or all-property; whole-day or windowed)`.

A property slot `[slot_start, slot_start + duration)` is **bookable** iff it is **fully contained in a single** effective window **AND** the instructor has no active booking that conflicts under the **travel-padded** overlap test (see *Cross-property travel buffer* below — this subsumes the plain same-property overlap check) **AND** property capacity allows one more (existing trigger logic).

**4. `property_travel_times`** — admin-editable travel matrix (config-in-DB). Tiny: 3 properties → at most 6 directional rows.
```sql
CREATE TABLE property_travel_times (
  from_property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  to_property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  minutes          integer NOT NULL CHECK (minutes >= 0),
  PRIMARY KEY (from_property_id, to_property_id),
  CONSTRAINT travel_distinct_properties CHECK (from_property_id <> to_property_id)
);
-- RLS: read via SECURITY DEFINER RPC/helper only (or public-read — it's not sensitive);
--      staff write (super_admin/admin). Stored directional for future-proofing; the admin
--      UI edits a symmetric matrix and writes both directions unless one-way is toggled.
```

## Phase A — Qualifications (instructor ↔ discipline)

1. **Migration:** `instructor_disciplines` + RLS (public read, staff write — mirror `instructor_properties`).
2. **Admin service:** extend `src/services/admin/instructors.ts` — load an instructor's discipline ids; `saveInstructorDisciplines` reconciles the junction. Offer only services whose `property_id` is in the instructor's `instructor_properties` set.
3. **Admin UI:** add a **Disciplines** multi-select to `src/components/admin/instructor-profile-editor-form.tsx` (grouped by property). New `saveInstructorDisciplinesAction` (or fold into the existing profile-save action) in `app/admin/instructors/[id]/actions.ts`, gated like the existing actions, with `revalidatePath`.

## Phase B — Schedules (per-property weekly + exceptions)

1. **Migration:** `instructor_availability` + `instructor_availability_exceptions` + `instructor_exception_kind` enum + RLS (no anon read; staff write).
2. **Admin service:** new `src/services/admin/instructor-schedule.ts` — load (recurring windows grouped by property+day, plus upcoming exceptions); `saveInstructorSchedule` (reconcile recurring rows for a property) and `add/removeException`. Zod-validated; reject windows for unlinked properties (the FK already guards this).
3. **Admin UI:** a **Schedule** section in the instructor editor (or a dedicated `/admin/instructors/[id]/schedule` tab):
   - Per linked property: a week grid (Sun–Sat), each day with add/remove time windows (start/end).
   - An **exceptions** list: add date-specific *time off* (whole-day or windowed; one property or all) and *one-off availability* (property + window).
   - Components: `src/components/admin/instructor-schedule-editor.tsx` (+ small window-row / exception-row children). Server actions in `app/admin/instructors/[id]/actions.ts`.

## Phase C — Instructor-aware availability (DB functions + services)

All functions `SECURITY DEFINER`, `SET search_path = public`, commented per CLAUDE.md; computed in the property's timezone. They read the (private) schedule tables on the guest's behalf without exposing them to anon.

1. **`list_qualified_instructors(p_property_id, p_service_ids uuid[], p_booking_type, p_duration_hours, p_from date, p_to date)`** → `(instructor_id, name, bio, photo_url, display_order, next_available_date)`. Filters: `is_active`, linked via `instructor_properties`, **qualified for every** `p_service_id` (see decisions). `next_available_date` = first date in `[from,to]` with ≥1 bookable slot (nullable). Ordered by `display_order`.
2. **`get_instructor_available_dates(p_instructor_id, p_property_id, p_duration_hours, p_from, p_to)`** → `setof date` — dates with ≥1 bookable slot. Powers calendar day-disabling.
3. **`get_instructor_slot_availability(p_instructor_id, p_property_id, p_date, p_duration_hours)`** → `(slot_start time, is_available boolean)` for the chosen instructor + date. Powers the time grid. Implements the **effective-availability** math above (recurring ∪ available − unavailable, slot contained in one window) intersected with `time_slots`, the **travel-padded** cross-property booking check (via `travel_minutes()` — see below; `0` for same-property collapses it to a plain overlap), and the property-capacity check.
4. **Harden `create_public_booking`** (replace the function): when `p_instructor_id` is provided, validate the instructor is (a) active + linked to the property, (b) qualified for **all** booked `service_ids`, (c) the requested window falls within their **effective availability** for that date, and (d) it clears the **travel buffer** vs. their other-property bookings — *before* relying on the constraint + trigger as the final guards. Keep the null → auto-assign path, but make auto-assign pick the first instructor that is qualified, schedule-available, **and** buffer-clear (not merely active). **Fix the `America/Chicago` hard-code** → use `properties.timezone`.
5. **Public services:** `src/services/public/instructor-availability.ts` wrapping the three read RPCs; server actions mirroring `availability-action.ts` (`getQualifiedInstructorsAction`, `getInstructorAvailableDatesAction`, `getInstructorSlotAvailabilityAction`).

## Phase D — Instructor-first WHEN step (funnel UX)

1. **Config flag:** add `requiresInstructor: boolean` to `BOOKING_TYPE_META` (`private_lesson: true`, others false). All funnel branching reads the flag — no `if (bookingType === 'private_lesson')` scattered around.
2. **State wiring** (`booking-flow-types.ts` / provider):
   - `instructorId` stays `string | null`. It is **set on load to the first available instructor** via an effect after the qualified-instructor fetch. *This is the sanctioned exception to the "display defaults belong in INITIAL_STATE" rule* — first-available is **data-dependent**, not a static default, so it cannot live in `INITIAL_STATE`. Document this inline so a future reader doesn't "fix" it.
   - On instructor change: `setState({ instructorId, date: undefined, slotStart: undefined })` — availability differs per instructor, so clear the dependent fields.
   - Changing disciplines (sub-step 1) invalidates the instructor list → refetch + re-default.
3. **WHEN step rebuild** (`booking-builder.tsx` sub-step 3, instructor-required types only):
   - **Top:** instructor selector — cards/radios (photo via `AdventureImage`, name, short bio) from `list_qualified_instructors`. First *available* selected by default. Instructors with no availability in the horizon render greyed/disabled with a "fully booked" note (shown for transparency, not hidden).
   - **Calendar:** `disabled` = before-today ∪ after-horizon ∪ **dates not in `get_instructor_available_dates`** for the selected instructor.
   - **Time grid:** from `get_instructor_slot_availability` for selected instructor + date (replaces the generic `get_slot_availability` call for these types). Non-instructor types keep today's path untouched.
   - Avoid a client waterfall: seed the initial qualified-instructor list + the default instructor's available dates from the disciplines **page** server component (it already fetches `slotsByDayOfWeek`), passed as props.
4. **Submit:** `instructorId` already flows through to `create_public_booking`. Add a `requires` check (guard/`isSubmittable`) so instructor-required types can't submit without one.

## Phase E — Hardening & edge cases

- **Empty states:** zero qualified instructors for property+discipline → "No instructor currently offers <discipline> at <property>" + contact CTA, block progress. All qualified instructors fully booked in horizon → clear message.
- **Race:** chosen instructor booked between load and submit → the existing `23P01` → `instructor_unavailable` mapping fires; on that result, re-fetch availability and prompt to re-pick (don't silently auto-reassign — the guest chose deliberately).
- **Timezone:** verify the `create_public_booking` tz fix end-to-end (a non-Central property would otherwise drift).
- **Cross-property travel buffer** — its own phase now; see below.
- **Manual RLS + availability tests** (live DB, real roles) per CLAUDE.md rule 6; `npm run typecheck`.

## Phase F — Cross-property travel buffer

An instructor booked at property A needs transit time before/after a booking at property B. The raw `[)` ranges allow zero-travel back-to-back across properties; this phase adds a real buffer. The whole thing pivots on one helper that returns **0 within a property** and the configured minutes across properties — so a single travel-padded predicate serves every check.

1. **Migration:** `property_travel_times` (above) + helper + trigger. Seed all real pairs (HBSC/Hog Heaven/Packsaddle) symmetrically so no pair falls back to the default.
   ```sql
   -- 0 same-property; configured minutes across; safe default if a pair is unseeded.
   CREATE OR REPLACE FUNCTION travel_minutes(p_from uuid, p_to uuid)
   RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
     SELECT CASE WHEN p_from = p_to THEN 0 ELSE COALESCE(
       (SELECT minutes FROM property_travel_times WHERE from_property_id = p_from AND to_property_id = p_to),
       (SELECT minutes FROM property_travel_times WHERE from_property_id = p_to   AND to_property_id = p_from),
       60  -- configurable fallback; seeding real pairs means this is never hit
     ) END;
   $$;
   ```
2. **Availability RPCs (Phase C):** in the cross-property conflict check, pad the existing booking's range with `travel_minutes(queried_property, b2.property_id)` on both ends:
   ```sql
   tstzrange(cand_from, cand_to, '[)') && tstzrange(
     b2.start_time - travel_minutes(p_property_id, b2.property_id) * interval '1 minute',
     b2.end_time   + travel_minutes(p_property_id, b2.property_id) * interval '1 minute', '[)')
   ```
   Same-property → `travel_minutes = 0` → identical to today's plain overlap. One predicate, both cases.
3. **Write-time integrity trigger** — the `no_instructor_overlap` EXCLUDE constraint **cannot** express a pair-varying pad, so add a BEFORE INSERT/UPDATE trigger on `bookings` (mirrors `check_property_capacity`; order it `04_…` after `00_compute_end_time`):
   ```sql
   CREATE OR REPLACE FUNCTION check_instructor_travel_buffer() RETURNS trigger
   LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   BEGIN
     IF NEW.instructor_id IS NULL OR NEW.status IN ('cancelled','expired','denied') THEN
       RETURN NEW;
     END IF;
     IF EXISTS (
       SELECT 1 FROM bookings b2
       WHERE b2.instructor_id = NEW.instructor_id
         AND b2.id IS DISTINCT FROM NEW.id
         AND b2.property_id <> NEW.property_id
         AND b2.status NOT IN ('cancelled','expired','denied')
         AND tstzrange(NEW.start_time, NEW.end_time, '[)') && tstzrange(
               b2.start_time - travel_minutes(NEW.property_id, b2.property_id) * interval '1 minute',
               b2.end_time   + travel_minutes(NEW.property_id, b2.property_id) * interval '1 minute', '[)')
     ) THEN
       RAISE EXCEPTION 'instructor needs travel time between properties for this window'
         USING ERRCODE = 'P0003';
     END IF;
     RETURN NEW;
   END; $$;
   ```
   Map `P0003` in `src/services/bookings/create-public-booking.ts` to a friendly `instructor_unavailable`-style reason ("That time is too close to another commitment — pick a later slot.").
4. **Admin matrix UI:** a small 3×3 travel-time grid (diagonal locked to 0) on a settings/properties admin surface; service + action to read/write `property_travel_times` (write both directions from one symmetric entry unless a one-way toggle is set).

> **Same-property is always zero-buffer (by design).** Back-to-back lessons at the *same* property — e.g. group 1 at 9–11 and group 2 at 11–13 at Property A — are always allowed: `travel_minutes(A, A) = 0` and the trigger skips same-property pairs (`b2.property_id <> NEW.property_id`), so they're governed only by the existing `no_instructor_overlap` exclusion constraint, which permits adjacent `[)` blocks. The pad applies **only across properties**. (No same-property turnover/cleanup gap in v1 — the predicate supports one if ever wanted, default 0.)
>
> Note: the buffer is enforced **between bookings**, not against declared schedule windows — if an admin declares physically impossible hours at two properties, that's their call; only real bookings create conflicts.

## Files (representative)

- **Migrations:** `…_instructor_disciplines.sql`, `…_instructor_schedules.sql`, `…_instructor_aware_availability_rpcs.sql` (the three read functions + hardened `create_public_booking`), `…_property_travel_buffer.sql` (`property_travel_times` + `travel_minutes` + `check_instructor_travel_buffer` trigger).
- **Admin:** extend `src/services/admin/instructors.ts`; new `src/services/admin/instructor-schedule.ts`; `src/components/admin/instructor-schedule-editor.tsx` + disciplines multi-select in `instructor-profile-editor-form.tsx`; actions in `app/admin/instructors/[id]/actions.ts`.
- **Public availability:** `src/services/public/instructor-availability.ts`; server actions alongside `app/(public)/book/[property]/disciplines/availability-action.ts`.
- **Funnel:** `requiresInstructor` in `src/constants/public/booking-types.ts`; new `src/components/public/booking-flow/instructor-picker.tsx`; edits to `booking-builder.tsx`, `booking-flow-types.ts`, the disciplines `page.tsx`.

## Defaults I'm assuming — flag any to change

- **Discipline filter = ALL** selected disciplines must be taught by the instructor (vs. ANY). Most private lessons pick one discipline, so usually moot.
- **"First available" = first by `display_order` among instructors with availability in the horizon** (not merely first active).
- **Exceptions:** `property_id NULL` = all-property time-off (PTO); `'available'` exceptions must be property + window scoped.
- **A lesson must fit inside a single continuous availability window** (no spanning two adjacent windows).
- **Schedules are not anon-readable** — only computed availability is exposed, via SECURITY DEFINER RPCs. `instructor_disciplines` *is* public-read (needed to list/filter).
- **Travel matrix is property-pair** (recommended over a single global constant — config-in-DB, only 3 properties). Stored directional, edited symmetric; unseeded pairs fall back to a configurable default (60 min). Buffer applies between bookings only, not declared schedule windows. *Downgrade to a single global constant if you'd rather not maintain a matrix.*

## Out of scope / notes

- **Supersedes App 14 Phase C** (the "separate Instructor step + any-instructor card picker"). Reuse its instructor-card visual ideas; the selection now lives **inside** the WHEN step and is availability-driven.
- App 14 Phase B (public `/instructors` marketing page) is independent and unaffected.
- Instructor **self-service** profile + schedule editing is **built** (2026-06-09) — `/instructor/profile` lets an instructor edit their own name/bio/photo/phone AND their weekly hours + time off. Self-actions resolve `current_instructor_id` server-side (never trust a client id) and reuse the admin schedule services via service-role; presentation edits are limited to name/bio/photo/phone (roster controls — active/order/properties/disciplines — stay admin-only). The schedule editor is shared via a `mode` prop; the photo input via an injected upload action. Landing stays the gameplan home + a "complete your profile" nudge.
- No change to non-instructor booking types' availability path.
- Apply migrations via the file + `supabase db push` — **not** the MCP tool (avoids migration-history drift, per TRACKER).

## Verification

- **Admin:** set an instructor's disciplines + a per-property weekly schedule + a time-off exception → all persist; services offered are limited to linked properties.
- **Booking (instructor-first):** private lesson at a property → instructor cards appear, first available preselected; calendar disables days the instructor isn't working; time grid shows only slots inside their effective windows and not conflicting with their bookings **at any property**; switching instructor re-renders dates/slots; submit persists the chosen `bookings.instructor_id`.
- **Cross-property:** book Jane 9–11 at HBSC → her 9–11 (and overlapping slots) disappear from Hog Heaven availability.
- **Travel buffer:** with HBSC→Hog Heaven = 60 min, Jane booked 9–11 at HBSC → Hog Heaven 11:00 start is greyed out, 12:00 start is bookable; the symmetric case (a Hog Heaven slot ending too close to a *later* HBSC booking) is also blocked. A direct DB INSERT that violates the buffer is rejected by the `check_instructor_travel_buffer` trigger (`P0003`), not just the RPC.
- **Exceptions:** a whole-day all-property time-off removes Jane everywhere that date; a one-off `'available'` window adds a slot outside her recurring pattern.
- **Write guard:** attempting to book an unqualified or off-schedule instructor (stale client) is rejected by `create_public_booking`, not just the exclusion constraint.
- **RLS:** anon can read `instructor_disciplines` + compute availability via RPC, but **cannot** read `instructor_availability` / `…_exceptions` directly.
- `npm run typecheck` clean; migrations applied via `supabase db push`.

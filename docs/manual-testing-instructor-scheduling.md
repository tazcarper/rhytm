# Manual Testing — Instructor Scheduling & Instructor-First Booking

End-to-end checklist for the instructor-scheduling feature (plan:
`plans/instructor-scheduling-and-availability.md`, Phases A–D). Run once
top-to-bottom; each scenario builds on the data from the previous one. Can be
folded into `docs/manual-testing.md` as the **I-series** once it passes.

Re-run **I1–I14** before any change touching: `instructor_disciplines` /
`instructor_availability` / `instructor_availability_exceptions` /
`property_travel_times` schema, the `save_instructor_profile` /
`save_instructor_schedule` / `get_instructor_slot_availability` /
`get_instructor_available_dates` / `list_qualified_instructors` /
`instructor_next_available_date` / `create_public_booking` functions, the
`check_instructor_travel_buffer` trigger, the booking-flow components
(`<BookingBuilder>`, `<InstructorWhenStep>`), or the instructor self-service
surface (`/instructor/profile`, `instructor-self-profile-form`, the
`InstructorScheduleEditor` `mode` prop, the `self-profile` service/actions).

## Prerequisites

- [ ] `npm run dev` is running; you're signed in to `/admin` as super_admin or admin.
- [ ] Migrations `…130000` through `…200000` are applied (the instructor-scheduling set).
- [ ] At least one **active** instructor exists, linked to a property that has both
      **services** (disciplines) and **time slots**. (The seeded data already satisfies
      this — 8 instructors, 3 properties, 10 services.)
- [ ] Note the **property** and **instructor** you'll use, and an **email** you can reuse
      for guest submissions (e.g. `you+lesson@gmail.com`).
- [ ] Reminder: cross-property travel buffer defaults to **60 min** until `property_travel_times`
      is populated. That default is what scenario I10 exercises.

---

## Part 1 — Admin data setup (Phases A & B)

### I1 — Assign a discipline (Phase A qualification)

- [ ] Go to `/admin/instructors` → click your instructor → lands on `/admin/instructors/[id]`.
- [ ] Confirm the **Availability → Available at** list shows the instructor's properties; note one
      property that has disciplines below it.
- [ ] In the **Disciplines** section, under that property, check **one** discipline.
      - *If you see "No disciplines defined for X yet — add them in the catalog,"* the property has
        no active services. Switch to a property that lists disciplines (or add a service in the
        catalog first).
- [ ] Click **Save changes** → expect a green **"Saved — Profile updated."**
- [ ] **Reload the page** → the discipline checkbox is still ticked.
      ✅ *Phase A save RPC persisted the qualification.*

### I2 — Set a weekly schedule (Phase B recurring)

- [ ] On the profile page, click **"Weekly schedule & time off →"** → `/admin/instructors/[id]/schedule`.
- [ ] Under the property card from I1, click **"Fill week with 9–5"** → every day gets a 09:00–17:00
      window. (Or set days individually via **"+ Add hours"**.) 9–5 covers the property's slot times.
      - [ ] Click it again → it does **not** duplicate windows on days that already have one (non-destructive).
      - [ ] Remove a day or two (e.g. Sat/Sun) to confirm those become "Unavailable".
      - [ ] On **one weekday**, change its window to **09:00 – 12:00** (morning only) — used in I5 to
            confirm afternoon slots grey out.
- [ ] Click **Save weekly schedule** → expect **"Saved — Weekly schedule updated."**
- [ ] **Reload** → the windows are still there.
      ✅ *Phase B replace-all schedule RPC persisted.*
- [ ] Try a bad window (end before start, e.g. 14:00 – 10:00) → **Save** → expect an inline error
      ("end time must be after its start time"), no save.

### I3 — Add a time-off exception (Phase B exceptions)

- [ ] On the schedule page, in **Time off & one-off availability**, pick an **upcoming date that falls
      on one of the weekdays you scheduled** (so it's normally bookable). Type **Time off**, **Whole day**,
      add a reason, click **Add exception**.
- [ ] The exception appears in the list with a red **"Time off"** tag, the date, "All properties", "All day".
- [ ] Switch Type to **Extra hours** → confirm the **"All properties"** option disappears and a **time
      window is required** (the form forces a specific property + From/To). Add one for a date you did
      *not* schedule (e.g. a Saturday), 10:00 – 12:00 → it appears with a green **"Extra hours"** tag.
- [ ] Delete one exception via **Remove** → it disappears.
      ✅ *Exceptions add/delete + the available-must-be-scoped rule.*

---

## Part 2 — Guest booking, instructor-first (Phases C & D)

### I4 — The instructor picker appears and defaults to first available

- [ ] Open a fresh tab → `/book` → pick the **property** from I1 → pick **Private Lesson**.
- [ ] **Step 1 (Disciplines):** select the discipline you assigned in I1 → **Next**.
- [ ] **Step 2 (Guests):** leave at 1 → **Next**.
- [ ] **Step 3:** header reads **"Choose your instructor & time"**, and an **instructor picker** shows.
      - [ ] Your instructor appears, **pre-selected** (highlighted), tagged **"Available"**.
      - [ ] Instructors *not* qualified for this discipline are **absent** from the list.
      ✅ *list_qualified_instructors + default-to-first-available.*

### I5 — Calendar + slots reflect the real schedule

- [ ] In the calendar, **scheduled weekdays are selectable**; days with **no** weekly hours
      (the ones you removed in I2) and the **time-off date from I3** are **greyed/disabled**.
- [ ] Click a **full 9–5 day** → all four slots (9 AM, 11 AM, 1 PM, 3 PM) are selectable.
- [ ] Click the **morning-only day** (09:00–12:00 from I2) → **9 AM & 11 AM** are selectable but
      **1 PM & 3 PM are greyed/struck-through** (outside the window).
      ✅ *get_instructor_available_dates (calendar) + get_instructor_slot_availability (slots) honor the window.*

### I6 — Submit creates a booking assigned to that instructor

- [ ] Pick an available slot → **Continue →** → on `/details`, enter Name + your test **email** → **Submit booking →**.
- [ ] You land on the **bid page** (`/bids/<slug>/<code>`) with no error.
- [ ] **Verify the instructor was recorded** — ask me to run this (or run in Supabase SQL):
      ```sql
      select b.start_time, b.status, i.name as instructor, p.name as property
      from bookings b
      join instructors i on i.id = b.instructor_id
      join properties p on p.id = b.property_id
      where b.guest_email = '<the email you used>'
      order by b.created_at desc limit 3;
      ```
      Expect the top row to show **your chosen instructor** + property.
      ✅ *create_public_booking persisted the picked instructor (property-tz correct).*

### I7 — Switching instructors re-renders availability *(needs a 2nd qualified instructor)*

- [ ] In `/admin`, give a **second** instructor the **same discipline** (I1) but a **different schedule**
      (e.g. only Tue/Thu) at the same property.
- [ ] Re-run I4 to Step 3 → both instructors appear. Click the second one →
      - [ ] The **calendar re-renders** to that instructor's days, and any previously-picked date/time clears.
      ✅ *Per-instructor availability + clear-on-switch.*

### I8 — No qualified instructor → clean empty state

- [ ] Start a Private Lesson and in Step 1 pick a discipline **no instructor is qualified for**
      (assign none, or pick a different discipline) → Step 3 shows the amber
      **"No instructor available"** notice, and **Continue is disabled** (can't proceed).
      ✅ *Empty-state guard.*

---

## Part 3 — Travel buffer + non-regression

### I9 — Time-off removes a normally-open day *(already covered by I5)*

- [ ] Confirm again: the I3 whole-day time-off date is **not selectable** in the I4/I5 calendar,
      even though its weekday has weekly hours. ✅

### I10 — Cross-property travel buffer (60-min default) *(advanced)*

- [ ] In `/admin`, link your instructor to a **second property** (Availability checkboxes), give them
      **the same discipline** there, and **weekly hours on the same weekday** at *both* properties.
- [ ] As a guest, book a **Private Lesson at Property A** for, say, **11:00** on that weekday (complete I6).
- [ ] Start a new Private Lesson at **Property B**, same discipline, same date, same instructor → in the
      slot grid:
      - [ ] The **11:00** slot at B is **greyed** (overlaps the A booking).
      - [ ] The **9:00** slot at B is **greyed** (ends 10:00, < 60 min before the 11:00 A start).
      - [ ] A slot **≥ 60 min clear** of the A booking (e.g. **1:00 PM**, since A ends 12:00) **is selectable**.
      ✅ *travel_minutes default + travel-padded availability.*
- [ ] *(Optional integrity check)* If you instead try to force the booking through, the
      `check_instructor_travel_buffer` trigger rejects it — surfaced as
      *"That time is too close to another booking for this instructor — pick a later slot."*

### I11 — Standard booking types are unaffected

- [ ] Book a **Plan a Visit** → Step 3 is the **standard** date/time picker (no instructor section),
      and slots grey out from existing bookings as before.
- [ ] Book a **Host an Occasion** → it skips disciplines and uses the **standard** When step.
      ✅ *requiresInstructor flag isolates the new path; other types untouched.*

### I12 — Back/forward preserves the When selection

- [ ] In a Private Lesson, reach Step 3, pick instructor + date + slot → **← Back** to Step 2 →
      **Next** to Step 3 → your instructor, date, and time are **still selected** (no reset).
      ✅ *Funnel state persists across sub-step nav; default-select doesn't clobber a valid pick.*

---

---

## Part 4 — Instructor self-service (sign-in → own profile + schedule)

> Prereq: the instructor has portal access — they've accepted their invite, OR you
> grabbed a sign-in link via the roster's **"Resend link"** button or the `/dev/emails`
> outbox. Sign-in is a magic link to their email at `/login`.

### I13 — Instructor signs in and completes their own profile

- [ ] Sign in as the instructor (magic link) → you land on **`/instructor`** ("Your gameplan").
- [ ] If their bio/photo are empty, a **"Complete your profile"** banner shows. Click **Profile**
      in the top nav (or the banner link) → **`/instructor/profile`**.
- [ ] Confirm the page lets you edit **name, bio, photo, phone** and shows **Your schedule** below —
      but there is **NO** control for active/inactive, display order, which properties they teach,
      or disciplines (those stay admin-only).
- [ ] Edit the bio, upload a photo, set a phone → **Save profile** → **"Your profile is updated."**
- [ ] **Reload** → the changes persist. Back on **`/instructor`**, the banner is **gone** (bio + photo set).
- [ ] *(Cross-check)* In `/admin/instructors/[id]`, the admin sees the same updated bio/photo/phone.
      ✅ *Self-service presentation edit — current-instructor-scoped; roster controls untouched.*

### I14 — Instructor sets their OWN schedule → it drives the guest funnel

- [ ] On **`/instructor/profile`**, under **Your schedule**, click **"Fill week with 9–5"** for a
      property, trim a day or two, and add one **Time off** date → **Save weekly schedule** → reload persists.
- [ ] In a separate guest tab, book a **Private Lesson** at that property + the instructor's discipline → Step 3:
      - [ ] The instructor appears in the picker with the **bio + photo** they set in I13.
      - [ ] The calendar + slots match the hours **the instructor** just set (scheduled days open;
            the time-off date disabled; slots outside the window greyed).
      ✅ *Instructor self-service writes reach the same availability path as admin writes.*

> Security note (no UI step): the self-actions resolve the signed-in instructor server-side and
> ignore any client-passed id, so an instructor can only ever read/write their own profile + schedule.

---

## Result log

| Date | Scenarios | Result | Notes |
|---|---|---|---|
| 2026-06-09 | I1–I14 | ✅ Confirmed working | Informal end-to-end pass in dev — admin setup, instructor-first guest booking, and instructor self-service profile/schedule all functioning. |

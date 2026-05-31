# App 4 — Member Portal: Session Handoff Prompt

Self-contained prompt for a fresh Claude session to continue App 4. Copy the block below into a new session as the first message.

---

## Prompt to paste

Continue App 4 — Member Portal. Three remaining surfaces: **my bookings**, **adventures listing**, and **RSVP UI**. The auth gate, `/login` page, callback, and `/member` route stub all already shipped (App 1). This session adds the actual member-facing product.

### Context to read (in this order, in parallel where possible)

1. **`CLAUDE.md`** — SOLID rules, project structure (`app/` is routing-only; domain code lives in `src/`), client state rules, RLS rules, architecture decisions. All required reading.
2. **`TRACKER.md`** — current state. The App 4 row (line ~80) ends with: *"Remaining App 4 work: my bookings, adventures listing, RSVP UI. Downstream consumer: App 3 sub-phase 3.8 (`/admin/members/[id]/preview`) re-renders these same dashboard components driven by admin-RLS-scoped data — build them with that reuse in mind (data-source as a prop, not hard-coded `auth.uid()`-scoped queries inside the components). 3.8 is gated on these landing."* That constraint shapes the whole build.
3. **`plan/supabase/phase-7-rls.md`** — canonical RLS reference. Especially: `current_member_active_property_ids()`, `current_member_active_membership_ids()`, `current_household_person_ids()` helpers. These are how cross-table member-scoped reads work without recursion.
4. **Memory** — load `MEMORY.md` (`/home/tazcarper/.claude/projects/-mnt-c-Users-tazca-Documents-rythm/memory/MEMORY.md`). Pay attention to:
   - `feedback_display_defaults_to_state.md` — applies to any new React state
   - `feedback_intent_revealing_names.md` — applies to all new TS/TSX
   - `project_membership_model.md` — `people` + `memberships` + `membership_people` junction; RSVPs key off `memberships.id`
   - `project_member_adventures.md` — curated 3rd-party trips; flat rate + paid guests + staff-overridable sold-out
   - `project_admin_member_visibility.md` — admins don't get `/member` access; preview-as-member lives in `/admin`
   - `project_observability_deferred.md` — App 10 is intentionally on hold; don't propose Sentry/Axiom

### Survey the existing surface before designing

Run these (parallel) to see what's already in the codebase so you extend vs. duplicate:

```bash
ls app/member/ src/components/members/ src/services/members/ 2>&1
grep -rn "member_adventures\|bookings.*member_user_id\|current_member_active" src/services/ 2>/dev/null | head -20
```

### What's done already (don't rebuild)

- Production `/login` surface (magic-link + Google OAuth, error alert handling)
- `/auth/callback` with JWT refresh hardening (Google OAuth role-claim bug fixed)
- Middleware portal allowlist — `/member` is `member`-role only
- Household-visibility stub on `/member` (shows current member's basic profile + household)
- `memberships` + `people` + `membership_people` schema (post-2026-05-18 split)
- `member_adventures` + `member_adventure_rsvps` schema (Phase 5) with capacity trigger, manual sold-out, waitlist promotion via Inngest
- RLS policies + helper functions for member-scoped reads

### Scope for this session

Three deliverables, each its own sub-phase:

1. **My bookings page** (`/member/bookings` likely). Lists bookings where `member_user_id = auth.uid()`. Should show: date/time, property, booking type, status (confirmed / signed / paid / cancelled / completed), link to bid page if not yet finalized. Includes household-visible bookings via the household-person-ids helper.

2. **Adventures listing** (`/member/adventures` likely). Lists `member_adventures` available at any of the member's active properties (filter via `current_member_active_property_ids()`). Shows: title, date, property, price, paid-guest pricing, capacity remaining, sold-out badge if `is_manually_sold_out OR sold_out`. Excludes adventures the member already RSVP'd to (or shows the RSVP inline).

3. **RSVP UI**. Click-to-RSVP from the adventure listing (or detail page if needed). Server Action that inserts into `member_adventure_rsvps` with `membership_id = current_member_active_membership_ids()` and `created_by_person_id = current_person_id()`. Server Action because the capacity trigger needs row-lock-correct execution; no client-side RLS write path. Handles guest count (`max_guests_per_rsvp` cap) and updates the listing optimistically.

### Hard constraints (these have cost real bugs — see memory)

1. **Data source as a prop.** Components MUST receive their rows as props; they MUST NOT call `auth.uid()`-scoped queries internally. This is the contract that makes App 3.8 preview-as-member work without duplicating the React tree. Page wrappers fetch with the right scope and pass down. Example shape:
   ```tsx
   // src/components/members/my-bookings-list.tsx
   export function MyBookingsList({ bookings }: { bookings: MemberBookingRow[] }) { ... }

   // app/member/bookings/page.tsx
   const bookings = await getMyBookings(supabase, userId);
   return <MyBookingsList bookings={bookings} />;

   // app/admin/members/[id]/preview/page.tsx  (LATER — App 3.8)
   const bookings = await getMemberBookings(supabase, memberId);
   return <MyBookingsList bookings={bookings} />;
   ```

2. **Display defaults belong in state, not at the read site.** If you add any local React state, set defaults in the provider's `INITIAL_STATE` (or `useState`'s initial value), not as `?? default` at the read site. See `feedback_display_defaults_to_state.md` for the past bug.

3. **No raw `?? default` for sometimes-absent state if it could mean "user accepted the default."** Funnel state taught us this.

4. **SOLID, especially Single Responsibility and Dependency Inversion.** Services take their Supabase client as a parameter, return domain types (not raw PostgREST shapes). Server Actions are thin — validate, call service, return result.

5. **Intent-revealing names** (see `feedback_intent_revealing_names.md`). No `raw`, `q`, `qs`, `v`, `obj`, `fmt`, single-letter map vars. `i`, `e`, `err`, `ctx`, `s` are allowed idioms.

### Suggested approach for the session

1. **First deliverable: draft `plan/app/app-4-member-portal.md`** in the same shape as `plan/app/app-9-inngest.md`. Sections: scope, decisions locked in, sub-phase breakdown, file layout (new + modified), RLS interactions, test pack, open questions. **Get user approval on the plan before writing any code.** App 4 has no plan doc today; that's the natural first move.
2. After approval, work sub-phase by sub-phase. Use `TaskCreate` to track each sub-phase's steps; mark `completed` as each lands. Don't batch.
3. After each sub-phase: `npx tsc --noEmit` clean + ask the user to verify locally before flipping the TRACKER row.
4. Update `TRACKER.md` App 4 row at each sub-phase completion (same pattern as App 9's row).

### What NOT to do this session

- **Don't reach for `auth.uid()` inside components.** Pass data in as props.
- **Don't introduce Sentry / Axiom / observability.** App 10 is deferred until pre-1.0 launch (see `project_observability_deferred.md`).
- **Don't expand scope** beyond my bookings + adventures + RSVP unless the user asks.
- **Don't open new Supabase migrations** — schema is in place. If a query genuinely needs a new helper or column, propose the migration in the plan doc and wait for approval.
- **Don't propose App 10 (observability)** as a next move when this session wraps. The next move after App 4 is App 3 sub-phase 3.8 (preview-as-member), which App 4 unblocks.
- **Don't recommend Inngest workflow bodies** (W1–W4 / W6) — those are client-blocked on Q7 / Q8 / Q15 / HubSpot access.

### Open questions to surface (not block on)

Some of the work here intersects open client questions that have recommended defaults but no answers yet. Note them in the plan doc but proceed with the recommendation:

- **Q9 — Membership tiers** — if the bookings list should show tier-based pricing context, it currently can't (no tier vocabulary). Proceed without; revisit if Q9 lands.
- **Q14 — Adventure RSVP payment & cancellation policy** — affects whether RSVP charges immediately, takes a deposit, or is free-to-cancel. Proceed with the simplest path (RSVP holds the spot; no payment at this surface) and note Q14 in the plan doc.
- **Q15 — Pre-event email cadence** — orthogonal to the UI; Inngest workflow concern.

### When the session is done

Hand off back to the user with:
- Summary of what landed (under 200 words)
- TRACKER + plan doc updated
- Any new memories saved (especially feedback memories if a non-obvious approach got validated)
- Verification status — `tsc` clean + user-confirmed local check (or honest "user hasn't verified yet")
- A "ready / not ready to mark sub-phase X done" call

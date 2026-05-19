# Phase 5 — Member Adventures

> ⚠️ **Updated 2026-05-18 to match the people/memberships schema split.** RSVPs now reference `memberships.id` (the account that owns the RSVP) plus `created_by_person_id` (audit — which spouse made it). Member-facing RLS traverses `people → membership_people → memberships`. See migration `20260518232029_split_members_into_people_memberships.sql` for the actual schema.

## Prerequisites

- Phase 1 complete (`properties`)
- Phase 4 complete (`people`, `memberships`, `membership_people`)
- `handle_updated_at()` trigger function created (Phase 1)
- Helper functions `auth_role()`, `is_admin()`, `auth_property_id()` created (Phase 4). No `auth_member_id()` — members can hold memberships at multiple properties, so the "current member" is derived from `members` joined on `user_id = auth.uid()`, not from a JWT claim.

## What This Phase Builds

`adventure_status_enum`, `rsvp_status_enum`, `member_adventures`, `member_adventure_rsvps`

Plus: a capacity enforcement trigger that prevents race conditions when multiple members RSVP simultaneously near the capacity limit.

---

## Key Design Decisions

**Adventures are capacity-constrained, not time-slot-constrained.** Unlike bookings, adventures do not interact with `time_slots` or the property capacity trigger. They have their own `max_capacity` and the constraint is enforced here.

**The capacity check must be in the database, not the application.** Two concurrent RSVP requests near capacity can both pass an application-level check before either commits. A `BEFORE INSERT OR UPDATE` trigger with a `SELECT ... FOR UPDATE` lock on the adventure row prevents this race.

**Waitlist is application logic, not a constraint.** The trigger only prevents over-confirming. Setting a new RSVP to `waitlisted` instead of `confirmed` is the application's responsibility when it detects the adventure is full.

**Member-facing access follows cross-property memberships (Phase 4).** A member who holds memberships at HSB and Packsaddle can see and RSVP to adventures at *either* property. RLS does not read a single `property_id` claim from the JWT (members don't carry one); instead, every member-facing policy joins `members` on `user_id = auth.uid()` and accepts rows whose `property_id` matches any of the user's active memberships. The "active" filter (`members.status = 'active'`) lives in the policy itself, so lapsed/suspended members are excluded automatically.

**Member updates go through Server Actions, not RLS.** Mirroring the Phase 4 decision on `members`: there is no `FOR UPDATE` policy for members on `member_adventure_rsvps`. Cancellations (and any future member-initiated edits) call a Server Action that uses the service role and validates the column allowlist — typically only allowing `status = 'cancelled'`. RLS is row-level and would otherwise let a browser-side `update()` change `guest_count`, `member_id`, or `deposit_payment_intent_id`.

**Pricing is per-party with an optional per-guest add-on.** A member RSVP'ing alone pays `price`. A member with additional guests pays `price + (guest_count - 1) × guest_price`. `guest_price` is nullable — null means "no extra charge for guests" (the flat `price` covers the whole party). This lets each adventure pick its own pricing model: pure flat, per-extra-guest add-on, or anywhere in between. The arithmetic lives in the Server Action that creates Stripe payment intents (Phase 5 → App 6) — never in the DB.

**Guest count is capped per RSVP, not just in aggregate.** `max_capacity` caps the total people across the whole adventure. `max_guests_per_rsvp` caps the value any single RSVP can set on its `guest_count` — so one member cannot consume the entire capacity by booking with `guest_count = max_capacity`. The capacity trigger enforces both bounds. Note the naming subtlety: `guest_count` includes the member themselves (a solo member's `guest_count` is `1`), and `max_guests_per_rsvp` is the cap on that same value (a `max_guests_per_rsvp` of `4` means up to 3 additional guests + the member).

**Manual sold-out is an explicit staff override, not a status value.** The capacity-based `sync_adventure_sold_out` trigger flips `status` between `published` and `sold_out` based on `confirmed_count >= max_capacity`. That auto-sync alone cannot model the 3rd-party-operator case — e.g., the outfitter tells Rhythm "we're full at 18, not the 20 in our system." A separate `is_manually_sold_out boolean` flag captures that intent: when set by staff, the capacity trigger rejects new confirmed RSVPs (forcing them to waitlist) and the auto-sync triggers skip status updates so a single cancellation cannot quietly re-open booking. `status` remains capacity-driven; `is_manually_sold_out` is staff-driven; the member portal derives "show waitlist UX" from `status = 'sold_out' OR is_manually_sold_out = true`.

---

## Migration

### Step 1 — Enums

```sql
CREATE TYPE adventure_status_enum AS ENUM (
  'draft',      -- invisible to members
  'published',  -- visible and bookable
  'sold_out',   -- visible but no new RSVPs (capacity full)
  'cancelled',  -- cancelled by staff
  'completed'   -- event happened
);

CREATE TYPE rsvp_status_enum AS ENUM (
  'confirmed',   -- holding a confirmed spot
  'waitlisted',  -- on the waitlist; no spot held
  'cancelled'    -- member cancelled their RSVP
);
```

### Step 2 — `member_adventures`

```sql
CREATE TABLE member_adventures (
  id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid   NOT NULL REFERENCES properties(id),

  title        text   NOT NULL,
  description  text,
  start_date   date   NOT NULL,
  end_date     date   NOT NULL,

  -- Capacity
  max_capacity         integer NOT NULL CHECK (max_capacity > 0),
  max_guests_per_rsvp  integer NOT NULL CHECK (max_guests_per_rsvp > 0),

  -- Pricing (pending Q14: deposit vs. full payment).
  -- price = what a solo member pays (guest_count = 1).
  -- guest_price = additional fee for each guest beyond the member.
  --   NULL means no extra charge per guest (flat price covers the party).
  -- Total charged at RSVP time = price + (guest_count - 1) * COALESCE(guest_price, 0)
  price           numeric(10,2) NOT NULL CHECK (price >= 0),
  guest_price     numeric(10,2) CHECK (guest_price IS NULL OR guest_price >= 0),
  deposit_amount  numeric(10,2),  -- null = full payment upfront

  -- Visible status. Auto-managed by the capacity-based triggers.
  status  adventure_status_enum NOT NULL DEFAULT 'draft',

  -- Staff override. When true, the capacity trigger rejects new confirmed
  -- RSVPs (forcing waitlist) and the auto-sync triggers skip updating
  -- `status`. Independent of `status` so the operator-side "we're full"
  -- case (3rd-party event capped below max_capacity) cannot be undone by
  -- a single RSVP cancellation. Member portal treats either
  -- `status = 'sold_out'` or `is_manually_sold_out = true` as sold-out.
  is_manually_sold_out boolean NOT NULL DEFAULT false,

  details jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT end_after_start CHECK (end_date >= start_date),
  -- Per-RSVP cap can't exceed the whole adventure
  CONSTRAINT guests_per_rsvp_within_capacity
    CHECK (max_guests_per_rsvp <= max_capacity)
);

CREATE INDEX idx_adventures_property_status
  ON member_adventures (property_id, status, start_date);

CREATE TRIGGER member_adventures_updated_at
  BEFORE UPDATE ON member_adventures
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE member_adventures ENABLE ROW LEVEL SECURITY;

-- Members see published/sold_out adventures at any property where they
-- hold an active membership. Joins through `members` because members
-- can hold memberships at multiple properties (Phase 4 cross-property
-- model), so the JWT carries no single property_id claim for them.
CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (
      SELECT property_id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- Staff see all adventures for their scope
CREATE POLICY "adventures: admin read all"
  ON member_adventures FOR SELECT
  USING (is_admin());

CREATE POLICY "adventures: property_manager read"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- Only admin and property_manager can create/update/delete adventures
CREATE POLICY "adventures: admin write"
  ON member_adventures FOR ALL
  USING (is_admin());

CREATE POLICY "adventures: property_manager write"
  ON member_adventures FOR ALL
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );
```

### Step 3 — `member_adventure_rsvps`

```sql
CREATE TABLE member_adventure_rsvps (
  id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id uuid   NOT NULL REFERENCES member_adventures(id),
  member_id    uuid   NOT NULL REFERENCES members(id),

  guest_count  integer NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  status       rsvp_status_enum NOT NULL DEFAULT 'confirmed',

  -- Payment (pending Q14)
  deposit_payment_intent_id  text,
  balance_payment_intent_id  text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One RSVP per member per adventure
  UNIQUE (adventure_id, member_id)
);

CREATE INDEX idx_rsvps_adventure ON member_adventure_rsvps (adventure_id, status);
CREATE INDEX idx_rsvps_member    ON member_adventure_rsvps (member_id);

CREATE TRIGGER member_adventure_rsvps_updated_at
  BEFORE UPDATE ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Step 4 — Trigger: capacity enforcement

Locks the parent `member_adventures` row (`FOR UPDATE`) before checking against its current state. Three guardrails fire here:

1. **Per-RSVP guest cap.** Any non-cancelled RSVP must satisfy `guest_count <= max_guests_per_rsvp`. Applied to waitlisted rows too — a waitlisted RSVP that exceeds the cap would become invalid the moment it's promoted, so reject up front.
2. **Manual sold-out.** When `is_manually_sold_out = true`, confirmed RSVPs are rejected outright. The application must route to `waitlisted` instead.
3. **Total capacity.** A confirmed RSVP must keep `SUM(guest_count) <= max_capacity`. The row lock serializes concurrent inserts and prevents two members from both "seeing room" before either commits.

```sql
CREATE OR REPLACE FUNCTION check_adventure_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_max_guests_per_rsvp  integer;
  v_is_manually_sold_out boolean;
  v_confirmed_count      integer;
BEGIN
  -- Lock the adventure row. Always run — every code path below needs
  -- the current state, and the lock serializes concurrent RSVPs.
  SELECT max_capacity, max_guests_per_rsvp, is_manually_sold_out
    INTO v_max_capacity, v_max_guests_per_rsvp, v_is_manually_sold_out
  FROM member_adventures
  WHERE id = NEW.adventure_id
  FOR UPDATE;

  -- (1) Per-RSVP guest cap — enforce for everything except cancellations.
  IF NEW.status != 'cancelled' AND NEW.guest_count > v_max_guests_per_rsvp THEN
    RAISE EXCEPTION
      'guest_count % exceeds max_guests_per_rsvp % for this adventure',
      NEW.guest_count, v_max_guests_per_rsvp;
  END IF;

  -- Waitlisted and cancelled don't consume capacity — done.
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- (2) Manual sold-out blocks all new confirmed RSVPs.
  IF v_is_manually_sold_out THEN
    RAISE EXCEPTION
      'adventure is marked sold-out by staff; new RSVPs must be waitlisted';
  END IF;

  -- (3) Total capacity (sum of guest_count, not row count).
  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id
    AND status = 'confirmed'
    AND id IS DISTINCT FROM NEW.id;

  IF v_confirmed_count + NEW.guest_count > v_max_capacity THEN
    RAISE EXCEPTION
      'adventure is at capacity (% of % spots taken)',
      v_confirmed_count, v_max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rsvps_check_capacity
  BEFORE INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION check_adventure_capacity();
```

### Step 5 — Trigger: auto-update adventure status to `sold_out`

When a new RSVP brings confirmed guests to exactly `max_capacity`, flip the adventure to `sold_out`. This keeps the member portal's "available" indicator accurate without polling.

```sql
CREATE OR REPLACE FUNCTION sync_adventure_sold_out()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity         integer;
  v_is_manually_sold_out boolean;
  v_confirmed_count      integer;
BEGIN
  SELECT max_capacity, is_manually_sold_out
    INTO v_max_capacity, v_is_manually_sold_out
  FROM member_adventures WHERE id = NEW.adventure_id;

  -- Staff override wins. Auto-sync never overwrites a manually-set status —
  -- this is the whole point of the manual flag: a single cancellation
  -- must not silently re-open booking when the operator said "we're full."
  IF v_is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.adventure_id AND status = 'confirmed';

  IF v_confirmed_count >= v_max_capacity THEN
    UPDATE member_adventures
    SET status = 'sold_out', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'published';
  ELSE
    -- Re-open if a cancellation freed space
    UPDATE member_adventures
    SET status = 'published', updated_at = now()
    WHERE id = NEW.adventure_id AND status = 'sold_out';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rsvps_sync_adventure_sold_out
  AFTER INSERT OR UPDATE OF status, guest_count ON member_adventure_rsvps
  FOR EACH ROW EXECUTE FUNCTION sync_adventure_sold_out();
```

### Step 5.5 — Trigger: re-sync `sold_out` when staff changes `max_capacity`

If staff edits `max_capacity` while RSVPs already exist, the visible status can desync — e.g., dropping a 20-cap adventure to 10 while 15 confirmed RSVPs exist should immediately mark the adventure `sold_out`. This trigger fires only when `max_capacity` changes and flips `status` in-place before the row is written.

```sql
CREATE OR REPLACE FUNCTION resync_adventure_sold_out_on_capacity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_confirmed_count integer;
BEGIN
  IF NEW.max_capacity IS NOT DISTINCT FROM OLD.max_capacity THEN
    RETURN NEW;
  END IF;

  -- Staff override wins — capacity changes don't reshape status while
  -- the adventure is manually locked.
  IF NEW.is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM member_adventure_rsvps
  WHERE adventure_id = NEW.id AND status = 'confirmed';

  IF v_confirmed_count >= NEW.max_capacity AND NEW.status = 'published' THEN
    NEW.status := 'sold_out';
  ELSIF v_confirmed_count < NEW.max_capacity AND NEW.status = 'sold_out' THEN
    NEW.status := 'published';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adventures_resync_capacity
  BEFORE UPDATE OF max_capacity ON member_adventures
  FOR EACH ROW EXECUTE FUNCTION resync_adventure_sold_out_on_capacity_change();
```

**Note:** this trigger does *not* reject downsized capacities that go below the current confirmed count. Staff dropping 20 → 10 while 15 are confirmed silently keeps the 15 booked and just flips the visible status to `sold_out`. If you want to reject such changes outright, raise an exception in the same trigger when `v_confirmed_count > NEW.max_capacity`. Deferred for now — the current behavior matches the staff intent of "stop accepting new RSVPs" rather than "evict confirmed members."

### Step 6 — RLS on `member_adventure_rsvps`

```sql
ALTER TABLE member_adventure_rsvps ENABLE ROW LEVEL SECURITY;

-- Member reads RSVPs tied to any of their memberships.
-- `member_id IN (...)` handles the multi-property case where the same
-- auth user is linked to multiple `members` rows.
CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Member can insert an RSVP only against one of their *active* memberships.
-- The capacity trigger enforces the slot limit server-side.
-- The `status = 'active'` filter in the subquery means lapsed/suspended
-- members cannot RSVP without re-activation by staff.
CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (
    auth_role() = 'member'
    AND member_id IN (
      SELECT id FROM members
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- Members do NOT have a FOR UPDATE policy. RLS is row-level — a member
-- update policy would allow changing any column on their own RSVP
-- (guest_count, deposit_payment_intent_id, even member_id) from the
-- browser using just the anon-key Supabase client. Cancellations and
-- any other member-initiated edits go through a Server Action that uses
-- the service role and enforces the column allowlist (typically only
-- `status` may change, and only to `'cancelled'`). The Server Action
-- also handles refund policy and triggers waitlist promotion.

-- Staff reads all RSVPs for their scope
CREATE POLICY "rsvps: admin read all"
  ON member_adventure_rsvps FOR SELECT
  USING (is_admin());

CREATE POLICY "rsvps: property_manager read"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM member_adventures a
      WHERE a.id = adventure_id
        AND a.property_id = auth_property_id()
    )
  );

-- Staff can update RSVPs (waitlist management, manual overrides)
CREATE POLICY "rsvps: staff update"
  ON member_adventure_rsvps FOR UPDATE
  USING (
    is_admin()
    OR (
      auth_role() = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM member_adventures a
        WHERE a.id = adventure_id
          AND a.property_id = auth_property_id()
      )
    )
  );
```

---

## Waitlist Promotion Flow

Waitlist promotion is application logic, not a database constraint. When a confirmed RSVP is cancelled:

1. The member sets their RSVP `status = 'cancelled'` (via the cancellation Server Action — there is no member UPDATE policy).
2. The `sync_adventure_sold_out` trigger fires and may re-open the adventure to `published` (unless `is_manually_sold_out = true`, in which case it skips).
3. An Inngest event fires (`rsvp.cancelled`) triggered by a Supabase Database Webhook on `member_adventure_rsvps`.
4. The Inngest function:
   a. Re-reads the parent adventure. If `is_manually_sold_out = true`, **abort the promotion** — staff have explicitly blocked new confirmations even though capacity arithmetically allows one. The waitlist stays in place; the freed slot is not handed out.
   b. Otherwise, query the next waitlisted RSVP (`ORDER BY created_at ASC`).
   c. Promote it to `confirmed`. The capacity trigger re-validates (safe — the prior cancellation freed the slot, and the manual-sold-out check inside the trigger acts as a belt-and-braces second line of defense if staff flipped the flag between webhook fire and Inngest pickup).
   d. Send the promoted member a "your spot is confirmed" email via Resend.

When staff later toggle `is_manually_sold_out = false`, the waitlist does not auto-drain. Staff manually run an admin action ("promote next from waitlist") or the next RSVP cancellation re-fires the flow. This matches the original product intent: manual sold-out is an explicit human gate.

**Supabase Database Webhook** — Configure in the Supabase dashboard to fire an HTTP POST to the Inngest endpoint when `member_adventure_rsvps.status` changes to `cancelled`. This keeps Inngest as the event router without polling.

---

## Open Questions (from overall plan)

**Q14 — Adventure deposit vs. full payment**

The `deposit_amount` column exists but its behavior is undefined until Q14 is answered:

- If `deposit_amount IS NULL`: charge `price` in full at RSVP time. One Stripe charge, one `deposit_payment_intent_id`.
- If `deposit_amount IS NOT NULL`: charge `deposit_amount` at RSVP time, charge `price - deposit_amount` before the event. Two Stripe charges. An Inngest workflow must fire the balance charge at a configured interval before `start_date`.

Until Q14 is answered, build only the deposit path. The balance payment workflow is a separate Inngest function that can be added without schema changes.

---

## Notes

**`FOR UPDATE` lock is correct here.** The `check_adventure_capacity` trigger uses `SELECT ... FOR UPDATE` on the adventure row. This is a row-level lock — it only blocks other transactions that try to RSVP to the same adventure at the same time. It does not affect reads, other adventures, or any other table. The lock is held for the duration of the RSVP transaction (milliseconds), then released on commit.

**`guest_count` in capacity math.** The capacity check sums `guest_count`, not rows. A member RSVPing for themselves + 3 guests (`guest_count = 4`) consumes 4 slots. This is intentional — the adventure has a people capacity, not an RSVP-count capacity. Ensure the member portal UI makes this clear.

**`sold_out` vs. application-level check.** The `sync_adventure_sold_out` trigger maintains the `sold_out` status automatically. The member portal can query `status = 'published'` to show available adventures without counting RSVPs. This is a performance optimization — the trigger maintains the derived state.

**Member-initiated RSVP edits go through a Server Action, not RLS.** There is no `FOR UPDATE` policy for members on `member_adventure_rsvps` (same reasoning as `members: member update own` in Phase 4 — RLS can't restrict to specific columns). The cancellation Server Action uses the service role to set `status = 'cancelled'`, calls the Stripe API for any refund per cancellation policy (e.g., full refund if `> 30 days before start_date`, no refund if `< 14 days`), and emits the Inngest event that picks up the next waitlisted RSVP.

**Adventure cancellation is a multi-step Server Action, not a DB cascade.** When staff cancels an entire adventure, there is intentionally no trigger that mass-cancels all confirmed RSVPs. Refund decisions are not uniform — staff may want full refunds, partial refunds, or future-credit comps per RSVP — and a blind cascade would leave unrefunded charges on Stripe. The "cancel adventure" admin Server Action walks each non-cancelled RSVP and applies the appropriate refund + cancellation + notification per the staff-selected policy.

**Re-RSVP after cancellation is an UPDATE, not an INSERT.** The `UNIQUE (adventure_id, member_id)` constraint prevents inserting a new row over a cancelled one. To re-join a previously cancelled RSVP, the application UPDATEs the existing row's `status` from `'cancelled'` back to `'confirmed'`. The capacity trigger re-validates because it fires on `UPDATE OF status`. The capacity trigger also covers the `confirmed → confirmed` no-op gracefully because the `id IS DISTINCT FROM NEW.id` check excludes the row from its own count.

**`details jsonb` is unstructured today.** It can carry itinerary, packing list, FAQs, etc. — currently no shape validation (same as Phase 3's `gear_list` / `faq`). Tracked in Deferred Improvements.

**`start_date` and `end_date` are `date`, not `timestamptz`.** An adventure is defined as "the day(s) the event happens," interpreted in the property's timezone. This is sufficient for the multi-day adventures planned here (e.g., "Friday–Sunday weekend"). If an adventure ever needs to be time-precise (e.g., "Saturday 8:00 AM – 4:00 PM"), upgrade to `timestamptz` and add a `property_id`-derived timezone reference like the `bookings` slot validator.

**Pricing semantics — `price` covers the solo member, `guest_price` is the per-extra-guest add-on.** A member RSVP'ing alone (`guest_count = 1`) pays `price`. Each additional guest adds `guest_price` to the total: `price + (guest_count - 1) * COALESCE(guest_price, 0)`. `guest_price` is nullable to support "flat fee covers the party" adventures (treat null as zero). All arithmetic lives in the RSVP Server Action when it creates the Stripe payment intent — not in the DB. Adventure authors choose the model per adventure: flat (guest_price null) or marginal (guest_price set). If a future requirement needs a fundamentally different shape (e.g., per-person pricing with no base fee), introduce a `price_mode` column rather than overloading `price` / `guest_price`. This decision is partly bound to Q14 (deposit vs full payment) and should be confirmed alongside it.

**Manual sold-out is set by staff, not by triggers.** Staff toggle `is_manually_sold_out = true` via the admin UI (or directly in Supabase Studio). The capacity check trigger then rejects new confirmed RSVPs, and both auto-sync triggers (`sync_adventure_sold_out`, `resync_adventure_sold_out_on_capacity_change`) skip status updates so the visible `status` stays whatever it was at the moment the flag was set. The member portal must compute the effective sold-out state as `status = 'sold_out' OR is_manually_sold_out = true` — relying on `status` alone will miss the manual case. When staff toggle the flag back to `false`, the next RSVP write naturally re-syncs `status` from current capacity via `sync_adventure_sold_out` (which runs on every RSVP insert/update). If there are no RSVP writes after the unflip, the status may stay stale until one arrives — acceptable, because no member-visible state is wrong (status = sold_out + manual=false still reads as sold-out to the application, and the next RSVP attempt will trigger the resync).

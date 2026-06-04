# App 4 — Member Portal (Implementation Plan)

**Status:** 🔄 4.0 (login), 4.1 (my bookings), 4.1b (booking detail) landed. **4.2 (adventures listing) + 4.3 (RSVP) code complete 2026-06-03 — verification (dev-server walkthrough + manual H/I) pending.** 4.5 (shareable trip link) not started · **Drafted:** 2026-05-30 · **Last updated:** 2026-06-03

> **2026-06-03 build note (4.2 + 4.3).** Decisions resolved with the user: (1) the reference cards' extra display fields — category/eyebrow, destination `location` (distinct from `property_id`, the owning club), `durationLabel` — live in `member_adventures.details` jsonb, read via a typed tolerant `AdventureDetails` parser (no ALTER migration; promote to columns when the App 3 adventures-editor is built). `details` also carries optional display overrides (`datesLabel`/`priceLabel`/`capacityLabel`/`badge`/`comingSoon`) used where a NOT NULL column can't express a reference state. (2) Seeded all five reference adventures (`supabase/migrations/20260603160000_seed_placeholder_adventures.sql`, all on `horseshoe-bay`, each `details.placeholder=true` for one-query cleanup). (3) Built listing + RSVP. **Capacity correction:** under member RLS the embedded rsvps are only the caller's own, so precise "spots remaining" can't be derived on the member surface — sold-out comes from the `status` column + `is_manually_sold_out`, and any human count comes from `details.capacityLabel`. New files: `src/services/members/adventures.ts`, `src/services/members/rsvps.ts`, `app/member/adventures/{page,actions}.ts(x)`, `src/components/members/{adventures-list,adventure-card,rsvp-form}.tsx`, plus `formatDateRange` in `src/services/public/format.ts`. No new RLS policies/helpers (Phase 7 doc unchanged). `member-nav.tsx` already had the Adventures tab. `tsc --noEmit` clean.

The `/login` surface, `/auth/callback`, middleware portal allowlist, and the household-visibility stub on `/member` all landed in App 1 / earlier App 4 work. This plan covers the remaining three surfaces that turn `/member` from a sign-in landing page into the member-facing product: **my bookings**, **adventures listing**, and **RSVP**.

Two non-negotiable contracts shape everything below:

1. **Components take data as props.** No `auth.uid()`-scoped query inside a component. The wrapping page fetches with the right scope and passes rows in. This is what makes App 3 sub-phase 3.8 (`/admin/members/[id]/preview`) re-render the same React tree against admin-RLS-scoped data without forking the components.
2. **SOLID, especially Single Responsibility + Dependency Inversion.** Services receive their Supabase client as a parameter, return clean domain types, never raw PostgREST shapes. Server Actions are thin: validate input → call service → return result.

---

## Why three surfaces, in this order

- **My bookings first** — the most-asked-for member feature ("when am I shooting next?"). All data is already in `bookings`; member RLS is already in place (`member_user_id = auth.uid()`). Zero schema work for the auth-user-only view.
- **Adventures listing second** — the second member-facing product (curated 3rd-party trips). Schema and RLS already in place (`current_member_active_property_ids()`). Read-only surface, low risk to land.
- **RSVP last** — the only place a member directly writes through RLS. Adds a Server Action with a row-locked capacity trigger downstream. Builds on the listing surface.

Why this order: each surface raises the risk envelope by one notch (read auth-user-only → read property-scoped → write with capacity race). Landing them in order lets each verify the data contract before the next builds on it.

---

## Scope

**In scope (App 4):**

- `/member/bookings` page + `<MyBookingsList>` component + `getMyBookings()` service
- `/member/adventures` page + `<AdventuresList>` component + `getAdventuresForMember()` service
- RSVP UI (inline reserve form on the adventures list) + `createRsvp` Server Action + `createMemberRsvp()` service
- Member navigation update — the existing `/member` page gets a header link strip pointing at Bookings + Adventures
- `/dev` dashboard adds: "create test adventure at property X" + "force-RSVP membership Y" actions, so the listing + RSVP paths can be exercised without prod seed data
- Manual test pack additions in `docs/manual-testing.md` (scenarios G — my bookings, H — adventures list, I — RSVP happy path + capacity collision)

**Out of scope:**

- RSVP cancellation UI (deferred — needs Q14 cancellation/refund policy; cancellation Server Action exists at the schema layer but no member-facing button until Q14)
- RSVP payment (deferred — Q14 unanswered; v1 RSVPs hold the spot, no charge)
- Waitlist promotion UI (waitlist itself is supported; Inngest promoter is App 9 W-something blocked on Q15-adjacent)
- Adventure detail page route (`/member/adventures/[id]`) — only add if `description` content demands it; v1 fits in cards
- Tier-aware pricing or copy — blocked on Q9, no membership tier vocabulary yet
- Observability (Sentry / Axiom) — App 10, deferred until pre-1.0 launch
- App 3 sub-phase 3.8 (`/admin/members/[id]/preview`) — downstream consumer; built once App 4 lands

---

## Existing surface (don't rebuild)

```
app/member/page.tsx                                  Household-visibility stub:
                                                     identity strip + memberships list.
                                                     Becomes the "home" tab; navigation
                                                     strip is added here.

src/components/members/member-header.tsx             Identity + sign-out. Reused as-is.
src/components/members/membership-card.tsx           One card per active membership.
                                                     Reused as-is.

src/services/members/memberships.ts                  getMyMemberships(client, email) →
                                                     MembershipForMember[]. Reused as-is.
```

Existing RLS helpers (Phase 7) we lean on without modification:

- `current_person_id()` — auth user → `people.id`
- `current_member_active_property_ids()` — `SETOF uuid` of property_ids where caller has an active membership. Powers the adventures filter.
- `current_member_membership_ids()` — `SETOF uuid` of membership_ids (any status). Powers RSVP read.
- `current_member_active_membership_ids()` — strict active. Powers RSVP insert (RLS already enforces).
- `current_household_person_ids()` — household visibility on `people`. Reused inside the new bookings helper (see sub-phase 4.1 below).

**One new helper + one new policy proposed in sub-phase 4.1** — household-visible bookings need `current_household_user_ids()` (SECURITY DEFINER, returns `SETOF uuid` of `auth.users.id`) plus an updated `bookings: member read own` policy. Details in sub-phase 4.1.

Tables we read (no other schema changes proposed for sub-phases 4.1 / 4.2 / 4.3):

- `bookings` — `bookings.member_user_id = auth.uid()` already RLS-allowed
- `bids` — `bids.booking_id` join, RLS already allows member read via `member_user_id` → `bookings`
- `properties` — anon-readable; joins for property name on bookings + adventures
- `member_adventures` — RLS already allows member read at active-property scope
- `member_adventure_rsvps` — RLS already allows member read via `current_member_membership_ids()` and insert via `current_member_active_membership_ids()`

---

## Sub-phase plan

### Sub-phase 4.1 — My bookings + household visibility (🔲 not started)

**Goal:** `/member/bookings` lists every booking made by anyone on any membership the signed-in member shares. Card per booking with date/time, property, booking type, status, instructor (if any), price summary, **who booked it** (so spouse sees "booked by John" on John's lessons), and a "view bid" link when the bid hasn't been finalized.

**Migration (one new file):**

```
supabase/migrations/<ts>_household_visible_bookings.sql
```

Contents:

1. New helper — `current_household_user_ids()` SECURITY DEFINER, STABLE, SET search_path = public.

   ```sql
   CREATE OR REPLACE FUNCTION current_household_user_ids()
   RETURNS SETOF uuid
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public
   AS $$
     SELECT DISTINCT p.user_id
     FROM people p
     WHERE p.id IN (SELECT current_household_person_ids())
       AND p.user_id IS NOT NULL;
   $$;

   REVOKE ALL ON FUNCTION current_household_user_ids() FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION current_household_user_ids() TO authenticated;
   ```

2. Replace the existing `bookings: member read own` policy with a household-scoped variant:

   ```sql
   DROP POLICY "bookings: member read own" ON bookings;

   CREATE POLICY "bookings: member household read"
     ON bookings FOR SELECT
     USING (
       auth_role() = 'member'
       AND member_user_id IN (SELECT current_household_user_ids())
     );
   ```

**RLS cycle audit** (mandatory per CLAUDE.md before any new policy):

- `current_household_user_ids()` reads `people` and `current_household_person_ids()`.
- `current_household_person_ids()` reads `membership_people` and `memberships`.
- The new `bookings` policy calls the helper (opaque to planner — no dependency arrow added).
- Neither `people`, `membership_people`, `memberships`, nor any of their policies reference `bookings`. No cycle.

**Phase 7 RLS reference doc gets a same-commit update** — §4.2 (member-access selectors table) gains the new helper row; §7.5 (`bookings`) policy listing replaces the old member-read policy with the household variant; §10 changelog gets a new entry. Maintenance rule per CLAUDE.md.

**Files (new):**

**Files (new):**

```
app/member/bookings/
  page.tsx                                  Thin orchestrator — fetch via service, render component
src/components/members/
  my-bookings-list.tsx                      Pure presentational: props = MemberBookingRow[]
  my-booking-card.tsx                       One booking card (extracted so 4.2 can borrow the visual)
src/services/members/
  bookings.ts                               getMyBookings(client) →
                                            { data: MemberBookingRow[] | null, error: { message } | null }
                                            — RLS scopes to the caller's household via the new helper.
                                            getBookingsForMember(client, userIds: string[]) — explicit-scope
                                            variant for App 3.8 preview-as-member under admin RLS.
src/components/members/
  member-nav.tsx                            Tab strip (Home / Bookings / Adventures). Mounted from
                                            the existing /member page header and from each new page
                                            so navigation feels stitched without a layout rewrite
```

**Files (modified):**

```
app/member/page.tsx                         Mount <MemberNav /> in the header position
TRACKER.md                                  Flip App 4 row → "4.1 landed" once verified
```

**Domain type:**

```ts
export interface MemberBookingRow {
  id: string;
  startAt: string;                      // ISO timestamptz from bookings.event_start_at
  endAt: string;
  property: { name: string; slug: string };
  bookingType: BookingType;             // 'plan_a_visit' | 'private_lesson' | 'host_an_occasion'
  status: BookingStatus;                // existing booking_status_enum
  guestCount: number;
  bookedBy: { firstName: string; lastName: string } | null;  // who on the household made it
  isMine: boolean;                      // bookings.member_user_id === current auth user
  instructor: { firstName: string; lastName: string } | null;
  bid: {                                // null if booking has no bid (rare; admin-created)
    slug: string;
    status: BidStatus;                  // 'awaiting_guest' | 'confirmed' | ... | 'cancelled' | 'expired'
    // v1 has no `path` — the public bid page needs the plaintext access code
    // (stored only as bcrypt) which the member doesn't have on hand. Members
    // click through from email for now. A member-authed /member/bids/[id]
    // route is future work (4.5 or App 7-adjacent).
  } | null;
  pricing: {
    quotedTotal: number;
    depositAmount: number | null;
    amountPaid: number | null;
  };
}
```

**Service shape (DI: client + scope as parameters, no `auth.uid()` inside):**

```ts
// src/services/members/bookings.ts

export async function getMyBookings(
  client: SupabaseClient,
  currentUserId: string,
): Promise<{ data: MemberBookingRow[] | null; error: { message: string } | null }> {
  // RLS does the household scoping via current_household_user_ids().
  // No .in() filter — the new policy returns the union for us.
  // We still pass currentUserId so the service can stamp isMine on each row.
  const { data, error } = await client
    .from("bookings")
    .select("..., properties(name, slug), instructors(first_name, last_name), bids(slug, status, access_code_hash), booker:people!bookings_member_user_fkey(first_name, last_name)")
    .order("event_start_at", { ascending: false });
  // ...normalize PostgREST embeds; stamp isMine = (row.member_user_id === currentUserId).
}

export async function getBookingsForMember(
  client: SupabaseClient,
  userIds: string[],
): Promise<{ data: MemberBookingRow[] | null; error: { message: string } | null }> {
  // Explicit-scope variant for App 3.8 preview-as-member.
  // Admin RLS allows reading every booking; this filter narrows to the
  // target member's household by user_id list (resolved upstream).
  // .in('member_user_id', userIds) — admin RLS doesn't auto-narrow.
}
```

The dual-entry shape is what makes App 3.8 work:

```tsx
// app/member/bookings/page.tsx
const { data: { user } } = await supabase.auth.getUser();
const { data: bookings } = await getMyBookings(supabase, user!.id);
return <MyBookingsList bookings={bookings ?? []} />;

// app/admin/members/[id]/preview/page.tsx  (App 3.8 — later)
const userIds = await getAuthUserIdsForMember(supabase, params.id);
const { data: bookings } = await getBookingsForMember(supabase, userIds);
return <MyBookingsList bookings={bookings ?? []} />;
```

**Note on `booker` embed:** `bookings.member_user_id` is `auth.users.id`. To get the booker's display name we need to join through `people.user_id`. PostgREST embed syntax is `booker:people!bookings_member_user_fkey(...)` — but there is no FK between `bookings.member_user_id` and `people.user_id` today (the booking schema stamps the auth user directly). Two options for v1:

- **(a)** Add an FK in the same migration: `bookings.member_user_id REFERENCES people(user_id)`. Clean, lets PostgREST embed. But `people.user_id` would need to be UNIQUE (it is, per the Phase 4 split).
- **(b)** Two queries: first the bookings list, then a `.in('user_id', userIdSet)` lookup on `people`, joined in the service. Simpler — no FK to add — but two round-trips.

Recommend **(b)** for v1 — keeps the migration small (one helper + one policy, no FK). Revisit if perf shows up as an issue.

**Edge cases handled:**

- Empty state — friendly "no upcoming experiences" copy plus a link back to the public booking flow
- Cancelled / expired bookings — visually de-emphasized; not hidden (members ask about historical bookings)
- Pricing fields missing on partially-built bookings — render as "—", not "$0"
- Bid link is omitted (not just disabled) when bid status is in `('signed' || 'paid' || 'cancelled' || 'expired')` — `bid.path` is `null` in those cases so the component doesn't need branching logic
- Spouse's bookings show `isMine = false` and a "booked by John" attribution line; "view bid" link is hidden for not-mine bookings (the bid access code is the booker's, not the spouse's)

**RLS interaction:** one new SECURITY DEFINER helper (`current_household_user_ids()`) + replacement of the `bookings: member read own` policy with a household-scoped variant. Detailed above under "Migration."

### Sub-phase 4.2 — Adventures listing (✅ code complete 2026-06-03 — see build note at top)

**Goal:** `/member/adventures` lists every published or sold-out adventure at any of the member's active properties. Card per adventure with title, date range, property, price (solo + per-guest add-on), capacity remaining, sold-out badge, and a "Reserve" CTA that opens the inline RSVP form (sub-phase 4.3).

**Files (new):**

```
app/member/adventures/
  page.tsx                                  Thin orchestrator
src/components/members/
  adventures-list.tsx                       Pure presentational: props = AdventureForMember[]
  adventure-card.tsx                        One adventure card with reserve CTA
src/services/members/
  adventures.ts                             getMyAdventures(client) →
                                            { data: AdventureForMember[] | null, error }
                                            getAdventuresForMember(client, propertyIds, membershipIds)
                                            — the prop-driven variant for App 3.8 preview
```

**Domain type:**

```ts
export interface AdventureForMember {
  id: string;
  title: string;
  description: string | null;
  startDate: string;                    // date, ISO string
  endDate: string;
  property: { name: string; slug: string };
  pricing: {
    soloPrice: number;                  // member.price (guest_count = 1)
    perGuestAddOn: number | null;       // member.guest_price; null = flat-rate party
    maxGuestsPerRsvp: number;
  };
  capacity: {
    max: number;
    remaining: number;                  // computed: max - sum(confirmed.guest_count)
    isSoldOut: boolean;                 // true if status='sold_out' OR is_manually_sold_out
  };
  myRsvp: {                             // null if this membership hasn't RSVP'd yet
    id: string;
    status: RsvpStatus;
    guestCount: number;
    membershipId: string;
  } | null;
}
```

**Service shape:**

```ts
// src/services/members/adventures.ts

export async function getMyAdventures(
  client: SupabaseClient,
): Promise<{ data: AdventureForMember[] | null; error: { message: string } | null }> {
  // RLS handles scope. Single PostgREST query with:
  //   from('member_adventures')
  //   .select('..., member_adventure_rsvps(id, status, guest_count, membership_id)')
  //   .in('status', ['published', 'sold_out'])
  //   .order('start_date')
  // The inner rsvps join inherits RLS — only the caller's own RSVPs
  // come back. For App 3.8 preview, the admin-scoped query path is
  // getAdventuresForMember(client, propertyIds, membershipIds) which
  // explicitly filters since the admin sees ALL adventures + ALL rsvps.
}
```

**Edge cases handled:**

- `is_manually_sold_out` AND `status='published'` — UI treats as sold-out (matches the trigger semantics doc)
- Capacity remaining when status flips during render — accept the staleness; the RSVP server action is the authoritative gate via the row-locked trigger
- Member with active memberships at two properties — adventures from both properties interleaved, sorted by date; each card shows the property name so it's not confusing
- Past adventures (start_date < today) — hidden from member view; the existing `status='completed'` filter on the RLS side handles most cases, but we also `.gte('start_date', today)` to belt-and-suspenders
- Member already RSVP'd — card shows "You're going" badge + guest count; the Reserve CTA is replaced by a "Cancel" button only if Q14 lands (otherwise the badge is read-only)

**RLS interaction:** zero new policies needed. Existing `adventures: member read published` + `rsvps: member read own` cover it. The PostgREST join works because RLS applies per row on each table.

### Sub-phase 4.1b — Booking detail page (✅ landed 2026-05-30)

**Goal:** `/member/bookings/[id]` — full read-only detail of one booking. Lets a member (or any household member on the same booking) see the trip info the staff assembled: schedule notes, gear list, FAQ, disciplines + add-ons, pricing summary.

**Migration:** `supabase/migrations/20260530160000_household_visible_booking_children.sql` — replaces `bids: member read own`, `booking_disciplines: member read own`, and `booking_add_ons: member read own` policies with `... member household read` variants. Same `current_household_user_ids()` opaque-helper pattern as the bookings policy → no RLS cycle. Phase 7 RLS doc updated in the same commit.

**Files (new):**

```
app/member/bookings/[id]/page.tsx              Thin orchestrator — fetch via service, render component
src/services/members/booking-detail.ts         getMyBookingDetail(client, bookingId, currentUserId)
                                               Tolerant gear_list + faq jsonb parsing
src/components/members/booking-detail-view.tsx Pure presentational composition:
                                               summary / schedule notes / disciplines + add-ons /
                                               gear list / FAQ / pricing
```

**Files (modified):**

```
src/components/members/my-bookings-list.tsx    Cards wrapped in <Link> to /member/bookings/[id]
plan/supabase/phase-7-rls.md                   §7.5 + §7.6 + §10 updated
```

**Sign + pay is out of scope** for this sub-phase. The detail page is read-only — to sign the waiver or pay the deposit, the member uses the email link with the access code (the public `/bids/<slug>/<code>` surface). A member-authed signing surface is future work; see sub-phase 4.5 below for a related but separate shareable-link feature.

**Edge cases handled:**

- Booking id doesn't exist OR RLS hides it → 404 via `notFound()`.
- Bid is null (admin-created booking without bid) → bid sections silently omit, summary + disciplines + pricing still render.
- Spouse-viewed booking → "Booked by [primary]" attribution surfaces in the summary.
- `gear_list` / `faq` jsonb has unexpected shape (operator typo in admin UI) → parser tolerates strings + objects, filters junk; never throws.

### Sub-phase 4.3 — RSVP (✅ code complete 2026-06-03 — see build note at top)

**Goal:** Click "Reserve" on an adventure → inline form picks guest count (capped at `max_guests_per_rsvp`) → submit → Server Action inserts into `member_adventure_rsvps` → adventure card re-renders with the "You're going" state.

**Files (new):**

```
src/components/members/
  rsvp-form.tsx                             Client component — guest count stepper + submit
src/services/members/
  rsvps.ts                                  createMemberRsvp(client, args) → service
                                            cancelMemberRsvp(...) — STUB ONLY (Q14 blocks UI)
app/member/adventures/
  actions.ts                                'use server' — createRsvpAction({ adventureId,
                                            membershipId, guestCount }) → calls service,
                                            revalidatePath('/member/adventures')
```

**Server action shape (thin: validate → call service → return result):**

```ts
// app/member/adventures/actions.ts
"use server";

const RsvpInputSchema = z.object({
  adventureId: z.string().uuid(),
  membershipId: z.string().uuid(),
  guestCount: z.number().int().positive(),
});

export async function createRsvpAction(input: z.infer<typeof RsvpInputSchema>) {
  const parsed = RsvpInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const supabase = await createServerSupabaseClient();
  const result = await createMemberRsvp(supabase, parsed.data);

  if (result.ok) revalidatePath("/member/adventures");
  return result;
}
```

**Service shape:**

```ts
// src/services/members/rsvps.ts

export interface CreateRsvpArgs {
  adventureId: string;
  membershipId: string;       // explicit — the page knows which membership applies (matches adventure.property_id)
  guestCount: number;
}

export type CreateRsvpResult =
  | { ok: true; rsvp: { id: string; status: RsvpStatus } }
  | { ok: false; error: "capacity" | "manually-sold-out" | "guest-cap" | "duplicate" | "rls" | "unknown"; message: string };

export async function createMemberRsvp(
  client: SupabaseClient,
  args: CreateRsvpArgs,
): Promise<CreateRsvpResult> {
  // Single insert. The capacity trigger does the row-locked enforcement;
  // RLS enforces "membership_id must be in current_member_active_membership_ids()".
  // Map Postgres exception messages → our discriminated error codes so
  // the UI can show specific feedback ("this adventure just filled up"
  // vs. "you've already RSVP'd").
  const { data, error } = await client
    .from("member_adventure_rsvps")
    .insert({
      adventure_id: args.adventureId,
      membership_id: args.membershipId,
      created_by_person_id: ... ,           // pulled via current_person_id() — see "open question" below
      guest_count: args.guestCount,
      status: "confirmed",                  // trigger may reject + caller can retry with 'waitlisted'
    })
    .select("id, status")
    .single();

  // Translate err.message → discriminated CreateRsvpResult error code.
}
```

**Open implementation question — `created_by_person_id` source:**

The column is nullable, but every member-portal RSVP should stamp it for audit. Two options:

- **(a)** Service calls `client.rpc('current_person_id')` first, passes the result into the insert. One extra round-trip; explicit; works against any client.
- **(b)** Add a small SQL helper or a `DEFAULT` expression so the column auto-populates when the inserter is a member. Cheaper at runtime; requires a migration.

Recommend **(a)** for v1 — no migration, the round-trip is negligible (Edge function to same Postgres), and the explicitness matches the rest of our SECURITY DEFINER usage.

**Edge cases handled:**

- Member has multiple memberships at the adventure's property (unusual but possible) — the page's `myMemberships` lookup picks the **first active one at that property_id**. If we ever see this in the wild we'll add a picker; flagging it as a known-narrow case.
- Capacity race — trigger handles it. UI shows "this adventure just filled up — would you like to join the waitlist?" with a one-click retry that resubmits with `status='waitlisted'` (a follow-up insert; we don't currently support that path through the same action, so v1 just says "this filled up" and a refresh shows the sold-out state).
- Member tries to RSVP under a lapsed membership — RLS rejects the insert (the `current_member_active_membership_ids()` WITH CHECK fails). UI shows "this membership isn't active anymore."
- Double-submit — UNIQUE `(adventure_id, membership_id)` rejects; mapped to `"duplicate"` and shown as "You've already reserved this experience."

**RLS interaction:** zero new policies. The existing `rsvps: member insert own` + capacity trigger cover the write path.

### Sub-phase 4.5 — Shareable trip link (🔲 not started — planned only)

**Goal:** Once a booking is finalized (signed + paid), the booker can generate a shareable link they can send to other people on the trip — even non-members. The link renders a trimmed trip overview: dates, property, instructor, gear list, FAQ, schedule notes. It explicitly does NOT show pricing, deposit/payment amounts, payment intents, guest contact info, bid status, or the access code.

**Why a separate sub-phase:** the detail page in 4.1b is for household members under RLS. This is broader — it's an unauthenticated link a member chooses to mint and pass around. Different audience, different threat model.

**Mechanism — proposed:**

1. New `bookings.share_token text` column with a partial UNIQUE index on `WHERE share_token IS NOT NULL`. Token = 32 random bytes base64url-encoded (same shape as the bid access code, different purpose).
2. Token is **not generated at booking time** — it's minted on demand via a Server Action when the booker clicks "Share trip details" on `/member/bookings/[id]`. Mint is idempotent: clicking twice returns the existing token, so re-sharing doesn't invalidate prior links.
3. New route `/trip/<token>/page.tsx` — anon-readable, fetches via service role with an explicit allowlist projection (date, property, instructor.name, schedule_notes, gear_list, faq, disciplines.serviceName — no IDs that would let a recipient back into the API). Returns 404 for unknown tokens or finalized=false bookings.
4. `share_token` only resolves to a payload when `bids.signed_at IS NOT NULL AND bookings.amount_paid >= bookings.deposit_amount` (the "finalized" gate). Pre-finalize, the route returns 404 so a member can't pre-share an unconfirmed trip.
5. Revoke action — a "Revoke share link" button on the detail page sets `share_token = NULL`. New mints get a fresh token.

**Files (when built):**

```
supabase/migrations/<ts>_booking_share_token.sql                   share_token column + partial UNIQUE
app/trip/[token]/page.tsx                                          Anon-readable trip view
app/member/bookings/[id]/share/actions.ts                          mintShareLink, revokeShareLink
src/components/members/share-trip-card.tsx                         "Share trip details" UI on the detail page
src/services/public/shared-trip.ts                                 getSharedTrip(token) — service-role
                                                                   projection with the allowlist
src/components/public/shared-trip-view.tsx                         Pure presentational (reuses booking-detail
                                                                   sections minus pricing)
```

**Threat model considerations:**

- Token is opaque + random; no enumeration. Brute force is 32-byte search space.
- Token has no expiry today (link works as long as the booking exists + share_token is set). Add expiry later if abuse shows up.
- Revoke is instant — invalidates all prior shares.
- Token confers READ only; no actions on the trip from the shared link.
- Booker can revoke; admin can revoke through the admin portal (App 3-side feature).
- No analytics today; if recipient tracking matters later, add a `last_viewed_at` column.

**Open questions to confirm at build time:**

- Should the shared view be brandable as "Rhythm Outdoors" or as the property (e.g. "Horseshoe Bay")? Recommend property brand — matches the host's identity.
- Should we allow the booker to attach a personal note ("Hey, here's our trip — meet at the lodge")? Recommend a small free-text `share_note` column on bookings; capped at 500 chars.
- Should the shared trip include the booker's name? Recommend yes ("Hosted by John Foo") so recipients know who to contact.

**Blocked on:** nothing. Could be built alongside or after 4.2/4.3. Estimated scope: one migration, one route + page, one Server Action file, two new components, ~1 day of work.

---

## Decisions locked in

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Data flow | Pages fetch + pass data; components are pure. | Required for App 3.8 (`/admin/members/[id]/preview`) component reuse. SOLID (Dependency Inversion). |
| 2 | Service entry shape | Every service has a `getMyX(client)` wrapper around a `getXForMember(client, scope)` core. | Same component, two callers (member self, admin preview). The wrapper resolves identity; the core takes explicit IDs. |
| 3 | Household-visible bookings | **Bundle into 4.1.** Adds `current_household_user_ids()` SECURITY DEFINER helper + replaces `bookings: member read own` policy with a household variant. Phase 7 RLS doc updated in the same commit. | Spouse-coordinates-with-spouse is a real use case; deferring would leave 4.1 incomplete vs. the handoff spec. Migration is small and the RLS-cycle audit is clean (helper is opaque; no table touches `bookings`). |
| 4 | RSVP UX | Inline reserve form on the adventures list. No detail route. | Simplest path that covers the v1 requirement. Add `/member/adventures/[id]` only if description content demands it. |
| 5 | RSVP payment | None at v1 — RSVP holds the spot, no charge collected. | Q14 blocks the payment policy. The schema supports `deposit_payment_intent_id` for the day Q14 lands; until then the column stays NULL. |
| 6 | RSVP cancellation | Not in UI for v1. | Q14 blocks the policy. Schema + service stub exist for the day Q14 lands; member-portal button is hidden behind a feature flag (`features.rsvpCancellation = false` until then). |
| 7 | `created_by_person_id` source | `client.rpc('current_person_id')` from the service, not a column DEFAULT. | No new migration. Explicit. Matches existing SECURITY DEFINER usage pattern. |
| 8 | Navigation | A `<MemberNav>` tab strip mounted on each member page (`/member`, `/member/bookings`, `/member/adventures`), not a shared `app/member/layout.tsx`. | Avoids spreading server-fetched layout data across pages; each page stays self-contained. Layout refactor is on the table once nav grows past three tabs. |
| 9 | Tier-aware copy | Skipped entirely. | Q9 unanswered. `MembershipForMember.membershipTier` is already displayed where present; no new tier-conditional logic. |
| 10 | Status of cancelled / expired bookings | Visible, visually de-emphasized; not hidden. | Members ask about historical bookings ("did I cancel that one?"). Hiding creates a "where did it go" support load. |

---

## File layout summary (new files only)

```
supabase/migrations/
  <ts>_household_visible_bookings.sql                   [4.1] new helper + bookings policy

app/member/
  bookings/page.tsx                                     [4.1]
  adventures/
    page.tsx                                            [4.2]
    actions.ts                                          [4.3]

src/components/members/
  member-nav.tsx                                        [4.1]
  my-bookings-list.tsx                                  [4.1]
  my-booking-card.tsx                                   [4.1]
  adventures-list.tsx                                   [4.2]
  adventure-card.tsx                                    [4.2]
  rsvp-form.tsx                                         [4.3]

src/services/members/
  bookings.ts                                           [4.1]
  adventures.ts                                         [4.2]
  rsvps.ts                                              [4.3]
```

Modified files:

```
app/member/page.tsx                                     [4.1] Add <MemberNav />
app/dev/...                                             [4.1/4.2/4.3] Test-data helpers
plan/supabase/phase-7-rls.md                            [4.1] §4.2 + §7.5 + §10 changelog
TRACKER.md                                              [each sub-phase completion]
docs/manual-testing.md                                  [4.1/4.2/4.3 — scenarios G/H/I]
```

---

## Test pack

| # | Sub-phase | Scenario | Steps |
|---|---|---|---|
| G1 | 4.1 | Member sees only their own bookings | Sign in as member with 1 booking; `/member/bookings` lists exactly 1 row. Sign in as a member with 0 bookings; empty state renders. |
| G2 | 4.1 | Cross-property member sees both properties' bookings | Member with active memberships at HBSC + Hog Heaven, 1 booking at each; `/member/bookings` lists both, with property names. |
| G3 | 4.1 | Household-visible bookings | Spouse A and spouse B on shared HBSC membership. A books a private lesson; both A and B see the row on `/member/bookings`. A's row shows `isMine=true` (no attribution line); B's row shows `bookedBy: A`. |
| G4 | 4.1 | RLS still rejects cross-household reads | Verified via SQL editor with claim impersonation — `SELECT * FROM bookings` as member X returns X's household, NOT member Y's household. |
| G5 | 4.1 | Bid link is hidden post-finalization AND for not-mine bookings | Booking with bid status='signed' shows no "view bid" link. Spouse-booked row also shows no "view bid" link (bid access code is the booker's). |
| H1 | 4.2 | Member sees adventures at their active properties only | Member at HBSC sees HBSC adventures; not Hog Heaven adventures. Cross-property member sees both. |
| H2 | 4.2 | Draft and completed adventures hidden | Adventure in draft status not visible; one in completed status not visible. |
| H3 | 4.2 | Manual sold-out renders sold-out | `is_manually_sold_out=true` adventure shows sold-out badge + no Reserve CTA. |
| H4 | 4.2 | Existing RSVP shows "You're going" | Member with an existing 'confirmed' RSVP sees the You're going state, not the Reserve CTA. |
| I1 | 4.3 | Happy-path RSVP | Member RSVPs to a published adventure with guest_count=2; row appears in `member_adventure_rsvps`; card updates to "You're going." |
| I2 | 4.3 | Per-RSVP guest cap rejection | Try to RSVP with guest_count > max_guests_per_rsvp; service returns `error: "guest-cap"`; UI shows specific copy. |
| I3 | 4.3 | Manual sold-out blocks new confirmed | Manually-sold-out adventure → try to RSVP; trigger rejects; service returns `error: "manually-sold-out"`; UI offers waitlist (deferred — v1 just shows "this adventure just filled up"). |
| I4 | 4.3 | Capacity race | Two browsers, last spot. Both submit at the same time. One succeeds, one returns `error: "capacity"`. |
| I5 | 4.3 | RLS rejects lapsed-membership RSVP | Member with status='lapsed' tries to RSVP; insert fails the WITH CHECK; UI shows lapsed copy. |
| I6 | 4.3 | Double-RSVP rejection | Member RSVPs twice; second insert hits the UNIQUE; service returns `error: "duplicate"`. |

All G/H/I scenarios added to `docs/manual-testing.md` as we land each sub-phase.

---

## Open questions to surface (not blocking)

| Q | Status | Workaround for v1 |
|---|---|---|
| Q9 — Membership tier vocabulary | Unanswered | Skip tier-aware UI; show existing `membership_tier` text where present. |
| Q14 — RSVP payment + cancellation policy | Unanswered | RSVP holds the spot, no payment, no cancel button. Schema supports both; UI gated behind a future flag. |
| Q15 — Pre-event email cadence | Unanswered | Orthogonal — handled by App 9 W3 when answered. Not a member-portal concern. |
| Internal — App 3.8 (`/admin/members/[id]/preview`) reuse | Confirmed | The dual-entry service pattern (`getMyX` + `getXForMember`) is the contract. App 3.8 imports the same components and calls the explicit-scope variant. |

---

## Verification protocol per sub-phase

Same shape as App 9's sub-phase wrap:

1. `npx tsc --noEmit` clean.
2. Manual scenarios (G / H / I as appropriate) run locally with `/dev`-seeded data.
3. Ask user to verify locally before flipping the TRACKER row.
4. Update TRACKER App 4 row with "4.x landed" + brief notes (mirror the App 9 row's style).
5. Commit per sub-phase, not per file.

After 4.3 lands the user should be able to: log in as a member at `/login`, land on `/member`, navigate to `/member/bookings` and see their bookings, navigate to `/member/adventures` and reserve a spot, return to the adventure card and see the "You're going" state.

That is the App 4 done line.

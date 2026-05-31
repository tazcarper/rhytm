# Bid Content Library — FAQ & Gear Templates

**Status:** Planned (not yet implemented)
**Date:** 2026-05-31

## Problem

Bids reuse the same FAQ and gear list across the same kind of event (same
discipline, same location). Today an admin hand-writes each one into the bid's
`faq` / `gear_list` JSONB. We want reusable content that auto-applies based on a
booking's **property**, its **disciplines** (services), and its **booking type**,
manageable by admins, and auto-filled onto new bids while staying fully editable.

## Core principle — snapshot, not reference

Bids store `gear_list` and `faq` as JSONB **snapshots** on the bid row. That stays.
The library is a **source we copy from at compose time**, never a live reference.
Editing a template later must NEVER mutate an already-composed bid (same reasoning
as the frozen `guest_name` snapshot). This preserves the single-read guest page and
historical integrity of signed bids.

## The three axes (already in the schema)

- **Location** = `properties` (Horseshoe Bay / Hog Heaven / Packsaddle)
- **Discipline** = `services` (per-property rows, e.g. "Sporting Clays"), selected
  per booking via `booking_disciplines`
- **Booking type** = `booking_type` enum (plan_a_visit / private_lesson / host_an_occasion)

A bid's booking has one property, N disciplines, one booking type — all the resolver needs.

## Schema — two parallel structures (SOLID-purist, no shared sparse table)

Each kind owns typed columns. No `kind` discriminator, no nullable `payload`.

```sql
-- FAQ library
create table bid_faq_templates (
  id            uuid primary key default gen_random_uuid(),
  question      text not null,
  answer        text not null,
  dedupe_key    text not null,          -- e.g. 'cancellation-policy'
  display_order int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table bid_faq_template_scopes (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references bid_faq_templates(id) on delete cascade,
  scope_type   text not null check (scope_type in ('global','property','service','booking_type')),
  property_id  uuid references properties(id),
  service_id   uuid references services(id),
  booking_type booking_type_enum
  -- CHECK: exactly the column matching scope_type is non-null, others null
);

-- Gear library — own clean columns, own scope table
create table bid_gear_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  dedupe_key    text not null,
  display_order int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table bid_gear_template_scopes (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references bid_gear_templates(id) on delete cascade,
  scope_type   text not null check (scope_type in ('global','property','service','booking_type')),
  property_id  uuid references properties(id),
  service_id   uuid references services(id),
  booking_type booking_type_enum
  -- CHECK: exactly the column matching scope_type is non-null, others null
);
```

## Resolution logic (dedupe + override)

A template **matches** a booking if it has *any* scope row that is:
- `global`, OR
- `property` AND `property_id = booking.property_id`, OR
- `service` AND `service_id` ∈ booking's discipline ids, OR
- `booking_type` AND `booking_type = booking.booking_type`

Union all matches (per kind), then **dedupe by `dedupe_key`**, keeping the most
specific scope:

> precedence `service (3) > booking_type (2) > property (1) > global (0)`,
> ties broken by `display_order`.

So a property-specific item silently overrides a global one sharing the same key.
Final ordering within a kind: `display_order`, then created order.

## Resolver — one SQL function, two call sites

`resolve_bid_content(property_id uuid, service_ids uuid[], booking_type booking_type_enum)
→ (faq jsonb, gear jsonb)`

- `STABLE`. Reads only active templates + scopes.
- Called inside `create_public_booking()` to auto-fill at creation (stays atomic,
  one transaction).
- Exposed via RPC for the editor's **"Re-pull from library"** button.
- DRY: single source of truth for matching/dedupe/ordering.

## Lifecycle

1. **Creation** → `create_public_booking` calls the resolver and writes
   `bids.faq` / `bids.gear_list`. An untouched bid is already populated.
2. **Editor** → renders the existing editable lists. Admin can **remove** any line,
   edit text, **Add from library** (picker), or **Re-pull**. On save, the JSONB is
   the frozen snapshot. Templates edited later never touch existing bids.

## RLS

`bid_faq_templates`, `bid_gear_templates`, and both scope tables:
**staff-only, full access; no anon / member / partner.**
No cross-table subqueries in policies → no cycle risk. Reuse the existing
staff-role helper; wrap `auth.uid()` / `auth.jwt()` in `(select …)` per project RLS rules.
Resolver runs as `SECURITY DEFINER` inside `create_public_booking` (creation path)
and as staff via RPC (editor path).

## Admin management UI

CRUD at `/admin/templates`:
- List filtered by property / discipline / kind
- Edit text, toggle `is_active`, multi-select scope tags (properties, disciplines,
  booking types), reorder via `display_order`

## Where code lives (SOLID)

- Migration: `supabase/migrations/<ts>_bid_content_library.sql`
- Resolver SQL function: same migration
- TS resolver/types boundary: `src/services/bids/` (returns clean `BidFaqItem[]` /
  `BidGearItem[]`)
- Admin UI: `src/components/admin/templates/` + `app/admin/templates/`
- Editor wiring (Add-from-library, Re-pull): existing `bid-editor-form.tsx`

## Placeholder seed data

Realistic starter content for step 5. Answers/items are short on purpose — admins
trim, not rewrite. `dedupe_key` is shared across scopes so a more specific scope
overrides a general one (see the `cancellation` and `eye-ear` keys).

**Note on discipline scopes:** `services` rows are per-property, so a discipline that
exists at two clubs (e.g. Sporting Clays at both Horseshoe Bay and Hog Heaven) is two
service rows. A discipline-scoped template gets one scope row per service it applies to.
Below, "service: Sporting Clays" means "tag every Sporting Clays service row."

Property/discipline assumptions used for this seed:
- **Horseshoe Bay Sporting Club** — shotgun: Sporting Clays, Trap, Skeet, Five Stand, Shotgun Fundamentals
- **Hog Heaven Sporting Club** — shotgun + field: Sporting Clays, Upland Wingshooting, Shotgun Fundamentals
- **Packsaddle Precision** — rifle: Long Range / Precision Rifle, Rifle Fundamentals

### FAQ templates

**Global** (ride along on every bid)

| dedupe_key | Q / A |
|---|---|
| `cancellation` | *"What's your cancellation policy?"* — Full refund up to 7 days out; 50% within 7 days; no refund inside 24 hours. |
| `id-required` | *"Do I need an ID?"* — Yes, a valid government photo ID for every shooter, every visit. |
| `experience` | *"Do I need experience?"* — None at all. Every session starts with a safety brief and our instructors meet you at your level. |
| `minors` | *"Can minors shoot?"* — Yes, with a parent or guardian present and a signed waiver. Minimum age varies by discipline — ask if unsure. |
| `waiver` | *"Is there a waiver?"* — Yes. Every participant signs a liability waiver on arrival; we'll text you a link to complete it ahead of time. |
| `arrival` | *"When should I arrive?"* — 15 minutes early so we can check you in, fit gear, and run the safety brief without cutting into range time. |
| `payment` | *"How does payment work?"* — Your deposit is taken when you sign this bid; the balance is due on the day. |

**Per-property**

| dedupe_key | scope | Q / A |
|---|---|---|
| `cancellation` | property: Packsaddle | *"What's your cancellation policy?"* — The rifle range is reserved one group at a time, so we require **48-hour** notice for any refund. |
| `directions` | property: Horseshoe Bay | *"Where exactly are you?"* — In the Texas Hill Country near Horseshoe Bay; detailed driving directions and a gate code are texted the day before. |
| `course-transport` | property: Horseshoe Bay | *"How do we get around the course?"* — Each squad gets a golf cart; the sporting clays course is cart-path connected across all stations. |
| `lodge` | property: Hog Heaven | *"Is there food and a place to relax?"* — Yes — the lodge has restrooms, AC, and a porch; catering can be arranged for groups. |
| `dogs` | property: Hog Heaven | *"Are dogs involved?"* — On upland wingshooting outings our trained pointing dogs work the field with you; you're welcome to bring your own steady gun dog. |
| `distances` | property: Packsaddle | *"How far out can we shoot?"* — Steel and paper from 100 yards out past 1,000, with known-distance positions for working up a ballistic solution. |
| `altitude-wind` | property: Packsaddle | *"What makes precision here challenging?"* — Open high-desert positions with real wind and mirage — exactly what makes the long shots rewarding. Spotting scopes provided. |

**Per-discipline (service)**

| dedupe_key | scope | Q / A |
|---|---|---|
| `ammo` | service: Sporting Clays / Trap / Skeet / Five Stand | *"Is ammunition included?"* — Two boxes of 12ga target loads per shooter are included; more is available at the pro shop. |
| `ammo` | service: Upland Wingshooting | *"Is ammunition included?"* — Field loads appropriate to the birds are included; let us know if you prefer a specific shot size. |
| `ammo` | service: Long Range / Precision Rifle | *"Is ammunition included?"* — Match-grade .308 / 6.5 Creedmoor is provided. Bringing your own load? Clear it with us first for safety and barrel care. |
| `gauge-options` | service: Sporting Clays | *"What gauges can I shoot?"* — 12 and 20ga rentals are on hand; sub-gauge (28/.410) by request for the experienced crowd. |
| `course-format` | service: Sporting Clays | *"What's the course like?"* — 12–15 stations of varied presentations — crossers, teal, rabbits — walked as a squad over roughly 90 minutes. |
| `birds` | service: Upland Wingshooting | *"What birds are we hunting?"* — Released quail and chukar over pointing dogs; seasonal pheasant on request. A Texas hunting license is required and can be bought online. |
| `optics-provided` | service: Long Range / Precision Rifle | *"Do I need a scope or gear?"* — No. Rifles come glassed with quality optics, bipod, and rear bag; we coach you through the dope. |
| `intro-format` | service: Shotgun Fundamentals / Rifle Fundamentals | *"What does a fundamentals session cover?"* — Stance, mount/grip, sight picture, and safe handling one-on-one with an instructor before live fire. |

**Per-booking-type**

| dedupe_key | scope | Q / A |
|---|---|---|
| `lesson-format` | booking_type: private_lesson | *"How is a private lesson run?"* — One instructor, one or two shooters, paced entirely to you, with on-the-spot coaching and drills you can take home. |
| `catering` | booking_type: host_an_occasion | *"Can you feed our group?"* — Yes — BBQ or boxed lunches for parties of 6+; tell us headcount and any dietary needs when you confirm. |
| `group-format` | booking_type: host_an_occasion | *"How do large groups work?"* — We split you into squads with a dedicated instructor each, rotate stations, and can run a friendly scored competition with prizes. |
| `self-guided` | booking_type: plan_a_visit | *"Is a visit instructed or on my own?"* — A Plan-a-Visit is range time at your own pace; add an instructor anytime if you'd like coaching. |

### Gear templates

**Global**

| dedupe_key | Item / description |
|---|---|
| `eye-ear` | *Eye & ear protection* — Provided on site, or bring your own. |
| `shoes` | *Closed-toe shoes* — No open-toe footwear on any range; flat, stable soles are best. |
| `weather-clothing` | *Weather-appropriate clothing* — We shoot rain or shine; dress for the forecast and layer for the morning. |
| `water` | *Water bottle* — Stay hydrated, especially in summer. Refill stations are on site. |

**Per-property**

| dedupe_key | scope | Item / description |
|---|---|---|
| `eye-ear` | property: Packsaddle | *Electronic ear protection* — Required on the rifle line so you can hear range commands; loaners available. |
| `sun` | property: Packsaddle | *Sun protection* — Hat, sunglasses, and sunscreen; the high-desert positions have little shade. |
| `field-layer` | property: Horseshoe Bay | *Light jacket (optional)* — Several stations sit in shaded creek bottoms that stay cool in the morning. |
| `field-clothing` | property: Hog Heaven | *Field clothing & boots* — Earth tones and broken-in boots for walking upland cover. |

**Per-discipline (service)**

| dedupe_key | scope | Item / description |
|---|---|---|
| `shotgun` | service: Sporting Clays / Trap / Skeet / Five Stand | *Shotgun (12 or 20ga)* — Bring your own or rent a fitted gun for $40. |
| `shooting-vest` | service: Sporting Clays | *Shooting vest or shell pouch (optional)* — Handy for carrying shells between stations; loaners at the pro shop. |
| `field-shotgun` | service: Upland Wingshooting | *Field shotgun & blaze orange* — A 12 or 20ga field gun; a blaze-orange cap or vest is required in the field. |
| `rifle-provided` | service: Long Range / Precision Rifle | *Rifle — provided* — Match rifle, optics, bipod, and rear bag are all supplied; bring your own only after clearing it with us. |
| `data-book` | service: Long Range / Precision Rifle | *Notebook or phone (optional)* — For recording dope; we'll help you build a come-up chart you can keep. |
| `intro-nothing` | service: Shotgun Fundamentals / Rifle Fundamentals | *Nothing required* — All firearms, ammo, and safety gear are provided for fundamentals sessions — just show up. |

**Per-booking-type**

| dedupe_key | scope | Item / description |
|---|---|---|
| `byo-gun` | booking_type: private_lesson | *Your own firearm (optional)* — If you own the gun you'll compete or hunt with, bring it so we can coach on your actual setup and fit. |
| `group-nothing-extra` | booking_type: host_an_occasion | *Nothing extra to bring* — We handle all firearms, ammo, safety gear, and station setup for your group; just bring your crew. |

### What auto-fills at two properties (sanity check)

**Bid A — Horseshoe Bay · private_lesson · Sporting Clays**
FAQ: `cancellation`(global), `id-required`, `experience`, `minors`, `waiver`, `arrival`,
`payment`, `directions`, `course-transport`, `ammo`(clays), `gauge-options`,
`course-format`, `lesson-format`.
Gear: `eye-ear`(global), `shoes`, `weather-clothing`, `water`, `field-layer`,
`shotgun`, `shooting-vest`, `byo-gun`.

**Bid B — Packsaddle · host_an_occasion · Long Range / Precision Rifle**
FAQ: `cancellation`(**Packsaddle override**), `id-required`, `experience`, `minors`,
`waiver`, `arrival`, `payment`, `distances`, `altitude-wind`, `ammo`(rifle),
`optics-provided`, `catering`, `group-format`.
Gear: `eye-ear`(**Packsaddle override → electronic**), `shoes`, `weather-clothing`,
`water`, `sun`, `rifle-provided`, `data-book`, `group-nothing-extra`.

## Build order

1. Recon: read `create_public_booking()`, `bid-editor-form.tsx`, staff-role RLS helper.
2. Migration: tables + scope CHECK constraints + RLS + `resolve_bid_content` function;
   wire into `create_public_booking`. Manually test resolver as real roles.
3. Admin `/admin/templates` CRUD.
4. Editor: Add-from-library picker + Re-pull button.
5. Seed placeholder templates; verify auto-fill on a new bid at two properties.

## Open defaults (chosen unless changed)

- Table names as above; route `/admin/templates`
- Resolver as a SQL function (vs TS)
- Precedence `service > booking_type > property > global`

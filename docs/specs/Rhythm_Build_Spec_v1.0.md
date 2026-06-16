# Rhythm Outdoors — Build Spec v1.0

**Prepared by** Nicholas Vedros (Rhythm Outdoors) + the developer (taz) collaboration session
**Date** 2026-06-16
**Audience** Claude Code session working in taz's `rhythm-outdoors` repo. Read Corpus v2.1 first.
**Status** Direction locked. Phased. Drop-in.
**Revision note (2026-06-16, post-publication):** Discounts are visible on the customer-facing bid as a transparent line item ("Discount applied" or a concierge-set label) so the customer feels the comp. The audit machinery (actor, timestamp, reason) stays admin-only. See §2.2, §4.2, §6 Phase 1, §8.

---

## 0. Purpose and reading order

This spec authorizes three pieces of new work that extend — never replace — taz's existing admin platform. Read in order:

1. **Rhythm Schema Training Corpus v2.1** in this folder. The canonical operating context.
2. **Claude Code Kickoff Prompt** in this folder. The forward-only directive.
3. **This document** — the build spec.

The forward-only directive applies: the schema architecture taz built today is authoritative. Legacy patterns get updated forward; the canonical never syncs backward.

---

## 1. What the existing app already does — and what must not change

The Rhythm admin app, observed at the 2026-06-15 build, runs the following surfaces. **These ship the business today. They are load-bearing. Do not alter their core flow.**

| Surface | Route | What it does | New work touches it? |
|---|---|---|---|
| Dashboard | `/admin` | Pending review queue (6), recent activity (10), today's schedule grid (3 properties × 7 AM–8 PM), next-7-days by property | Read-only consumption of new data; do not alter card layouts |
| Bids review queue | `/admin/bids` | All / Needs review / Active / Closed filters; table by Guest, Booking, When, Property, Status; checkpoints (Signed · Deposit · Paid in full) | Add a new column for override flag; new booking type appears in dropdown; do not change status flow |
| Bid detail | `/admin/bids/[uuid]` | The reviewer surface for a single bid | Extend with override-capable line editor (Phase 1) |
| Bookings calendar | `/admin/bookings` | Two-month calendar; property filter; day schedule | Read-only; partner-group bookings appear like any other |
| Adventures | `/admin/adventures` | Member trip catalog | Not touched |
| Members | `/admin/members` | Directory of memberships and households | Not touched |
| Properties | `/admin/properties` | Per-property settings (booking rules, home-page info, notifications, pre-visit) | Not touched |
| FAQ & Gear | `/admin/templates` | Reusable FAQ + gear templates that auto-fill bids by scope | Extend: new template scope option `booking_type = partner_group` |
| Waivers | `/admin/waivers` | Walk-in kiosk links + waiver list + PDF view | Not touched |
| Team | `/admin/team` | Staff invites, roles, sign-in | **Open question to taz** (§9) — partner concierge role tier |
| What's New | `/admin/release-notes` | Release notes feed | Update on shipping each phase |

Status flow on every bid is **Pending Review → Confirmed → Signed → Paid** (with side branches Refunded / Denied / Expired). **Do not introduce new statuses.** The existing checkpoints (Signed / Deposit / Paid in full) are the contract.

Existing email automation (pre-trip reminders, waiver confirmations, unsigned-bid nudges, new-bid staff alerts) is the customer communication backbone. **Reuse it for partner-group bids and the deeper intake.** Do not build parallel email flows.

Existing public funnel at `/book/[property]` (Plan a Visit / Private Lesson / Host an Occasion / Adventures) is the self-service customer surface. **Do not alter its transparency or pricing model.** It already shows live pricing per PR #5 (the $85 flat / $55 junior / cap-5 work). The simple funnel stays simple.

---

## 2. Three new pieces of work — locked direction

Per Nicholas's 2026-06-16 directives:

### 2.1 Consumer-facing deeper intake (public website side)

A richer, schema-aware intake form for complex or group bookings that the existing self-serve funnel can't handle cleanly. Lives on the **public side** of the website, not behind admin login.

- **Audience:** customers planning corporate days, larger groups, multi-discipline events, custom requests; also a deflection path for self-serve customers whose needs exceed Plan a Visit.
- **Route:** `/inquire/[property]` (proposed). Sibling to `/book/[property]`.
- **Threshold:** When a customer in the simple `/book/[property]` funnel selects a configuration that doesn't fit the self-serve mold (8+ guests, multi-discipline, custom date outside the next 30 days, partner-attributed booking), the funnel offers them a "Let's plan this together" handoff to `/inquire/[property]` and pre-populates what they've already answered.
- **Pricing model:** **Live transparent pricing throughout.** Customer sees the real estimate update as they answer (matching the Plan a Visit pattern). Per Nicholas 2026-06-16.
- **Output:** Creates a row in the existing `bids` table with `status = pending_review` and a new `intake_source` enum value (see §4.1). Same queue, same status flow, richer captured intent in the payload.
- **AI chat widget** (§5): floating bottom-right; persistent through the flow; scoped to property's SKU catalog and corpus v2.1.

### 2.2 Back-end robust bidder with per-line override (admin side)

Extends the existing bid detail page at `/admin/bids/[uuid]` with the ability for a concierge to **waive or comp specific line items** on a Pending Review bid.

- **Audience:** events concierge team, GMs, super_admins.
- **Scope of overrides** (per Nicholas 2026-06-16): **Per-line price waive or comp only.** Not capacity overrides, not custom line items, not out-of-hours dates. Keep the schema honest.
- **Audit:** Every override captures actor, timestamp, line item, original price, new price, reason text. Stored in a new `bid_line_overrides` table (see §4.2).
- **Surfacing:** Per Nicholas 2026-06-16 (revised same day) — discounts ARE visible on the customer-facing bid as a clean line item so the customer feels the value of the comp. The audit machinery (actor, timestamp, reason text) stays admin-only. Specifically:
  - **Customer-facing bid PDF / estimate** renders each waived line at its **original** amount, then surfaces a separate **"Discount applied: -$X"** line beneath the subtotal. The concierge can override the default "Discount applied" label per-override with a customer-friendly name (e.g., "VIP comp", "Welcome offer", "Group rate discount", "Member appreciation"). The customer sees: full price, transparent discount, lower total. They feel the gesture.
  - **Customer-facing bid PDF does NOT show** the actor, the timestamp, or the reason text. Those stay in the admin audit layer.
  - **Admin Bids queue (`/admin/bids`):** new column with a small flag icon when any override exists on the bid. Title text shows total waived amount.
  - **Admin bid detail (`/admin/bids/[uuid]`):** an "Overrides applied" panel between the line items and the bid actions, listing each override with actor + timestamp + line + delta + reason text (admin context only).
  - **Admin dashboard (`/admin`):** new card "Overrides this week" (count + total $ waived) drilling into a filtered Bids view.
- **No approval gate.** Audit-and-flag, trust-and-verify. Nicholas's call: don't gate the bid; surface the discount transparently to the customer AND the audit trail to admins so abuse becomes visible.

### 2.3 Partner Group as a new booking type

Camp Lucy Resort × Hog Heaven and Horseshoe Bay Resort × HSB SC partnerships (Channel B Hotel Group) ship as a **new booking type** alongside Plan a Visit / Private Lesson / Host an Occasion / Adventures.

- **Booking type:** `partner_group`. Label "Partner Group" in UI.
- **Pricing model:** Differential markup. **25% on per-guest experience lines, 15% on instructor labor.** Both percentages read from a new partner profiles table (§4.3) so they vary by partner. Camp Lucy and HSB Resort both run 25/15.
- **F&B exclusion:** Per partner profile `fnb_policy` field. Both Camp Lucy and HSB Resort use `excluded_partner_bids` — F&B never appears in the per-guest allocation; partner bids it separately.
- **Instructor model:** Per-instructor billing as a separate POS line. TX §151.0048 EXEMPT. $300 SC base / $345 customer-facing at 15% markup, flat across all packages. Ratio rules per discipline (Shotgun 1:3 per active firearm, Pistol/Carbine 1:5 per student). Schema-driven from per-SKU properties (§4.4).
- **Customer-facing rates** (HSB SC × HSB Resort, the new partnership we built today):
  - Shotgun Standard $195 retail (self-guided default; optional Certified Instructor at $345)
  - Shotgun Premium $225 retail (Senior Instructor mandatory at $345)
  - Pistol $147 retail proposed (Certified Instructor mandatory at $345)
  - Carbine $161 retail proposed (Certified Instructor mandatory at $345)
- **Customer-facing rates** (HH × Camp Lucy):
  - Last Stand – Shotgun Showdown $185 retail (Shotgun Instructor at $350 retail / $304 SC base, required for groups of 10+)
  - Hill Country Sporting Clays $185 retail (same instructor model)
  - The Texas Pistol Range $125 retail (Pistol Instructor at $395 retail / $343 SC base, required every party size)
- **Entry:** Passcode-gated on the public-facing inquire path. `HSBResort` for HSB Resort, `CampLucyResort` for Camp Lucy. The partner concierge enters the passcode and the form pivots to the partner-attributed flow. **Open question to taz:** whether partner concierges instead get admin login accounts (§9).
- **Operating window:** Per partner profile. HSB Resort partnership: Tue–Sun, closed Monday, seasonal time bands matching HSB SC member calendar. Camp Lucy: Tue–Sat 9 AM – 4 PM.
- **Output:** Same Bids queue, `booking_type = partner_group`, `partner_id` populated. Status flow unchanged.

---

## 3. Routes and component contracts

### 3.1 New public routes

| Route | Purpose | Component family |
|---|---|---|
| `/inquire/[propertySlug]` | The deeper consumer intake. Property slugs: `horseshoe-bay`, `hog-heaven`, `packsaddle`. | `InquireFlow` (multi-step form, transparent pricing, AI chat widget) |
| `/inquire/[propertySlug]/partner` | Passcode-gated partner-group entry path. | `PartnerInquireGate` then `InquireFlow` with `bookingType=partner_group` and partner pre-bound |

### 3.2 Extended admin routes

| Route | Change |
|---|---|
| `/admin/bids` | Add filter chip for `booking_type=partner_group`. Add column for override flag. |
| `/admin/bids/[uuid]` | Add `LineOverrideEditor` panel. Add `OverrideAuditPanel`. Both rendered only when `bid.status = pending_review`. |
| `/admin/dashboard` | Add "Overrides this week" card. |
| `/admin/templates` | Add `booking_type = partner_group` to template scope dropdown so FAQ/Gear templates can scope to partner bids. |

### 3.3 Component shapes (high-level)

```
InquireFlow
├── PropertyHeader (read-only — pulls from properties table)
├── EventTypeStep (initial intent: corporate, wedding, group of friends, partner-group)
├── DateAndPartyStep (date, arrival, headcount, junior split if HSB)
├── DisciplinesStep (schema-driven per-property; SKU multi-select)
├── PreferencesStep (any add-ons, dietary callouts, gift wrapping etc.)
├── ContactStep (name, email, phone, optional company)
├── ReviewStep (transparent pricing summary; legal disclosure; submit)
└── AIChatWidget (floating; persistent through steps; scoped context)

PartnerInquireGate (renders before InquireFlow on /partner sub-route)
├── PasscodeInput
├── PartnerProfileLookup (validates passcode → loads partner_id)
└── on success: redirects into InquireFlow with bookingType=partner_group and partner pre-bound

LineOverrideEditor (admin/bids/[uuid])
├── BidLineRow (existing, extended with "Waive" action)
├── WaiveDialog (per-line modal: new amount, reason, actor recorded)
└── on save: writes bid_line_overrides row + recomputes bid total

OverrideAuditPanel (admin/bids/[uuid])
├── For each override on this bid:
│   ├── Actor + timestamp
│   ├── Line + original → new + delta
│   └── Reason text
└── Empty state: "No overrides applied to this bid."

OverridesThisWeekCard (admin dashboard)
├── Count + total $ waived (current week, all properties)
├── Filter chips: All / This property
└── Link → /admin/bids?has_override=true
```

---

## 4. Data model changes (Supabase migrations)

Three migrations to write. Apply in this order. Each is additive; no destructive changes.

### 4.1 Migration: `intake_source` enum + bid columns

```sql
-- Adds intake_source to bookings/bids so we can distinguish:
--   public_simple   — existing /book/[property] funnel (Plan a Visit / Lesson / Occasion)
--   public_inquire  — new /inquire/[property] deeper intake
--   admin_book      — staff "Book for a customer"
--   partner_inquire — passcode-gated /inquire/[property]/partner
ALTER TYPE bid_intake_source AS ENUM (
  'public_simple',
  'public_inquire',
  'admin_book',
  'partner_inquire'
);

ALTER TABLE bookings
  ADD COLUMN intake_source bid_intake_source NOT NULL DEFAULT 'public_simple',
  ADD COLUMN partner_id uuid REFERENCES partner_profiles(id);

CREATE INDEX bookings_partner_id_idx ON bookings(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX bookings_intake_source_idx ON bookings(intake_source);
```

Existing rows backfill as `public_simple` (the default). No semantic change to existing bids.

### 4.2 Migration: `bid_line_overrides` table

```sql
CREATE TABLE bid_line_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  line_item_id uuid NOT NULL,                  -- references bid_line_items.id
  original_amount numeric(10,2) NOT NULL,
  new_amount numeric(10,2) NOT NULL,
  delta numeric(10,2) GENERATED ALWAYS AS (new_amount - original_amount) STORED,
  reason text NOT NULL CHECK (length(reason) >= 10),               -- ADMIN-ONLY (never on customer PDF)
  customer_facing_label text,                                       -- optional concierge-set label like "VIP comp"; defaults to "Discount applied"
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  actor_email text NOT NULL,                   -- captured at write time for audit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bid_line_overrides_bid_id_idx ON bid_line_overrides(bid_id);
CREATE INDEX bid_line_overrides_actor_id_idx ON bid_line_overrides(actor_id);
CREATE INDEX bid_line_overrides_created_at_idx ON bid_line_overrides(created_at);

-- RLS: only admins read/write. Customers never see this table.
ALTER TABLE bid_line_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_overrides ON bid_line_overrides FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);
CREATE POLICY admin_write_overrides ON bid_line_overrides FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);
```

The bid's customer-facing total is computed as `sum(line_items.original_amount) + sum(overrides.delta)` where `delta = new_amount - original_amount` (negative for a discount). The customer-facing PDF / estimate renders each waived line at its **original amount** and then surfaces a separate **"Discount applied: -$X"** line beneath (or the concierge-set `customer_facing_label` if present). The customer sees the gesture transparently. The admin `OverrideAuditPanel` exposes the actor, timestamp, line item, delta, and reason text — admin context only. The `reason` field NEVER renders on the customer PDF.

### 4.3 Migration: `partner_profiles` table

```sql
CREATE TABLE partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,                   -- 'camp-lucy-resort', 'horseshoe-bay-resort'
  display_name text NOT NULL,
  legal_name text,
  property_id uuid NOT NULL REFERENCES properties(id),  -- which Rhythm property this partner sells
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  intake_passcode text NOT NULL,                -- 'HSBResort', 'CampLucyResort'
  markup_features_pct numeric(5,2) NOT NULL,    -- 25.00
  markup_instructor_pct numeric(5,2) NOT NULL,  -- 15.00
  fnb_policy text NOT NULL CHECK (fnb_policy IN ('included','excluded_partner_bids','excluded_resort_provides')),
  operating_days int[] NOT NULL,                -- ISO weekday numbers (0=Sun..6=Sat)
  earliest_arrival text NOT NULL DEFAULT '09:00',
  latest_arrival text NOT NULL DEFAULT '16:00',
  operating_hours_note text,
  primary_contact text,
  intake_recipients text[],                     -- emails
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_profiles_property_id_idx ON partner_profiles(property_id);
CREATE INDEX partner_profiles_slug_idx ON partner_profiles(slug);

-- Seed canonical partners
INSERT INTO partner_profiles (slug, display_name, legal_name, property_id, intake_passcode, markup_features_pct, markup_instructor_pct, fnb_policy, operating_days, earliest_arrival, latest_arrival, operating_hours_note)
VALUES
  ('horseshoe-bay-resort', 'Horseshoe Bay Resort', 'Horseshoe Bay Resort',
   (SELECT id FROM properties WHERE slug = 'horseshoe-bay'),
   'HSBResort', 25.00, 15.00, 'excluded_partner_bids',
   ARRAY[0,2,3,4,5,6], '09:00', '16:00',
   'Tue–Sun, closed Monday only. Seasonal hours: summer (Jun 1 – Aug 31) close 5 PM; winter (Sep 1 – May 31) close 6 PM. Sun opens 10 AM.'),
  ('camp-lucy-resort', 'Camp Lucy Resort', 'Camp Lucy',
   (SELECT id FROM properties WHERE slug = 'hog-heaven'),
   'CampLucyResort', 25.00, 15.00, 'excluded_partner_bids',
   ARRAY[2,3,4,5,6], '09:00', '16:00',
   'Tue–Sat 9 AM – 4 PM. No Sunday or Monday bookings.');
```

### 4.4 Per-SKU schema extensions for instructor billing

If `services` / `pricing_rules` tables don't already carry instructor metadata, add:

```sql
ALTER TABLE services
  ADD COLUMN instructor_ratio_max text,                                              -- '1:3', '1:5'
  ADD COLUMN instructor_ratio_basis text CHECK (instructor_ratio_basis IN ('per_active_firearm','per_student','n/a')),
  ADD COLUMN instructor_required_when text CHECK (instructor_required_when IN ('always','optional','groups_10_plus','n/a')),
  ADD COLUMN instructor_tier_label text;                                             -- 'Certified Instructor', 'Senior Instructor'

-- Per-instructor billing SKU. Single canonical row per partner-property combo.
-- Customer-facing rate = sc_base * (1 + markup_instructor_pct/100).
CREATE TABLE instructor_billing_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  partner_id uuid REFERENCES partner_profiles(id),                                   -- null = applies to all channels for this property
  sc_base_amount numeric(10,2) NOT NULL,                                             -- 300.00 at HSB SC v1.5
  unit text NOT NULL DEFAULT 'per_instructor',
  tax_exempt boolean NOT NULL DEFAULT true,                                          -- TX §151.0048
  charter_principle_refs text DEFAULT '#3 Bundle Trap',
  notes text
);
```

Seed values per Corpus v2.1 §11 and §15.

---

## 5. AI chat box

### 5.1 Backend — open question for taz

**Nicholas defers to taz on the LLM provider.** Before this work begins, taz answers:

- Does the `rhythm-outdoors` repo already have an OpenAI, Anthropic, or Vercel AI SDK integration configured for any feature?
- If yes: reuse the existing provider and credentials. The chat endpoint becomes a new route consuming the existing infrastructure.
- If no: recommendation is Anthropic Claude (model: `claude-sonnet-4-5` or current equivalent) via the Vercel AI SDK. Streaming responses. System prompt scoped to (a) the property's published SKU catalog at runtime, (b) Corpus v2.1 §6 standing rules, (c) the bid's current state if the chat is in the admin context.

### 5.2 System prompt requirements

The chat assistant must:

- **Refuse to invent prices.** All quoted prices must come from live SKU data passed in the system prompt. If a customer asks "how much for X" and X isn't in the catalog, the assistant says "Let me get the concierge to confirm" and surfaces a flag in the chat thread.
- **Escalate booking decisions.** The assistant can answer questions about what's offered, what's included, what to expect — but cannot confirm a booking. Bookings flow through the form / Bids queue. Period.
- **Refuse to invent waivers, contractual terms, or policy language.** Pulls these from the canonical waiver templates (`/admin/settings/waivers`) and the FAQ database (`/admin/templates`).
- **Knows when to hand off.** If the customer expresses frustration, requests human, asks something the assistant can't ground in data, or surfaces a complaint, the assistant offers to email the concierge team with a transcript and submits a flag on the in-flight inquiry.

### 5.3 Surfaces

| Surface | Chat scope | Persistence |
|---|---|---|
| `/inquire/[propertySlug]` floating widget | Customer scope: SKU catalog, FAQ, property facts. | Per-session (resets after submit). Transcript attached to the bid on submit. |
| `/inquire/[propertySlug]/partner` floating widget | Customer scope plus partner-specific notes (markup intent, F&B exclusion explanation). | Per-session. Transcript attached. |
| `/admin/bids/[uuid]` sidebar | Admin scope: bid line items, customer history, override audit trail, override permission. Can suggest line waives but not execute them. | Per-bid (persists across admin sessions). |

### 5.4 What the chat does NOT do (phase 1)

- Does not modify bid records directly.
- Does not send emails.
- Does not move bids through status states.
- Does not impersonate concierges.
- Does not negotiate pricing beyond surfacing the published rate.

These come in a future phase if usage warrants.

---

## 6. Phased build plan

Four phases. Each is shippable on its own. Each has acceptance tests. Each leaves the system in a working state.

### Phase 1 — Override audit foundation (admin only)

**Goal:** Concierges can waive a line on a Pending Review bid; the dashboard and Bids queue surface every override; the customer bid PDF stays clean.

**Includes:**
- Migration 4.2 (`bid_line_overrides` table)
- `LineOverrideEditor` on `/admin/bids/[uuid]` with WaiveDialog (reason required, ≥10 chars)
- `OverrideAuditPanel` on the same page
- Override flag column in `/admin/bids` table
- "Overrides this week" card on `/admin/dashboard`
- Customer-facing PDF generation reads `COALESCE(override.new_amount, line.amount)` — clean total, no override breadcrumbs

**Acceptance:**
- A concierge waives the instructor fee on a pending bid with reason "comp for VIP wedding party" and sets the customer-facing label to "VIP comp"
- The bid total updates correctly (sum of original amounts + sum of override deltas)
- **The customer-facing bid PDF shows:** the original instructor line at $345, a transparent "VIP comp: -$345" line beneath, and a lower customer total. The customer feels the gesture.
- **The customer-facing bid PDF does NOT show:** the actor, the timestamp, or the reason text "comp for VIP wedding party". Those stay admin-only.
- The Bids queue row shows a small flag icon with hover-text "Override applied -$345"
- The admin bid detail page shows the override in the audit panel with actor, time, line, delta, reason
- The dashboard card shows "1 override this week · -$345"
- The override cannot be edited or deleted (audit immutability)
- A non-admin user cannot read `bid_line_overrides` (RLS) — particularly the `reason` field
- If the concierge does not set a `customer_facing_label`, the customer PDF defaults to "Discount applied: -$X"

### Phase 2 — Partner Group booking type

**Goal:** Partner concierges (Catherine Mears at Camp Lucy, Lacee/Remington at HSB Resort) submit bookings on behalf of their guests through a passcode-gated public path. Bids appear in the existing queue with partner attribution.

**Includes:**
- Migration 4.3 (`partner_profiles` table + seeds)
- Migration 4.4 (per-SKU instructor metadata + `instructor_billing_skus` table)
- Seed the four HSB SC × HSB Resort SKUs per Corpus v2.1 §11
- Seed the three HH × Camp Lucy SKUs per Corpus v2.1 §11
- `PartnerInquireGate` component at `/inquire/[propertySlug]/partner`
- `InquireFlow` with `bookingType=partner_group` rendering path (transparent pricing, partner markup math, F&B exclusion language)
- New booking type chip in `/admin/bids` filters
- Partner pill in admin Bids rows when `booking_type = partner_group`
- Add `partner_group` to FAQ/Gear template scope dropdown
- "Partner attribution" callout on `/admin/bids/[uuid]` when applicable (partner name, partner contact)

**Acceptance:**
- Visiting `/inquire/horseshoe-bay/partner` shows the passcode gate
- Entering `HSBResort` admits to the InquireFlow with HSB Resort partner pre-bound
- Entering `CampLucy` (or `CampLucyResort` per Corpus v2.1) on `/inquire/hog-heaven/partner` admits with Camp Lucy partner pre-bound
- Entering a wrong passcode shows a generic "Please contact your partner contact" error
- Selecting Shotgun Standard for 12 guests shows customer-facing total: 12 × $195 + 4 × $345 = $3,720 + tax (HSB SC math; tax applies to per-guest line only per §151.0048)
- F&B is not offered as an add-on
- Submit creates a bid with `booking_type=partner_group`, `partner_id` set, `intake_source=partner_inquire`
- Admin Bids queue shows the bid with a property pill AND a small partner pill
- FAQ/Gear template scoped to `booking_type=partner_group` auto-fills on the bid

### Phase 3 — Deeper consumer intake (public)

**Goal:** Customers planning complex / larger / non-standard bookings have a richer intake path that respects the schema and shows live transparent pricing.

**Includes:**
- Migration 4.1 (`intake_source` enum + bid columns)
- `/inquire/[propertySlug]` route with full `InquireFlow`
- Soft handoff from `/book/[propertySlug]` to `/inquire/[propertySlug]` when configuration exceeds self-serve mold
- Transparent pricing throughout (matches Plan a Visit pattern)
- Submit creates a bid with `intake_source=public_inquire`
- "Inquire" appears in admin Bids queue filter as a distinct intake source

**Acceptance:**
- Visiting `/inquire/horseshoe-bay` shows the InquireFlow without passcode
- A customer can complete the flow without an account
- Pricing updates live as the customer adjusts inputs
- Submit produces a Pending Review bid with `intake_source=public_inquire`
- In `/book/horseshoe-bay`, choosing 15 guests offers a handoff: "Sounds like a bigger day — let's plan this together. Continue on /inquire?"
- Existing self-serve customers (under threshold) are not interrupted

### Phase 4 — AI chat box

**Goal:** Customers and concierges have a conversational helper grounded in schema and policy, refusing to invent pricing or confirm bookings.

**Pre-requisite:** taz answers the LLM provider question (§5.1).

**Includes:**
- LLM provider integration per taz
- `AIChatWidget` floating component on customer surfaces
- `AIChatSidebar` on `/admin/bids/[uuid]`
- System prompt loading: SKU catalog, FAQ database, override-audit context, current bid state (admin only)
- Transcript persistence on inquiry bids
- Concierge handoff trigger when assistant signals escalation

**Acceptance:**
- A customer on `/inquire/horseshoe-bay` asks "do you have lessons for beginners?" — assistant answers from the Private Lesson SKU and FAQ
- Customer asks "what does it cost for 15 of us?" — assistant pulls live pricing from the SKU catalog, never invents
- Customer asks "can you confirm my booking for next Tuesday?" — assistant declines, redirects to the form / says "the concierge will confirm within X hours of submit"
- Customer expresses frustration — assistant offers to escalate, drafts a message, attaches transcript
- On `/admin/bids/[uuid]`, a concierge asks "what's a fair waive on the instructor fee for this bid?" — assistant surfaces the override-audit history for similar bids and the published rate; does not execute the waive

---

## 7. What this build does NOT change

For the avoidance of doubt:

- The existing `/book/[property]` Plan a Visit / Lesson / Occasion flow keeps its current behavior. PR #5 work (junior split, $85 / $55, cap-5) ships intact.
- The Bids review queue status flow stays Pending Review → Confirmed → Signed → Paid. No new statuses.
- The Bookings calendar surfaces all bookings including partner-group ones with the same property pill convention; no calendar logic change.
- The Waiver kiosk system is untouched. Waiver collection on partner-group bookings still flows through the same waiver record table.
- The FAQ & Gear template auto-fill mechanism extends to `partner_group` scope but its existing scopes work unchanged.
- The "Book for a customer" staff flow is untouched.
- The email automation backbone is reused for new flows, not duplicated.
- The Adventures, Members, Properties, Team, What's New, and Profile surfaces are not touched.

---

## 8. Acceptance gates (must-haves before each phase ships)

For every phase:

1. **Typecheck clean** (`npm run typecheck`)
2. **Migrations apply via `npx supabase db reset`** without error
3. **No new lint errors**
4. **PR review by Nicholas** before merge
5. **PR description includes** screenshots of each new surface, acceptance test results, and the relevant Corpus v2.1 sections
6. **What's New entry** drafted as part of the PR (not yet published)
7. **No regressions** in the existing surfaces listed in §1

For Phase 1 specifically:
- Customer PDF for a bid with overrides shows each waived line at its **original** amount AND a separate transparent "Discount applied" (or concierge-set label) line beneath surfacing the dollar value of the comp. The customer feels the gesture.
- The customer PDF NEVER renders the override's `actor`, `actor_email`, `created_at`, or `reason` text. Those are admin-only and protected by RLS.
- RLS test: a non-admin user attempting to read `bid_line_overrides.reason` returns an empty set.
- If `customer_facing_label` is null, the customer PDF defaults to "Discount applied: -$X". If set, the customer PDF renders the concierge's label verbatim.

For Phase 2 specifically:
- A bid created by a partner concierge must not leak the partner's wholesale margin to the customer estimate output.
- The internal reconciliation output (admin-only) must show SC cost, markup, customer-facing per line.

For Phase 3 specifically:
- A bid created via `/inquire` must use the same Bids queue, same status flow, same email automation as a bid from `/book`.

For Phase 4 specifically:
- AI chat conversations must persist with the bid for audit.
- AI cannot mutate any business data.

---

## 9. Open questions for taz

> **Tracked as a live checklist in [Issue #9 — "Questions for Taz — open architecture decisions"](https://github.com/tazcarper/rhytm/issues/9).** That issue is the single canonical place to see what Nicholas needs from Taz and to tick items off as they're decided; this section is the narrative source. (As of 2026-06-16: §9.4 is resolved by Phase 1 ruling Q5, and the Phase 1 design Q1–Q5 are all locked — see `docs/specs/Phase_1_Design.md`.)

These need taz's answer before the work begins. Listed in priority order:

1. **LLM provider for AI chat (§5.1).** Is there one wired in already? If not, taz picks before Phase 4.

2. **Partner concierge access model.** Three options — Nicholas defers to taz:
   - (a) Partner concierges access only the public passcode-gated `/inquire/[propertySlug]/partner` path. No admin account. Cleanest privacy for the partner's side.
   - (b) Partner concierges get an `admin_users` role of `partner_concierge` with limited views — can see only their own partner's bids in the Bids queue, can read overrides on their own bids but cannot apply them, cannot see other partners or non-partner bookings. More integrated; supports concierge dashboards.
   - (c) Some hybrid: Public path for submission, separate magic-link concierge dashboard for the partner to track their submitted bids' status.

3. **Threshold for the `/book` → `/inquire` soft handoff (§2.1).** What triggers the offer? Headcount, multi-discipline, custom date, all of the above? Recommendation: 8+ guests OR custom date > 30 days out OR multi-discipline picked.

4. **Override threshold for a "high-impact" dashboard alert.** Phase 1 ships with audit-and-flag only. If we want to surface a "this week's largest overrides" widget later, where's the threshold ($X waived, Y% of bid total)?

5. **Partner pill color in admin.** Each property has a color (HH orange, HSB blue, Packsaddle sage). Partners need a visual distinct from the property. Recommendation: a small secondary pill in tan / cream that reads "Camp Lucy" or "HSB Resort" with a property pill alongside.

---

## 10. Forward-only directive (carried from kickoff)

Per the kickoff prompt directive, the schema architecture defined by Nicholas and taz across 2026-06-03 through 2026-06-16 is the canonical going forward. This spec extends it. Do not revert.

Specifically:

- Per-instructor billing is the model. Instructor labor never embedded in per-guest allocation.
- Differential markup (25% features / 15% instructor) lives at the partner profile level, never hardcoded at the SKU level.
- HSB SC universal locks (Range Access $30, Firearm Rental $52, Clay Targets $38, Instructor $300 SC / $345 retail) are the truth. The seeds in §4.4 carry them.
- HSB SC v1.5 retail anchors ($195 / $225 / $147 / $161) stand. The seeds in §4.3 / §4.4 carry them.
- F&B exclusion at HSB SC is permanent. The `fnb_policy` field expresses it.
- Two-document workflow (Customer Estimate + Internal Reconciliation) persists. The admin sees both; the customer sees only the estimate.
- Instructor ratio rules per discipline (Shotgun 1:3 per active firearm; Pistol/Carbine 1:5 per student) are schema-driven from the new SKU columns.
- Operating window for HSB Resort partner channel: Tue–Sun, closed Monday only.
- Shooting age policy at HSB SC: 21+ unsupervised, 20- needs adult present (Q&A 5.12.26).
- Adam McCaw is HSB SC GM (not Jay Krug).

When the implementation surfaces a legacy pattern, update the legacy forward, never sync the canonical backward.

---

## 11. Notes for the implementing Claude Code session

When picking this up:

- Read Corpus v2.1 in full first.
- Read this spec in full second.
- Confirm orientation in one sentence: (a) the four phases, (b) the three new pieces, (c) the surfaces you will NOT touch.
- Open question §9.1 (LLM provider) to Nicholas. He'll ask taz; you wait for the answer before Phase 4.
- Begin Phase 1. Surface the diff for Nicholas's review before merging. Do not auto-merge.

Standing by.

— end of build spec v1.0 —

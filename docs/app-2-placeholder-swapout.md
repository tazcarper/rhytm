# App 2 — Placeholder Swap-Out Guide

When Q2 / Q4 / Q5 land from the client, this doc tells you exactly which files to touch. The booking flow is data-driven; **no UI code changes** when the real catalog / hours / pricing arrive — only the seed migrations and the data they wrote.

Every placeholder row was deliberately prefixed `PLACEHOLDER` (in the `description` column for services / add-ons, in the `name` column for instructors) so a single `SELECT` against the live DB finds every row to replace.

---

## Q2 — Operating hours + instructor headcount per property

**Affects:** `time_slots`, `instructors`

**Placeholder migrations to replace:**
- `supabase/migrations/20260520130100_seed_placeholder_time_slots_instructors.sql` — seeds 9 AM / 11 AM / 1 PM / 3 PM × 7 days × 3 properties (84 rows) + 7 instructors (3 HSB / 2 Hog Heaven / 2 Packsaddle).

**Swap procedure:**

1. Get the real operating hours per property from the client (which days each property is open + which time slots fire on each day).
2. Get the real instructor roster per property (name + bio + display_order).
3. Write a new migration: `supabase/migrations/<timestamp>_seed_real_time_slots_instructors_q2.sql`. The first statements should clear the placeholders:
   ```sql
   DELETE FROM time_slots; -- safe — admin can re-seed per property
   DELETE FROM instructors WHERE name LIKE 'PLACEHOLDER%';
   ```
   Then INSERT the real rows. The schema columns are identical; only values change.
4. Apply via `supabase db push`.
5. Sanity check the booking funnel — the picker should now show the real slot times.

**Booking-horizon tuning:** `properties.booking_horizon_days` defaults to 30 days. If the client wants a different lookahead per property, admin can edit the column directly (App 3 surfaces this in a dashboard, but in the interim it's a `UPDATE properties SET booking_horizon_days = 60 WHERE slug = 'horseshoe-bay';`).

---

## Q4 — Full discipline + add-on catalog

**Affects:** `services`, `add_ons`, `service_add_ons`

**Placeholder migration to replace:**
- `supabase/migrations/20260520120000_seed_placeholder_services_addons.sql` — 10 services, 7 add-ons, all joined cross-product within each property.

**Swap procedure:**

1. Get the real catalog per property from the client. Per service: name, description, display_order. Per add-on: name, description, price, display_order. Per service-addon pair: which add-ons are valid for which service.
2. Write a new migration: `supabase/migrations/<timestamp>_seed_real_catalog_q4.sql`. Sweep the placeholders:
   ```sql
   DELETE FROM service_add_ons WHERE service_id IN (
     SELECT id FROM services WHERE description LIKE 'PLACEHOLDER%'
   );
   DELETE FROM services WHERE description LIKE 'PLACEHOLDER%';
   DELETE FROM add_ons WHERE description LIKE 'PLACEHOLDER%';
   ```
   Then INSERT the real rows.
3. Apply via `supabase db push`.
4. The funnel auto-picks up the new catalog — `getPublicServicesForProperty` in `src/services/public/services.ts` is purely data-driven.

**Note:** the trigger `check_service_add_on_property` enforces that a `service_add_ons` row joins a service and add-on at the same `property_id`. The placeholder cross-product migration already honors this; the real seed must too.

---

## Q5 — Pricing formula

**Affects:** `pricing_rules`

**Placeholder migrations to replace:**
- `supabase/migrations/20260520140000_seed_placeholder_pricing_rules.sql` — public-audience rules for all three properties: `private_lesson $200/hr` (confirmed), `plan_a_visit` tiered ($150 / $130 / $125 per person — placeholder), `host_an_occasion` team-quoted (`minimum_fee=2000` placeholder).
- `supabase/migrations/20260520150000_add_per_guest_fee_to_pricing.sql` — adds `per_guest_fee` column ($50/extra guest on private_lesson — placeholder).

**Swap procedure:**

1. Get the real pricing model from the client. For each (booking_type, property) tuple: flat-rate hourly? Tiered by group size? Team-quoted only?
2. Possibly schema changes if the current `pricing_rules` shape doesn't fit (today: `rate_per_hour numeric`, `tiers jsonb`, `minimum_fee numeric`, `per_guest_fee numeric`). If a new column is needed, add it via `ALTER TABLE` in the swap migration.
3. Write a new migration: `supabase/migrations/<timestamp>_seed_real_pricing_q5.sql`. Sweep the placeholders by selectively replacing rows or by `DELETE FROM pricing_rules WHERE ...` then INSERT.
4. Apply via `supabase db push`.
5. **Verify the math on the funnel.** The pricing service `src/services/public/pricing.ts` exports a pure `buildBookingSummary(args)` function that consumes the model. If the new pricing model shape requires a code change to that function, update it AND update the call sites in `<BookingBuilder>` and `<DetailsForm>` (both consume the same view-model — single change point).

**Where the math lives in TS:**
- `src/services/public/pricing.ts` — `PricingModel` discriminated union + `buildBookingSummary()`. Single source of truth; the estimate bar in `<BookingBuilder>` and the right rail in `<BookingSummary>` both call this.
- `computeMaxGuestCount(type, model)` — used by the guest stepper to clamp max guests against the pricing model's tiers.

If Q5 introduces a new pricing dimension (e.g., per-discipline pricing, time-of-day pricing, partner-discount tiers), add a new `PricingModel` variant — `O — Open/Closed` per CLAUDE.md: extend by adding a branch, don't modify the existing ones.

---

## Other placeholders not tied to Q2/Q4/Q5

- **`from_email = no-reply@rhythm.local`** in `src/services/notifications/send-email.ts` — App 8 swaps this to the real Resend verified sender when DNS work lands.
- **`NEXT_PUBLIC_SITE_URL = http://localhost:3000`** default — production Vercel deploy must set this to the canonical host (e.g. `https://rhythm.co` or whatever the public domain ends up being).
- **`max_concurrent_groups = 1`** in `properties` (Phase 1 seed) — Q2 may indicate higher concurrent-group capacities at HSB or Hog Heaven. Admin-editable post-launch; today an `UPDATE properties SET max_concurrent_groups = 3 WHERE slug = 'horseshoe-bay';`.

---

## Verification after any swap

After landing a Q2/Q4/Q5 swap migration:

1. Re-run the relevant subset of the P-pack from `docs/manual-testing.md`:
   - Q2 → P1, P2, P4 (slot picker offers the real slots; capacity rejection still works)
   - Q4 → P1, P2 (catalog populates correctly; discipline picker shows real services)
   - Q5 → P1, P2, P3 (estimate math matches real formula)
2. Confirm no `PLACEHOLDER` rows leak:
   ```sql
   SELECT 'services' AS table, COUNT(*) FROM services WHERE description LIKE 'PLACEHOLDER%'
   UNION ALL
   SELECT 'add_ons', COUNT(*) FROM add_ons WHERE description LIKE 'PLACEHOLDER%'
   UNION ALL
   SELECT 'instructors', COUNT(*) FROM instructors WHERE name LIKE 'PLACEHOLDER%';
   -- all three counts should be 0 after the final swap migration lands
   ```
3. Update `TRACKER.md`'s "Pending Seeds" table — strike through the row for the Q that just landed.

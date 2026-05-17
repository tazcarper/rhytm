# Rhythm Outdoors — Open Questions

Questions that need answers before the relevant part of the build can be finalized.

---

## Auth

### Q1 — HSB member roster email coverage
**Context:** The recommended production auth for the member portal is email + magic link (passwordless). This requires an email address on file for every member.
- Does the HSB master roster (the Excel file in Google Drive) have an email address for every member, or close to it?
- Are there any members who would genuinely be unable to receive email and need a different login path?

**Blocks:** Member portal auth design, Supabase user seeding strategy.

---

## Inventory & Resources

### Q2 — Instructor headcount at HSB
**Context:** The recommended availability model is instructor-centric — instructors are the scarce resource, and a time slot is "taken" when an instructor is booked. The number of instructors determines the real capacity of the system.
- How many instructors does HSB currently have on staff?

**Blocks:** Availability model complexity, whether a simple `instructor_id + time_slot` uniqueness constraint is sufficient or whether shift/capacity modeling is needed.

### Q3 — Self-guided bookings (no instructor)
**Context:** If some bookings are self-guided (guests use the range without an instructor), those bookings don't consume an instructor slot but may still consume range capacity. This changes whether range needs hard availability enforcement from day one.
- Is there a scenario where a group books the range without an instructor — self-guided shooting, walk-on access, etc.?

**Blocks:** Whether range becomes a hard-constrained resource alongside instructors, or remains a soft field assigned by the team post-booking.

### Q4 — Full service/discipline catalog per property
**Context:** The HSB booking form shows multi-select disciplines (Sporting Clays, Helice, Shooting Deck 5-Stand, Flurry, Wobble Deck, Pistol Bays, Suppressed Rifle, Mixed). These vary by property — Hog Heaven and Packsaddle will have different offerings. The full list for each property is needed to seed the `services` table and build the intake forms correctly.
- What is the complete list of bookable disciplines/services for Hog Heaven Sporting Club?
- What is the complete list for Packsaddle Precision?
- Are there any disciplines at HSB missing from what's shown in the current intake form?

**Note from screenshots:** The HSB SKU list already exists in Google Drive — pull from there as the starting point.

**Blocks:** `services` table seed data, intake form options per property, pricing rules coverage.

---

## Pricing

### Q5 — Pricing formula per service
**Context:** The intake form shows a live estimated price (e.g., $710) that updates as a guest selects disciplines and guest count. The `pricing_rules` table in Supabase needs to encode this formula exactly. The two most common structures are: (A) flat per-person rate per discipline regardless of group size, or (B) tiered rates that change at group size thresholds (e.g., a different per-person rate for 1–5 vs 6–10 guests). The HSB Pricing Schema narrative in Google Drive is the likely source — but the formula needs to be explicitly defined and agreed on before the pricing engine can be built, because changing it later means rebuilding the calculation logic.
- Does the per-person rate change based on group size (e.g., cheaper per head for larger groups)?
- Is there a minimum booking fee regardless of guest count?
- Are multi-discipline bookings priced as a sum of individual disciplines, or is there a package/bundle discount?
- Do member rates work as a fixed discount (e.g., 15% off public rate) or as a completely separate rate card?
- Does partner pricing work the same way — fixed discount off public, or a separate negotiated rate per service per partner?

**Blocks:** `pricing_rules` table schema, live price calculation logic in the intake form, the confirmed_price field on the bid, and the internal pricing admin UI.

---

## Bid Workflow

### Q6 — When does the guest receive their bid URL?
**Context:** Two paths are possible. (A) The form submission immediately creates a draft bid and the guest's confirmation email contains their bid URL — the page exists but shows a "being prepared" state until the team publishes it. (B) The form creates an inquiry only; the team assembles the bid and sends the URL as a second email once it's ready. Option B is recommended because the confirmed price, gear list, map, and FAQ are all team-assembled — sending an incomplete URL first risks a poor first impression. But Option A feels more instant and modern. This is a brand and operations decision as much as a technical one.
- Should the guest receive their bid URL immediately on form submission (draft state), or only once the team has fully assembled and published the bid?

**Blocks:** Inngest workflow sequence design, confirmation email content, bid table `status` initial value, team admin UI flow.

### Q7 — Bid expiry and 48-hour follow-up mechanism
**Context:** The vision specifies automated nudge at 24 hours unsigned, human follow-up at 48 hours. Two open decisions: (1) Auto-expiry — does an unsigned bid become void after a set period (e.g., 7 days), freeing the instructor slot for other bookings? Without expiry, instructor availability is held indefinitely by unsigned bids. Recommended: auto-expire at 7 days with a team warning at day 5. (2) The 48-hour human follow-up — does the system email the responsible team member, create a HubSpot task, or surface a flag in the admin UI? Recommended: HubSpot task assigned to the concierge who owns the deal, keeping follow-up traceable in the CRM.
- Should unsigned bids auto-expire, and if so after how many days?
- How should the 48-hour human follow-up be surfaced — email to the team, HubSpot task, admin UI flag, or some combination?

**Blocks:** Inngest reminder workflow design, instructor availability release logic, HubSpot webhook event list.

---

## Membership Application

### Q8 — Human approval step
**Context:** The system can either (A) automatically grant membership the moment payment clears, or (B) keep a human approval step where the team reviews the application and clicks approve before membership is granted. Option B is recommended — sporting club membership is relationship-driven and selective; automating approval fully feels off-brand. The paperwork burden is eliminated either way; the question is whether the team retains the final yes.
- Should membership require manual team approval after the application and payment are submitted, or should payment alone trigger membership being granted?

**Blocks:** Inngest membership workflow design, admin UI approval action, member portal invite timing.

### Q9 — Membership tiers and initiation fees
**Context:** The vision references membership tiers and preferred pricing that surfaces automatically by tier. If different tiers exist (e.g., Individual, Household, Corporate, Platinum) they likely have different initiation fees, different annual dues, and different portal access levels. The application form needs to present the correct tier and price, and the `members` table needs a `tier` field that drives pricing and access rules.
- What membership tiers exist at HSB?
- Does each tier have a different initiation fee and/or annual dues?
- Do tiers affect what programming or pricing a member can access in the portal?

**Blocks:** `members` table schema, `pricing_rules` member discount logic, application form tier selection, Stripe payment amount.

### Q10 — Household membership structure
**Context:** The vision mentions household records appearing alongside a member when they log in, and household RSVP for member adventures. A household membership likely covers a primary member plus named household members (spouse, children). Each household member may need their own portal access (their own login) or may be visible only through the primary member's account.
- Does a membership cover a household, and if so how many people?
- Do household members get their own login to the member portal, or do they access through the primary member's account?
- How are household members added — at application time, or can they be added later?

**Blocks:** `households` and `household_members` table design, Supabase Auth invite logic for secondary members, RSVP data model for member adventures.

---

## Domain & Property Structure

### Q11 — Packsaddle Precision membership
**Context:** HSB has membership. Hog Heaven has membership (with a different structure from HSB). Packsaddle's membership status is unknown. If Packsaddle has members, it needs its own member portal, its own tier structure, and its own roster seeding. If it doesn't, the member portal work is scoped to HSB and Hog Heaven only.
- Does Packsaddle Precision have a membership program, and if so how is it structured?

**Blocks:** Member portal scope (two properties vs. three), `members` table property coverage, domain routing plan.

---

## Member Adventures

### Q14 — Adventure RSVP payment and cancellation policy
**Context:** When a member RSVPs to a multi-day adventure or exclusive event, the system needs to know what to charge at the time of RSVP and what happens if they cancel. There are two common models: (A) Deposit only at RSVP — the member pays a partial amount (e.g., $250) to hold their spot, with the remainder due closer to the event date. This requires a second payment step. (B) Full payment at RSVP — simpler, one Stripe charge, no follow-up billing needed. Cancellation policy matters because it determines whether a refund is issued automatically or handled manually — and whether the spot reopens for a waitlisted member.
- When a member RSVPs to an adventure, do they pay a deposit to hold their spot, or full payment upfront?
- If a member cancels their RSVP, are they entitled to a refund, and under what conditions (e.g., full refund if cancelled 30+ days out, no refund inside 14 days)?
- If a spot opens due to cancellation, does it automatically become available to waitlisted members?

**Blocks:** Stripe charge logic at RSVP time, whether a second payment workflow is needed, cancellation/refund automation in Inngest, waitlist promotion logic.

---

## Admin & Roles

### Q12 — Membership coordinator scope
**Context:** Georgia is the named membership coordinator. The question is whether she manages memberships across all properties (one person, all rosters) or whether membership management is handled by different people at each property. This determines whether the `membership_coordinator` role is cross-property by default or scoped per property like the GM role.
- Does Georgia manage memberships for all properties, or is each property's membership managed separately by different staff?

**Blocks:** Role-based access control for membership records, Supabase RLS policy scope for membership_coordinator role.

### Q15 — Pre-event communication sequence
**Context:** Once a booking is confirmed (signed + deposit paid), the system sends automated emails as the event approaches. A sensible default sequence is: T-14 days (gear list, directions, what to expect), T-3 days (reminder, weather, parking), T-1 day (final confirmation, who to ask for, arrival time), T+1 day (post-event follow-up). The post-event email is the highest-leverage conversion moment — a well-timed message the day after a great experience is the natural place to invite a public guest to apply for membership. Two decisions needed: (1) whether the default sequence above is acceptable or the team wants a different cadence, and (2) whether the post-event email for public guests explicitly includes a link to the membership application.
- Is the proposed reminder schedule (T-14, T-3, T-1, T+1) acceptable, or does the team want a different cadence?
- Should the post-event follow-up email for public guests include a direct link to the membership application to convert satisfied guests into members?

**Blocks:** Inngest post-confirmation workflow design, Resend email template count, membership application conversion funnel.

### Q16 — Annual dues and recurring billing
**Context:** The vision document covers initiation dues (paid once at application) but is silent on annual membership dues. Sporting clubs almost always charge ongoing annual or monthly dues in addition to the initiation fee. If Rhythm charges annual dues, the system needs to handle recurring billing — either via Stripe Subscriptions (fully automated, card charged automatically at renewal) or Stripe Invoices (a payment link sent to the member at renewal time, they pay manually). Automated renewals are cleaner operationally but require the member's card to stay on file. Manual invoicing gives the team a touchpoint each year but creates a collection task. If dues aren't automated today, this is also an opportunity to eliminate another manual process.
- Does HSB (and Hog Heaven) charge annual membership dues in addition to the initiation fee?
- If yes, how are dues currently collected — invoice, check, card on file?
- Should the system automate annual renewal billing via Stripe, or send the member a payment link each year to pay manually?
- Does a member lose portal access if dues lapse, and if so after how long?

**Blocks:** Stripe Subscription vs Invoice setup, member status field logic (active/lapsed/suspended), Inngest renewal reminder workflow, whether card-on-file storage is required at application time.

### Q13 — Read-only reporting role
**Context:** The COO, CEO, and potentially the founder in a non-editing context may need a dashboard view showing bookings, revenue, and membership numbers across all properties — without the ability to edit any records. This is a common executive need and a distinct access pattern from the operational roles above.
- Does anyone on the team need a read-only reporting view across all properties (bookings, revenue, membership counts)?
- If so, who — COO, CEO, investors, or others?

**Blocks:** Role table completeness, whether a reporting/analytics dashboard is in scope for the initial build.

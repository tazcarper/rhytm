# Accounting & Operations Wins — Business-Value Feature Analysis

**Product-strategy analysis · 2026-07-08 · branch `big-future-planning`**

Grounded in `plan/hospitality-template-research.md` (the deep hospitality-template
research) and the current state of the Rhythm Outdoors app. Framed from an
owner/operator perspective: what features would help this business *run*, with an
emphasis on the accounting/financial visibility the app lacks today.

---

## The reframe: the app only sees a slice of the money

The headline finding, because it reframes everything else: **the app currently sees
only a fraction of the business's revenue.**

- It collects **deposits** online (Stripe PaymentIntents + Payment Element).
- The **remaining balance is settled on a separate card reader / POS on property**
  — that revenue never reconciles with the booking in the app.
- **Membership dues** are collected by some means we haven't confirmed with the client.
- There is **no reporting/analytics layer at all** (the admin dashboard is operational
  — next-24h schedule + pending counts — not analytical; verified in research §0.6).

So before "accounting features," the real project is **making the app the financial
system of record.** Otherwise every report we build is a report on *deposits*, not on
the *business*.

### Client answers captured (2026-07-08)

| Question | Answer |
|---|---|
| How are instructors paid? | **Hourly for booked time** |
| How is the balance collected after the online deposit? | **Card reader / POS on site** |
| Where do the books live / what accounting software? | **Don't know — must ask client** |
| How are membership dues collected? | **Don't know yet — must ask client** |

---

## Tier 1 — Accounting & money (the core gap)

### 1. Close the balance-due blind spot  ⭐ most important
Today a $4,000 occasion may appear as a $500 deposit in the app while $3,500 sits on a
Square/terminal that never reconciles with the booking. Options in ascending ambition:

- **Minimum:** a "settle balance" action on the booking where staff record what was
  collected on property (amount + method). The app now knows *actual* revenue per event.
- **Better:** a "pay remaining balance" link on the existing bid page — guest pays by
  card before/after the visit. Reuses the existing Stripe + webhook + idempotency
  machinery (same pipe as the deposit).
- **Best:** Stripe Terminal on property so on-site card payments land in the same Stripe
  account and reconcile automatically.

Blast radius: payments, schema (a `payments`/settlement record), bid page, admin.

### 2. Instructor timesheet report  ⭐ quick win
Instructors are paid **hourly for booked time**, and every booking already stores
instructor, start time, and duration. A per-pay-period report:
- Hours booked per instructor, broken out by property and lesson type.
- Excludes cancelled/released bookings.
- CSV export for whoever runs payroll.

**Follow-up for client:** paid on *booked* hours or *delivered* hours (no-shows /
cancellations)? If delivered, we need a "session completed" confirmation step.

Blast radius: admin read-only + a service query. No schema (unless "delivered hours").

### 3. Revenue reporting dashboard + CSV export  ⭐ quick win
Research confirms operators across every vertical check ~5 numbers (§1.6):
- Revenue by period / property
- Bookings by type
- Utilization vs. capacity
- Bid conversion funnel (sent → signed → paid)
- Year-over-year

All computable from existing tables today. Already planned as Phase 4 of
`DASHBOARD_MIGRATION.md` (Tremor charts). Every report gets a **CSV export** — works
with QuickBooks, an accountant, or Excel equally until we learn where the books live.

Blast radius: admin read-only; no schema beyond views.

### 4. Discount-leakage report
Staff comp/waive line items on bids; every override is already audit-logged in
`bid_pricing_events`. Nobody can currently answer "how much did we give away last
quarter, and who gave it away?" The data exists — this is a report, not a feature.

Blast radius: admin read-only.

### 5. Sales tax
Line items carry a taxable/exempt flag (`bid_line_items.tax_status`) but nothing
computes tax. In Texas this is a real liability (research flags the §151.0048 bundling
trap). Cheapest path: wire **Stripe Tax** for amounts collected in-app. **Needs a client
conversation first** (see questions).

Blast radius: payments, line items.

### 6. Membership dues billing
Pending the client's answer. If dues aren't already automated, this is likely the
**largest recurring revenue stream being chased by hand.** The membership data model
(`people` + `memberships` + `membership_people`) is already ahead of commercial club
software; what's missing:
- Dues amount on the membership
- Stripe **subscription** billing
- Renewal reminders
- Failed-payment retry / dunning (industry loses ~9% of recurring revenue to failed
  cards; smart retries recover most — research §1.4)

Blast radius: payments (subscriptions), schema, member portal. Larger effort (L).

---

## Tier 2 — Operations wins

### 7. Speed-to-lead follow-up on estimate requests
Venue research: median reply time is **11 hours**; conversion drops from **32%** (reply
< 1 min) to **4%** (reply > 24 hrs). The app already alerts *staff* — add:
- An **auto-reply to the guest** ("we got it, here's what's next").
- An **aging indicator** in admin ("this inquiry has waited 6 hours").

Cheap, and it directly converts inquiries into the deposits everything else counts.

### 8. Payment schedules for big occasions
Deposit now → saved card → auto-charge the balance N days before the event. Pairs with
#1 (for a 100-person occasion, "settle on property" is a lot riding on the day). Extends
the existing webhook/idempotency plumbing rather than replacing it.

### 9. Daily manifest / day sheet
A printable "today at this property" view: every booking, guest names, party size,
instructor, add-ons, waiver-signed status, balance owed. The dashboard shows the next 24h
operationally, but ops staff and instructors need the morning-meeting sheet (paper/iPad).

### 10. Cancellation policy engine
Refunds are currently ad-hoc admin judgment calls. A simple **days-out → refund-%** policy
per experience type makes refunds consistent, defensible, and delegable to any staff
member — and it's the prerequisite for guest self-service cancellation later. (Adventures
already have a `free_cancellation_days` seed to build from.)

### 11. Waitlists on core bookings
Adventures already have waitlist + "spot opened" claim emails; regular bookings don't.
When a Saturday is full, that demand currently evaporates.

### 12. Abandoned-booking recovery
~70% of started checkouts abandon industry-wide; a single "finish your booking" email at
+8 hours recovers a meaningful slice. One Inngest function + one email template.

---

## Tier 3 — Growth (after the above)

- **13. Promo codes** — zero discount capability exists; standard tool for filling slow
  weekdays / off-season.
- **14. Gift cards** — real revenue (~6% never redeemed), but **integrate (Gift Up)**
  rather than build; in-house means owning deferred-revenue (ASC-606) accounting.
- **15. SMS reminders** — day-before texts cut no-shows; the `EmailService` seam makes
  adding a message channel straightforward.
- **16. Review requests** — the post-event email already exists; adding a Google-review
  deep link is nearly free.

---

## Questions to put in front of the client

In priority order — these unlock the most:

1. **"Walk me through what happens to the money after the guest's deposit."** Who
   collects the balance, on what device, into what account, and who reconciles it against
   the booking? (Determines #1's shape.)
2. **"Who does your books, and in what software?"** QuickBooks vs. an accountant vs.
   spreadsheets decides export formats and whether tax lives in-app.
3. **"How do members pay dues today, and what are the tiers/amounts?"** Already an open
   client question in the tracker; gates #6.
4. **"Are instructors paid on booked hours or delivered hours, and what's the pay
   period?"** Gates the exact shape of #2.

---

## Recommended build order

1. **#2 Instructor timesheet** and **#3 Reporting dashboard** — quick wins. Pure reads on
   existing data, no schema risk. They make the app feel like a business tool overnight.
2. **#1 Balance settlement** — the most important, but wants the client's answer to
   question 1 first.
3. Then Tier 2 ops wins and #6 dues billing as the client answers land.

# Rhythm Outdoors — Questions

Before we can finalize key parts of the build, we need your input on the decisions below. None of these require technical knowledge — they're all business and operations questions only you can answer.

---

## Logins & Access

**Q1 — Member email coverage**
We plan to have members log in using a temporary link sent to their email (no password needed). This only works if every member has an email address on file.

- Does the HSB member roster have an email address for every member, or close to it?
- Are there any members who genuinely can't receive email and would need a different way to log in?

---

## Bookings & Scheduling

**Q2 — How availability works**

This is the most important question in the whole document, because the answer determines how the booking calendar is built. When a guest looks at a 9 AM slot and sees it as "open," what actually makes it open? That depends on the guest's party size — a group of 10 needs more resources than a group of 2, so we need party size before we can show availability. The form would ask for party size first, then show what's actually open for that group.

What we need to decide is: what are the constraints that make a slot unavailable? We see a few realistic options — we'd like you to tell us which best matches how HSB actually operates, or describe how it works if none of these fit:

- **Option A — Instructors only:** A slot is open as long as at least one instructor is free. Bays and stations are assumed to be plentiful and not a hard limit. Simplest to manage — your instructor count is the one number that controls everything.

- **Option B — Bays/stations only:** A slot is open as long as at least one bay or station is free. Instructor availability is not tracked by the system — the team assigns instructors internally after a booking comes in.

- **Option C — Both, linked to party size:** The system checks both. A guest enters their party size, and the system figures out how many instructors and how many bays are needed for that group. A slot is only shown as open if enough of both are free. Most accurate, but requires us to know a few ratios upfront (see questions below).

- **Option D — Manual slots (most human labor):** The team creates and manages time slots themselves — no automatic calculation. Staff sets a number like "Monday 9 AM has 3 spots available" and the system fills those. Full control, no math, but more ongoing admin work.

To help us understand which option fits (and to build Option C if that's the right one), we also need:

- How many instructors does HSB have on staff?
- How many bays, ranges, or stations are available at each property?
- Is there a ratio for instructor-to-guest coverage (e.g., one instructor per 4 guests, one instructor per group regardless of size)?
- Can multiple groups be using different parts of the property at the same time (e.g., one group on Sporting Clays while another is on Pistol Bays? Or is that two reservations?)?
- What is a typical session length — is there a standard block (e.g., 2 hours, half-day, full day), or does it vary by discipline?

**Q3 — Self-guided bookings**
- Is there ever a scenario where a group books the range without an instructor — self-guided shooting, walk-on access, or similar?
- If so, does that still need to go through the booking system, or is it handled informally? Is it an option when booking?

**Q4 — Full list of bookable services per property**
We need the complete list of disciplines, services, and add-ons available at each property to set up the booking form correctly. The HSB SKU list in Google Drive is a good starting point.

- What is the complete list of bookable disciplines/services for **Hog Heaven Sporting Club**?
- What is the complete list for **Packsaddle Precision**?
- For each discipline, are there add-ons a guest can select (e.g., ammunition, equipment rental, instruction upgrades)? A full list of those per discipline would be helpful.

---

## Pricing

**Q5 — How pricing works**

The booking form shows a live estimated price that updates as guests select disciplines and guest count. We need to understand exactly how that price is calculated.

- Does the per-person rate change based on group size (e.g., a lower per-person rate for larger groups)?
- Is there a minimum booking fee regardless of how many guests?
- When someone books multiple disciplines, is the price simply the sum of each, or is there a package/bundle discount?
- Do member rates work as a percentage off the public rate, or is there a completely separate price list for members?
- Does partner pricing work the same way — a discount off public — or is it negotiated separately per service?

---

## The Booking Bid

**Q6 — When does the guest get their bid link?**

After a guest submits the booking form, there are two options for when they receive their personalized bid link:

- **Option A (Immediate):** They get the link right away in their confirmation email. The bid page shows a "being prepared" message until the team fills it in.
- **Option B (When ready):** The team assembles the bid first, then sends the link in a second email once it's complete.


- Which option do you prefer?

**Q7 — Bid expiry and follow-up**

Two decisions here:

1. If a guest doesn't sign their bid, should it automatically expire after a set number of days (freeing up the instructor slot for other bookings)? We'd recommend 7 days, with a warning to your team at day 5.
2. When a bid has been unsigned for 48 hours, how should your team be notified to follow up — an email to the relevant team member, a task in HubSpot, a flag in the admin dashboard, or some combination?

---

## Membership Applications

**Q8 — Does the team approve new members?**

Two options:

- **Option A:** Payment alone triggers membership being granted automatically.
- **Option B:** The team reviews the application and clicks approve after payment — membership is granted only once someone on the team signs off.

We recommend Option B — sporting club membership is relationship-driven and fully automating approval feels off-brand. But you decide.

**Q9 — Membership tiers**

- What membership tiers exist at HSB (e.g., Individual, Household, Corporate, Platinum)?
- Does each tier have a different initiation fee and/or annual dues?
- Do tiers affect what events, programming, or pricing a member can access?

**Q10 — Household memberships**

- Does a membership cover a household? If so, how many people?
- Do household members each get their own login to the member portal, or do they access everything through the primary member's account?
- Are household members added at sign-up, or can they be added later?

---

## Properties

**Q11 — Does Packsaddle Precision have a membership program?**

- If yes, how is it structured? (We'll need to set up a separate member portal and roster for it.)
- If no, member portal work will be scoped to HSB and Hog Heaven only.

---

## Member Adventures

**Q14 — RSVP payment and cancellation**

When a member RSVPs to a multi-day adventure or exclusive event:

- Do they pay a deposit to hold their spot, or full payment upfront?
- If they cancel, are they entitled to a refund? Under what conditions (e.g., full refund if cancelled 30+ days out, no refund inside 14 days)?
- If a spot opens due to a cancellation, should it automatically become available to the next person on the waitlist?

---

## Staff & Roles

**Q12 — Georgia's scope**
- Does Georgia manage memberships across all properties, or is each property's membership handled by different staff?

**Q13 — Executive reporting access**
- Does anyone (COO, CEO, founder, investors) need a read-only view of bookings, revenue, and membership numbers across all properties?
- If so, who?

**Q15 — Pre-event email cadence**

Once a booking is confirmed, we'd send automated emails as the event approaches. Here's the default schedule we'd propose:

| Timing | Content |
|--------|---------|
| 14 days before | Gear list, directions, what to expect |
| 3 days before | Reminder, weather (dynamic maybe out of scope), parking |
| 1 day before | Final confirmation, who to ask for, arrival time |
| 1 day after | Post-event follow-up |

- Is this cadence acceptable, or would you like something different?
- For public guests (non-members), should the post-event email include a direct link to apply for membership?

---

*Please feel free to answer in whatever order is easiest. Even partial answers on any question help us move forward.*

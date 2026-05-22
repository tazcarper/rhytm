# App 2 — Client Walkthrough

A guided tour of the public booking flow, written for the client. Should take ~6 minutes end-to-end.

**What you're seeing.** This is the first working version of the public-facing booking experience. Visitors land on it without signing in — exactly as a guest planning a visit would. The catalog (disciplines, add-ons, instructors), operating hours, and pricing are all **placeholder data** seeded so the flow can be exercised. We'll swap in real values once the open questions (Q2 operating hours, Q4 discipline catalog, Q5 pricing) land — none of that touches the UI, just the data tables behind it.

**What to look for as you click.** You're the first set of eyes from the brand side. The questions to keep in mind:
- Does the language feel like Rhythm Outdoors? (We can rewrite any copy.)
- Does each step feel like one decision, not three?
- Where do you feel friction? (Confusing layout, missing context, "what does this mean?")
- Any places that feel more "form-y" than "experience-y"?

**Where to log feedback.** Anything you notice — typos, copy critiques, UX concerns, ideas — leave it in `docs/app-2-client-feedback.md`. There's a template at the top. Don't worry about formatting — we'll triage everything into fix-now / fix-in-App-3 / defer.

---

## Setup

You'll be visiting a Vercel preview URL — Taz will send it. The preview reflects the latest committed state of the codebase.

You don't need to log in. The booking flow is the same path a future guest will take.

---

## The walkthrough

Take it slow. We've timed it at ~6 minutes if you click through; budget 15–20 if you're actively noticing things.

### 1. Land on the homepage

Open the preview URL. You should see:
- The Rhythm Outdoors wordmark at the top
- Three property cards: **Horseshoe Bay Sporting Club**, **Hog Heaven Sporting Club**, **Packsaddle Precision**
- A subtle tagline under each — distinct per property (not all "premier shooting destination")

**Things to notice:** does the property naming hierarchy feel right? Brand wordmark first, property cards as equal peers below? Or should one property lead?

### 2. Pick Horseshoe Bay

Click **Horseshoe Bay Sporting Club**. You should land on a page asking "What kind of visit are you planning?" with three booking-type cards:
- **Plan a Visit** — for general sporting clays / disciplines
- **Private Lesson** — one-on-one instruction
- **Host an Occasion** — exclusive use of the property

**Things to notice:** Are these the right three categories? Are the descriptions on each card the right framing? The "Host an Occasion" card carries an "exclusive use" notice — is that prominent enough?

### 3. Click **Plan a Visit**

You land on the combined builder page. There are four sections, top to bottom:
1. **Pick what you'd like to do** — discipline cards (Sporting Clays, Helice, etc.). Click to select; click again to deselect. Once selected, the card expands and shows add-ons (Ammunition Pack, Drink Cart, Instructor Upgrade) with quantity steppers.
2. **How many in your party?** — a guest stepper
3. **When?** — a calendar (with available dates) and a time-slot grid
4. **Estimate Total** at the bottom updates as you go

Try selecting **Sporting Clays** + **Drink Cart × 2**, 4 guests, tomorrow at 9 AM.

**Things to notice:**
- All this is placeholder catalog — "Sporting Clays", "Helice", "Wobble Deck" might not all be real HSB offerings. We'll swap them to match your real catalog when Q4 lands.
- Add-on prices are placeholder. We'll swap them.
- The Estimate Total math is placeholder ($150/$130/$110 per person tiers). Real formula comes with Q5.
- The slot picker shows 9 AM / 11 AM / 1 PM / 3 PM — also placeholder until Q2 (your real operating hours) lands.

### 4. Continue to details

Click **Continue**. You're on a guest-info form (Name, Email, Phone, optional Notes) with a sticky **booking summary** on the right rail showing your selections + total.

**Things to notice:**
- Is the right rail summary the right info? Anything missing? Anything you'd phrase differently?
- The notes field — is "Anything else? (optional)" the right invitation, or should it be more directive ("Tell us about your group", "Accessibility needs", etc.)?

### 5. Submit

Fill it in with throwaway info (any email is fine — `you+demo@example.com` works) and submit.

You should redirect to a **bid page** at `/bids/<slug>/<code>`. The page shows a "pending review" status — your bid is being prepared. This is the screen the guest sees right after submission. In real operation, our team would then review and confirm the bid, at which point the page would unlock the full schedule + signature + deposit sections.

**Things to notice:**
- Is the "pending review" copy the right reassurance? Does it set the right expectation for response time?
- The page is bookmark-able — the guest can come back to it. Does the URL feel awkward, or fine?
- Bookmark the bid URL — we'll use it in step 7.

### 6. Backtrack

Hit your browser **Back** button twice. You should return all the way to the booking-type picker with your prior selections still highlighted (Plan a Visit card has a thicker border). Forward through the funnel again — every selection should still be intact.

**Things to notice:**
- Back-nav feels natural? Or does anything reset that shouldn't?
- (Aside: refreshing the page mid-funnel deliberately resets to step 1 — that's a privacy / freshness tradeoff; no cookie or browser storage holds in-progress bookings.)

### 7. Try the bid URL with a wrong code

In a new tab, open the bid URL you bookmarked, but change the last segment (the access code after the slug) to anything garbage. You should get a 404.

**Things to notice:**
- The 404 is intentional — the bid URL is the only key. Anyone with the link can view; nobody else can guess at it.
- This is the design tradeoff: simple URL the guest can bookmark + share with their group, no login required, but slug-only URLs without the code don't work.

### 8. (Optional) Try the other booking types

Walk through **Private Lesson** at Packsaddle and **Host an Occasion** at Hog Heaven to see the variations:
- Private Lesson auto-assigns an instructor (placeholder names today — Jordan Vance at Packsaddle)
- Host an Occasion has no discipline picker (exclusive-use bookings work differently) and shows "Team-quoted" instead of a number (the price is custom)

---

## What's not in this build yet

Things that are deliberately scoped out of App 2 — these come in later phases:

- **Deposit payment** — the bid page has a placeholder slot for Stripe; App 6 wires it.
- **E-signature** — same, placeholder for Dropbox Sign; App 7 wires it.
- **Real confirmation email** — today a confirmation email is written to a developer review queue (visible at `/dev/emails` if you want to peek) instead of being sent through Resend. App 8 swaps the transport. The template + content is final-ish; the delivery isn't.
- **Available-slot filter on the calendar** — today the calendar offers every slot even if it's already booked; if you and a guest both try to book the same slot, the second submission fails cleanly with a friendly message. The filter that hides booked slots in the picker is planned pre-launch.
- **Admin portal** — when bookings come in, our team will review them in `/admin`. That's App 3.

---

## After your walkthrough

Drop notes into `docs/app-2-client-feedback.md`. Anything goes — typos, "this word feels off", "I wanted to upload a photo of my group", "the date format is wrong". We'll triage every item.

Sign-off: when you're satisfied, drop a line in the feedback file or email — "good to go on App 2." That flips App 2 to ✅ in our internal tracker and unblocks Apps 3–8 (admin portal, payments, e-sign, real email, etc.).

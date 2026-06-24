# Phase F — Runtime Test Checklist

Manual end-to-end verification for the request-estimate → bid integration
(`plan/request-estimate-bid-integration.md` §10 Phase F). Run against a local
dev server (`npm run dev`). Static verification (typecheck + build + code trace)
is already done and clean — this is the live click-through.

For each step: **do** → **expected (pass)** → **report if you see a failure sign**.

---

## Pre-flight (do this first)

0. **Confirm `time_slots` exist for the test property.** The lock step validates
   the chosen time against `public.time_slots` for that property + weekday. If the
   property has no active slot at your arrival hour, even the *prefilled* lock is
   rejected.
   - Pick a property whose booking hours are configured, and when you submit,
     choose an arrival hour that is a real listed slot (e.g. 9 AM if 09:00 exists).
   - Start the dev server and note the URL (e.g. `http://localhost:3000`).

---

## Phase E — `/book` is hidden (quick)

| # | Do | Expected (pass) | Failure sign |
|---|----|-----------------|--------------|
| E1 | Open `/`, scroll to final CTA | Button reads **"Request an estimate"**, lands on `/request-estimate` | Says "Plan your visit", or lands on `/book` *(if href is `/book` but code is repointed → fix the DB `homepage_hero` row in `/admin/homepage`)* |
| E2 | Type `/book` in the address bar | Redirects to `/request-estimate` | Old property-picker renders |
| E3 | Type `/book/horseshoe-bay` | Redirects to `/request-estimate` | Type-picker / funnel renders |
| E4 | Type `/book/horseshoe-bay/disciplines` | Redirects to `/request-estimate` | Disciplines step renders |

---

## Phase F — estimate → bid end-to-end

### F1 · Submit an estimate
- **Do:** On `/request-estimate`, pick the test club, choose ≥1 experience, set party
  size, fill name/email/phone, pick a preferred date + a **valid arrival hour**, submit.
- **Pass:** redirects to a bid URL `/bids/<slug>/<code>`.
- **Failure signs:** "We couldn't match that club" (club→slug mismatch), "Please pick
  at least one experience", "This club isn't open for booking yet" (coming-soon), or a 500.

### F2 · Guest bid page — pending
- **Do:** look at the redirected bid page.
- **Pass:** hero shows property + date with a **"pending"** tag next to the time; info
  banner **"Your bid is being prepared"** with your email; status badge "In review";
  **no** signature card, **no** deposit card, no schedule/gear body.
- **Failure signs:** missing "pending" tag, a signature or deposit card showing, a crash.

### F3 · Bid appears in admin
- **Do:** go to `/admin/bids`.
- **Pass:** the new request is at the **top** of the list, status "In review" / pending.
  (Optionally filter to the **Needs review** group — it should show there too.)
- **Failure signs:** not in the list, or only appears under a specific filter.

### F4 · Open the bid + lock & confirm
- **Do:** open the bid detail (`/admin/bids/<id>`).
- **Pass:** primary action reads **"Lock slot & confirm"** (not a bare "Confirm"). Click
  → dialog with **Date** and **Start time** prefilled from the provisional slot. Confirm
  the time is a valid listed slot, then **Lock & confirm**. Dialog closes; bid status → **Confirmed**.
- **Failure signs:**
  - Button says "Confirm" instead of "Lock slot & confirm" → `requiresWaiver`/`bookingStatus` prop mismatch.
  - **"That start time isn't a valid slot for this property"** → slot not in `time_slots` (Pre-flight 0).
  - "That slot just filled / at capacity" → a real double-book conflict.
  - Any other red-alert error → copy it verbatim.

### F5 · Guest bid page — confirmed
- **Do:** reload the guest bid URL from F1.
- **Pass:** badge **"Confirmed"**; time **no longer** "pending"; full body (schedule
  arrive/wrap/duration, gear, FAQ, getting-there); green **"You're all set…"** banner;
  **NO** signature card and **NO** deposit card.
- **Failure signs:** still "pending", a signature/deposit card appears, the "wrap" time
  looks wrong (would mean `end_time` didn't recompute), or no "all set" banner.

---

## Notes
- The **guest-confirmation email** (Inngest `bid/created` → Resend) is best-effort and
  depends on Inngest + Resend being wired locally. No email ≠ a booking-flow failure —
  flag it separately.
- Test data (Booking + Bid + access code) lands in whatever Supabase the local env points
  at. If that's the linked cloud project, these are real rows — use a throwaway email.

## Report back
List which steps passed and paste any failures (exact error text or screenshots). Real
defects get listed, double-checked against the code, and fixed.

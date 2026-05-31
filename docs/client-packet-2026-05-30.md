# Client Packet — 2026-05-30

A single doc bundling everything that needs your input right now: the App 2 walkthrough invitation + six configuration questions across email setup (3) and workflow design (3). Every question has a recommended default — you can reply "go with your rec" on any of them and we keep moving.

**Suggested reply structure:**
1. Walkthrough feedback (log it in `docs/app-2-client-feedback.md` or reply inline — either works)
2. Email config: pick or accept defaults on Q1 / Q2 / Q3
3. Workflow design: pick or accept defaults on Q7 / Q8 / Q15

If you want to push any of these to a call instead of a written reply, just say so.

---

## Part 1 — App 2 walkthrough (the main thing)

The public booking flow is **feature-complete and ready for your first look**. We've been heads-down building from property selection → booking type → date/slot → guest info → confirmation → bid page → e-signature → deposit. End-to-end. You haven't seen any of it yet, and your gut reaction is the most valuable signal we can get before we widen the surface.

**Walkthrough doc with step-by-step:** `docs/app-2-client-walkthrough.md` (in the repo — Taz will share the Vercel preview URL alongside this)

Budget about **15–20 minutes** if you're actively noticing things (6 minutes if you click through fast).

**The five questions to keep in mind as you click:**
1. Does the language feel like Rhythm Outdoors? (We can rewrite any copy.)
2. Does each step feel like one decision, not three?
3. Where do you feel friction?
4. Any places that feel more "form-y" than "experience-y"?
5. Does the property naming hierarchy feel right (Rhythm wordmark first, three properties as peers)?

**Where to log feedback:** `docs/app-2-client-feedback.md`. There's a template at the top. Don't worry about formatting — we'll triage into fix-now / fix-in-App-3 / defer.

---

## Part 2 — Email configuration (App 8 activation, three quick picks)

Background: Resend (the email service) is fully integrated and tested end-to-end. The send goes out from your verified `send.rhythm.co` domain. The three knobs below are the last things we need before flipping production email from "logging to a dev table" to "real customer inbox delivery."

### Q1 — From address

What email address should outbound booking emails come from?

- **`bookings@send.rhythm.co`** ← my recommendation (clear purpose, transactional norm)
- `noreply@send.rhythm.co` (discourages legitimate replies — less warm)
- `hello@send.rhythm.co` (warmer, invites conversation)

**Recommendation:** `bookings@send.rhythm.co`.

### Q2 — Display name in the From header

Should every email say "Rhythm Outdoors", or should it switch per property?

- **"Rhythm Outdoors" for everything** ← my recommendation (simpler; property is named in the email body anyway)
- Branded per property (e.g. "Horseshoe Bay Sporting Club <bookings@…>", "Hog Heaven Sporting Club <bookings@…>")

**Recommendation:** Single "Rhythm Outdoors". The customer just went through that property's booking flow — they know which property they booked.

### Q3 — Reply-to inbox

When a customer hits "Reply" on a booking email, where should it go? **Whichever inbox you pick, please confirm someone reads it daily.** A missed reply is often a missed booking.

- `hello@rhythm.co` (Google Workspace, presumably already monitored)
- A specific staff member (concierge / ops lead)
- A shared inbox you already monitor (e.g. `bookings@rhythm.co`, `concierge@rhythm.co`)

**Recommendation:** Whichever inbox is already part of someone's daily routine. Don't create a new address that needs a new habit.

---

## Part 3 — Workflow design (three product-shaping decisions)

These three answers shape automated workflows we'll build next. They're more strategic than the email config above — bigger downstream implications.

### Q7 — Bid auto-expiry and the 48-hour follow-up

Two sub-questions here:

**7a — Should unsigned bids auto-expire?**
Without expiry, an instructor's calendar stays blocked indefinitely by every unsigned bid. The vision called for a 24h reminder + 48h human follow-up; we also need to know when to *release* the slot.

- **Recommendation: auto-expire after 7 days, with a team warning at day 5.** Adjustable per property if needed.

**7b — How should the 48-hour human follow-up surface?**
When a bid is sent but unsigned at 48h, who/how gets prodded?

- Email to the team
- HubSpot task assigned to the concierge who owns the deal ← my recommendation
- Admin UI flag (visible on the bids queue but no push notification)
- Some combination

**Recommendation:** HubSpot task. Keeps follow-up traceable in the CRM you already use; doesn't add another inbox to watch.

### Q8 — Membership approval: manual or automatic?

When someone applies for membership and pays the initiation fee, should the team manually approve, or should payment alone grant membership?

- **Manual team approval after payment** ← my recommendation
- Auto-grant the moment payment clears (faster, but removes the team's final yes)

**Recommendation:** Manual approval. Sporting club membership is relationship-driven; automating it fully feels off-brand. The paperwork burden is eliminated either way — the question is whether the team keeps the final yes.

### Q15 — Pre-event email cadence

Once a booking is confirmed (signed + deposit paid), automated emails go out as the event approaches. Two sub-questions:

**15a — Is this cadence right?**
- **T-14 days** — gear list, directions, what to expect
- **T-3 days** — reminder, weather, parking
- **T-1 day** — final confirmation, who to ask for, arrival time
- **T+1 day** — post-event follow-up

**Recommendation:** This sequence as-is. Easy to adjust per booking type later if needed (e.g., shorter cadence for half-day visits).

**15b — Membership CTA in the post-event email (for public guests only)?**
The day after a great experience is the highest-leverage moment to invite a public guest to apply for membership. Should the T+1 email include a direct link to the application?

- **Yes, include the membership CTA** ← my recommendation
- No — keep post-event purely thank-you (no upsell)

**Recommendation:** Include it, but as a soft secondary CTA below the thank-you, not the lead.

---

## Other open items (not blocking — informational)

We're also sitting on a handful of smaller open questions that aren't blocking today's work but will come up in the next 2–3 weeks. Happy to bundle them into the next packet, or you can browse the full list at `plan/questions/2026-05-24/README.md` if you'd rather knock them out now:

- **W1 / W2** — Waiver document content + whether one template or per-property
- **P1 / P2 / P3** — Per-property booking horizon, max concurrent groups, support email/phone
- **A1 / A2** — Refund-reason visibility to guest + admin sidebar vs. topbar
- **B1 / B2** — "Est. 2026" tagline + placeholder sender copy
- **D1** — Long-term per-property branded subdomains (intake.rhythm.co etc.)
- **Q9 / Q10 / Q11 / Q12 / Q13 / Q14 / Q16** — Membership tiers, household structure, Packsaddle membership scope, coordinator scope, read-only reporting role, adventure RSVP payment/cancellation, annual dues

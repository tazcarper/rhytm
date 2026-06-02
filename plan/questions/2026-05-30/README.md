# Client Questions — 2026-05-30 batch (Client Packet)

Bundled from the 2026-05-30 client packet. Two things need your input: the
**App 2 walkthrough** (the main thing) and **six configuration decisions** —
three on email setup, three on workflow design. Every question has a recommended
default; reply "go with your rec" on any of them and we keep moving.

## Suggested reply structure

1. **Walkthrough feedback** — log it in `docs/app-2-client-feedback.md` or reply inline (either works).
2. **Email config** — pick or accept defaults on Q1 / Q2 / Q3.
3. **Workflow design** — pick or accept defaults on Q7 / Q8 / Q15.

Prefer a call to a written reply on any of these? Just say so.

## Part 1 — App 2 walkthrough (the main thing)

The public booking flow is **feature-complete and ready for your first look** —
property selection → booking type → date/slot → guest info → confirmation → bid
page → e-signature → deposit, end to end. You haven't seen any of it yet, and
your gut reaction is the most valuable signal we can get before we widen the
surface.

- **Walkthrough doc (step-by-step):** `docs/app-2-client-walkthrough.md` — Taz will share the Vercel preview URL alongside it.
- Budget about **15–20 minutes** if you're actively noticing things (6 minutes if you click through fast).

**Five questions to keep in mind as you click:**

1. Does the language feel like Rhythm Outdoors? (We can rewrite any copy.)
2. Does each step feel like one decision, not three?
3. Where do you feel friction?
4. Any places that feel more "form-y" than "experience-y"?
5. Does the property naming hierarchy feel right (Rhythm wordmark first, three properties as peers)?

**Where to log feedback:** `docs/app-2-client-feedback.md` (template at the top).
Don't worry about formatting — we'll triage into fix-now / fix-in-App-3 / defer.

## Other open items (not blocking — informational)

Smaller open questions that aren't blocking today but will come up in the next
2–3 weeks. Happy to bundle them into the next packet, or browse the full list at
`plan/questions/2026-05-24/README.md` to knock them out now:

- **W1 / W2** — Waiver document content + one template or per-property.
- **P1 / P2 / P3** — Per-property booking horizon, max concurrent groups, support email/phone.
- **A1 / A2** — Refund-reason visibility to guest + admin sidebar vs. topbar.
- **B1 / B2** — "Est. 2026" tagline + placeholder sender copy.
- **D1** — Long-term per-property branded subdomains (`intake.rhythm.co`, etc.).
- **Q9–Q14, Q16** — Membership tiers, household structure, Packsaddle membership scope, coordinator scope, read-only reporting role, adventure RSVP payment/cancellation, annual dues.

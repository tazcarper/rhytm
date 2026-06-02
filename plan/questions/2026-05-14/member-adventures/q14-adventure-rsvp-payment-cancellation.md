# Q14 — Adventure RSVP payment and cancellation policy

**Category:** Member Adventures
**Status:** Open · surfaced 2026-05-14
**Blocks:** Stripe charge logic at RSVP time · whether a second payment workflow is needed · cancellation/refund automation in Inngest · waitlist promotion logic

## Context

When a member RSVPs to a multi-day adventure or exclusive event, the system needs
to know what to charge at RSVP and what happens on cancellation. Two common
models: (A) **Deposit only at RSVP** — the member pays a partial amount (e.g.,
$250) to hold their spot, with the remainder due closer to the event (requires a
second payment step). (B) **Full payment at RSVP** — simpler, one Stripe charge,
no follow-up billing. Cancellation policy determines whether a refund is issued
automatically or handled manually — and whether the spot reopens for a
waitlisted member.

## The questions

- When a member RSVPs to an adventure, do they pay a deposit to hold their spot, or full payment upfront?
- If a member cancels their RSVP, are they entitled to a refund, and under what conditions (e.g., full refund if cancelled 30+ days out, no refund inside 14 days)?
- If a spot opens due to cancellation, does it automatically become available to waitlisted members?

## Answer

_(pending)_

# Q6 — When does the guest receive their bid URL?

**Category:** Bid Workflow
**Status:** Open · surfaced 2026-05-14
**Blocks:** Inngest workflow sequence design · confirmation email content · bid table `status` initial value · team admin UI flow

## Context

Two paths are possible:

- **(A) Immediate draft.** The form submission immediately creates a draft bid and the guest's confirmation email contains their bid URL — the page exists but shows a "being prepared" state until the team publishes it. Feels instant and modern.
- **(B) Team-assembled.** The form creates an inquiry only; the team assembles the bid and sends the URL as a second email once it's ready.

Option B is recommended because the confirmed price, gear list, map, and FAQ are
all team-assembled — sending an incomplete URL first risks a poor first
impression. This is a brand and operations decision as much as a technical one.

## The question

- Should the guest receive their bid URL immediately on form submission (draft state), or only once the team has fully assembled and published the bid?

## Answer

_(pending)_

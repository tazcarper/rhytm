# P2 — Max concurrent groups per property

**Category:** Property configuration
**Status:** Open · surfaced 2026-05-24
**Blocks:** `properties.max_concurrent_groups` seed value · double-booking prevention trigger
**Related:** Q2 in `docs/need_answers.md` (the broader availability-model question)

## The question

What is the maximum number of distinct groups that can be at each property simultaneously?

This is different from "how many instructors do you have" or "how many bays exist." It's the practical ceiling — "even with everyone scheduled, beyond N groups at once, the property feels overrun and quality drops."

E.g., Horseshoe Bay might have 5 instructors and 8 bays but say "3 groups at once is our real ceiling." That number — 3 — is what we need.

Answer per property:
- Horseshoe Bay Sporting Club: ?
- Hog Heaven Sporting Club: ?
- Packsaddle Precision: ?

## Why it matters

The database trigger that prevents double-booking uses this number as a hard ceiling. Bookings that would push the slot above `max_concurrent_groups` are rejected at insert time, regardless of instructor or bay availability.

This is the "no overbooking" guarantee. It only works if the number is realistic.

## What it unblocks

`max_concurrent_groups` seed values. Currently each property is set to 1 (placeholder).

## Notes

This question is downstream of Q2 in `docs/need_answers.md` — that one asks about the availability model (instructors-only vs bays-only vs both). Once the model is locked, this is the specific number for the chosen approach.

## Answer

_(pending)_

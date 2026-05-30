# P1 — Booking horizon per property

**Category:** Property configuration
**Status:** Open · surfaced 2026-05-24
**Blocks:** `properties.booking_horizon_days` seed value · calendar's max-selectable date

## The question

How many days in advance can guests book at each property?

| Horizon | Effect |
|---|---|
| Short (14–30 days) | Builds urgency. Encourages phone calls for group/event planning that needs longer lead time. |
| Medium (60–90 days) | Balances casual and planned bookings. Most operations land here. |
| Long (180+ days) | Supports group/corporate planning. Risky if instructor staffing changes — you may have to honor early-bird bookings under different staffing reality. |

Is the answer the same for all three properties, or does it differ by property?

## Why it matters

This is the maximum date the calendar will let a guest pick. Too short means lost long-lead bookings (corporate retreats, group events booked far in advance). Too long means commitments made today against a future you can't fully predict — instructor turnover, schedule changes, etc.

## What it unblocks

The `booking_horizon_days` value on each property's settings record. Currently a placeholder. Once App 3 ships, this is editable from `/admin/properties` per property, so it's tunable post-launch — but a sane initial value avoids confusing guests on day one.

## Recommendation

90 days as a default starting point. Long enough for most planning, short enough to avoid the "we don't know who'll be on staff" problem. Tune per property after a few months of real bookings.

## Answer

_(pending)_

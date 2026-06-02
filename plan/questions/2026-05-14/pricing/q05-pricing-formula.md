# Q5 — Pricing formula per service

**Category:** Pricing
**Status:** Open · surfaced 2026-05-14
**Blocks:** `pricing_rules` table schema · live price calculation in the intake form · the `confirmed_price` field on the bid · internal pricing admin UI

## Context

The intake form shows a live estimated price (e.g., $710) that updates as a
guest selects disciplines and guest count. The `pricing_rules` table needs to
encode this formula exactly. The two most common structures are: (A) flat
per-person rate per discipline regardless of group size, or (B) tiered rates
that change at group-size thresholds (e.g., a different per-person rate for 1–5
vs 6–10 guests). The HSB Pricing Schema narrative in Google Drive is the likely
source — but the formula needs to be explicitly defined and agreed before the
pricing engine is built, because changing it later means rebuilding the
calculation logic.

## The questions

- Does the per-person rate change based on group size (e.g., cheaper per head for larger groups)?
- Is there a minimum booking fee regardless of guest count?
- Are multi-discipline bookings priced as a sum of individual disciplines, or is there a package/bundle discount?
- Do member rates work as a fixed discount (e.g., 15% off public rate) or as a completely separate rate card?
- Does partner pricing work the same way — fixed discount off public, or a separate negotiated rate per service per partner?

## Answer

_(pending)_

# W2 — One waiver template, or one per property?

**Category:** App 7 — Waiver / e-signature
**Status:** Open · surfaced 2026-05-24
**Blocks:** Routing logic in `createEnvelope()` — single template-id vs per-property map

## The question

Is the liability waiver language the same across all three properties (Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, Packsaddle Precision), or are there property-specific clauses because the disciplines / risks / facilities differ materially?

For example:
- Horseshoe Bay (clays, helice, lake-side) — shotgun-and-water risks
- Hog Heaven (wing-shooting, weddings) — shotgun-and-event-venue risks
- Packsaddle (precision rifle, suppressors) — rifle-and-distance risks

## Why it matters

- **Single template:** simpler. One PDF uploaded to Dropbox Sign, one template id in env, one branch in code. Works if a lawyer says the liability language is fungible across activities.
- **Per-property templates:** legally cleaner if risks differ materially. We thread `property` into `createEnvelope()` and pick the right template id from a map. ~10 lines of additional code; not hard.

## What it unblocks

Whether `DROPBOX_SIGN_TEMPLATE_ID` is a single env var (today) or grows into a property→template-id map.

## Recommendation

Single template if a lawyer says yes — it's simpler and Dropbox Sign templates can include conditional/property-specific clauses inside one document. Per-property only if the liability language genuinely diverges.

## Answer

_(pending)_

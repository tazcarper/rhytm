# D1 — Per-property branded subdomains (long-term plan)

**Category:** Domain & deployment strategy
**Status:** Open · surfaced 2026-05-24 · not urgent
**Blocks:** Post-launch roadmap framing (not v1.0)

## The question

Long-term, do you want guests visiting their property's primary domain (e.g., `horseshoebaysportingclub.com`) to land on a branded experience for that property — different logo, photography, copy — while everything is still powered by the single Rhythm Outdoors codebase?

Or is the unified `rhythm.co` domain with a property picker the permanent plan?

The build proposal calls out per-property branded entry points (`intake.rhythm.co`, `members.horseshoebaysportingclub.com`, etc.) as a v1.1+ feature.

## Why it matters

- **Unified domain (current plan)** — one URL, one brand surface, simpler ops. Property picker is part of the UX. Guests learn "go to rhythm.co for everything."
- **Per-property subdomains** — branded entry points feel more native to each property's existing reputation. SEO benefits from anchoring on the property's existing domain. Adds middleware routing on the `Host` header and a property-pinning context. Not technically hard, but a real decision — once shipped, undoing it breaks bookmarks/SEO.

## What it unblocks

- Whether to spec per-property domains for the post-launch roadmap (v1.1) or treat the unified-domain experience as permanent.
- If yes: rough timeline expectations so the client can plan domain transfers / DNS work.

## Recommendation

Not urgent for v1.0 — the unified domain is fine to launch with. Worth a quick "this is on the roadmap, right?" check now so the client isn't surprised when we propose it post-launch. If they want it sooner (v1.0), call it out — it's a ~1-week task and is worth deciding before the launch announcement to avoid retraining customer URLs.

## Answer

_(pending)_

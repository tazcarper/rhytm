# Rhythm Outdoors — Event & Club Life Builder (Handoff)

A single-page admin tool for creating and managing the **events** and **Club Life posts** that render on the club websites. Both the sites and this builder read/write the same Supabase tables, so anything published here appears on the live sites.

## Files

- `index.html` — the builder UI. Self-contained; no local assets.
- `supabase-setup.sql` — one idempotent script that creates/updates the `events` and `posts` tables and their columns. Safe to re-run.

## How to run

Open `index.html` in a browser, or serve the folder (`python3 -m http.server`). No build step.

## Dependencies

- The page is fully self-contained: hand-written CSS in a single inline `<style>` block, no CDN, no external fonts.
- The only runtime dependency is **Supabase** (project `kfbudiwxjraugzwwlxgh`), reached via `fetch`. The anon key embedded in the page is the public client key and is safe to ship.

## First-time / fresh-instance setup

1. In the Supabase SQL editor, run `supabase-setup.sql` once. It is idempotent (uses `create ... if not exists` / `add column if not exists`), so re-running it to pick up new columns is safe.
2. The script ends with a verification query; confirm the expected column counts (events and posts) come back.
3. Row Level Security / policies: confirm the anon key has the intended read (public sites) and write (builder) access for your setup before going live.

## Notes for integration

- The builder writes rows; the club sites' `rhythm-events.js` and `rhythm-posts.js` read them. Keep the table/column names in sync with those engines if you change the schema.
- `events.date` is stored as text (not a date type) by design.
- Images are referenced by URL (Supabase storage or external), not uploaded through this tool.

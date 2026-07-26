# Rhythm Outdoors — Website Handoff

Static marketing sites for **Rhythm Outdoors** and its three clubs. Current working state, not final. Handed off for integration work (forms, booking, data).

## Structure

```
rhythm/          Parent brand landing page (single page)
hog-heaven/      Hog Heaven Sporting Club
horseshoe-bay/   Horseshoe Bay Sporting Club (most complete)
packsaddle/      Packsaddle Precision & Training
```

Each club has: index, membership, education, events, event-detail, club-life, private-events, adventure (Horseshoe Bay also has faq). Cross-site links are relative (../rhythm/index.html, etc.), so keep the four folders side by side.

Only files actually referenced by the pages are included. Unused logo variants, source icon art, and placeholder-only images were intentionally left out.

## How to run

Pure static HTML. Open any index.html in a browser, or serve the folder (python3 -m http.server). No build step.

## External dependencies (loaded at runtime, not bundled)

- Tailwind CSS via Play CDN (cdn.tailwindcss.com). Each page has an inline tailwind.config. For production, compile Tailwind to a static stylesheet.
- Fonts: Google Fonts (Oswald, Source Serif) on Rhythm; Adobe Typekit kit kvb3svr on Horseshoe Bay; plus self-hosted OTFs in assets/fonts/ (Silverspoon on HSB, Fieldstone on Packsaddle). Web-font licensing for Silverspoon and Fieldstone is unresolved, confirm before launch.
- Supabase (events + posts data): project kfbudiwxjraugzwwlxgh. The anon key embedded in the JS is the public client key and safe to ship.

## Shared engines (identical across clubs)

- assets/rhythm-events.js  — renders the events calendar + standing programs from Supabase.
- assets/rhythm-posts.js   — renders the Club Life posts feed from Supabase.
- assets/rhythm-icons.css  — per-club custom icon set (CSS-mask SVGs, tinted by currentColor).
- assets/rhythm-booking.js — booking URL config (Hog Heaven + Horseshoe Bay only).

## Integration TODO (for the co-worker)

1. Booking URLs. Fill the three empty URLs in hog-heaven/assets/rhythm-booking.js and horseshoe-bay/assets/rhythm-booking.js: lesson, onboarding, tour. Every booking button reads from this one file. Until filled, those buttons render disabled with a "Coming Soon" tag.
2. Forms are not wired. The Membership Inquiry (membership.html) and Request a Proposal (private-events.html) forms, plus the email-signup fields, use onsubmit="return false;". Point them at your endpoint / Supabase.
3. Supabase data. Events and posts render live from the events and posts tables. Schema/setup SQL is maintained separately (EVENT BUILDER/supabase-setup.sql in the working project), ask for it if you need to stand up a fresh instance.
4. Rhythm parent site is contact-only by design (no form): phone removed, CTAs are discreet links to a Google Calendar booking link and nicholas@rhythm.co.

## Placeholder assets still needed (sites hide these gracefully until supplied)

- Hero video + poster: assets/video/hero.mp4 (+ poster) on each club home.
- Headshots: horseshoe-bay/assets/img/cuatro-smith.jpg, hog-heaven/assets/img/georgia-stone.jpg.
- Horseshoe Bay benefit illustrations (membership page): assets/img/benefit-clays.svg, benefit-instruction.svg, benefit-bar.svg, benefit-hospitality.svg.
- Hog Heaven and Packsaddle photography (club-life / venue / hero slots). Horseshoe Bay is the most photo-complete; the others are largely placeholders.

## File naming

Photography is named for the slot it fills (hero.jpg, intro-membership.jpg, host-corporate-group-shoots.jpg), one file per slot, so swapping art never touches the HTML. Logos follow {club}_logo_{variant}_{colorway}_{background}.ext. Drop a replacement at the same path and it appears.

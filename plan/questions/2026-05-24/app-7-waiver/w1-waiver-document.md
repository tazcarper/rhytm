# W1 — Waiver document content

**Category:** App 7 — Waiver / e-signature
**Status:** Open · surfaced 2026-05-24 · **launch blocker**
**Blocks:** App 7 activation in production · every confirmed bid currently skips the signing step

## The question

Do you have a finalized liability waiver / release document that guests need to sign before participating? If yes — share the PDF (or the Word source so we can convert). If still drafting — do you want suggested starting points to take to a lawyer?

## Why it matters

Dropbox Sign needs an actual PDF template uploaded to its dashboard before any envelope can be created. The template we used during integration testing is a generic placeholder — not legally meaningful for actual guests.

Without a real template:
- Guests proceed to the property without signing anything
- No legal record of liability acknowledgment
- The "signed" badge on the bid page is misleading (it asserts a signature occurred, even though the document was the placeholder)

## What it unblocks

App 7 activation in production. Once the template PDF is uploaded to Dropbox Sign and we update `DROPBOX_SIGN_TEMPLATE_ID` in Vercel, every confirmed bid auto-creates a signing envelope.

## Notes

This is more often a lawyer/insurance conversation than a software one. If the property already uses a paper waiver, the fastest path is to digitize that exact document — no rewrites, no edits, just upload the existing legal language. Lawyers usually nod-and-approve that path because the substance hasn't changed.

If there's no existing waiver at all, this is a "go talk to a lawyer" item, not something we should ship without.

## Answer

_(pending)_

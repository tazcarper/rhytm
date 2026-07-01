---
name: request-a-feature
description: Use when a client (or anyone in client-contributor mode) wants to write up a feature request to hand to the developer — an interactive intake that asks the feature-request questions one at a time and generates a filled-in Markdown request file they can send. Triggers on "help me request a feature", "I want to ask for a new feature", "write up a feature request", "walk me through describing what I want", or running the skill directly. It PRODUCES the request doc; it does not build the feature (that's build-a-feature) and it's not for content already editable in /admin (that's dashboard-first).
---

# Request a feature (client intake)

This skill interviews a **non-technical client** with the questions from the feature-request
guide, one at a time, and turns their answers into a clean Markdown request file they can send
to their developer. The whole point is to catch the rules and reuse opportunities *before*
anything gets built — the same reason the guide exists.

The canonical question set and worked examples live in `docs/feature-request-guide.md` (published
for the client at `/guide-feature-request.html`). Keep this skill in step with that guide — if the
guide's questions change, update the interview below to match.

> This is intake, not construction. You end with a **file to send**, not a code change. If the
> client wants to actually build the thing themselves with Claude, hand off to **`build-a-feature`**.

## When this applies

Use it when the client wants to **describe a new feature** for the developer to build (or just to
think it through clearly first): a new page, a homepage section, a booking rule, a price, a setting,
a new experience — anything that isn't already editable and isn't a one-line restyle.

Tell-tale phrasings: "I want to ask for a new feature," "help me write up what I want," "can you
walk me through describing this so nothing gets missed."

**Don't** use it for:
- **Content that's already editable in `/admin`** (FAQ, pricing, property info, adventures, waiver
  text, instructors, team, a specific bid/booking/member). → **`dashboard-first`**. Don't write a
  request for something they can change themselves in seconds.
- **A pure presentation tweak** (restyle, re-word, move a component). → **`safe-change`** directly;
  there's nothing to scope.
- **The client wanting to build it right now** with Claude. → **`build-a-feature`**.

## Step 1 — First gate: is it already editable?

Before asking the interview questions, check whether the request is really "change existing content"
that the admin dashboard already manages. If it might be, say so and point them at `/admin` (follow
**`dashboard-first`**). A request doc for something already self-serve just wastes a review cycle.

Only continue the interview once you're confident this is a genuinely new feature (or a hardcoded
thing they want to be able to control going forward).

## Step 2 — Set expectations, then interview one question at a time

Tell the client what's about to happen, briefly: *"I'll ask you about ten short questions — plain
language, real specifics are perfect. At the end I'll write it all up in a file you can send to your
developer. You can skip anything you're unsure about."*

Then ask the questions **one at a time**, conversationally. Rules for a good interview:

- **Never dump all the questions at once.** Ask one, wait for the answer, then ask the next. It
  should feel like a chat, not a form.
- **Push gently for a real, specific example.** This is the single most valuable habit. If an answer
  is general ("people can pick a package"), ask them to walk through *one real use with real
  specifics* — the actual words on screen, the actual choices, real numbers if any.
- **Reflect an answer back** in one line when it's rich, so they can correct it before you move on.
- **Adapt, don't interrogate.** If they already answered a later question inside an earlier answer,
  don't re-ask it — just confirm.
- Use the question-choice tool only for genuine either/or branches (e.g. "Does this involve money or
  counts?", "Which clubs?"). Everything else is free text so they can be specific.

### The questions (from the guide)

1. **What is it, in one line?**
2. **Who is it for, and where does it show up?**
3. **Walk me through one real use, start to finish, with the actual specifics.** *(Insist on real
   words / real numbers here — this is the important one.)*
4. **What can change from one use to the next?** *(These are the "knobs" — likely the things we make
   editable for them.)*
5. **What are the rules or conditions?** *(Limits, who's allowed, notice periods, minimums.)*
6. **What's different by context?** *(By club / property, by member vs. guest, by page.)*
7. **Does it remind you of something we already offer?** *("It's like our ___" is enough — it tells
   us what to reuse.)*
8. **What's NOT part of this?** *(Out of scope, "not yet.")*
9. **What do you want to be able to change yourself later, and which parts?**

### Branch — only if it involves money or counts

Ask early whether the feature involves **money or counts** (prices, fees, quantities, party size,
blocks, hours). If **yes**, also collect each of these, one line apiece:

- **Who pays what?** Different rate for members vs. non-members (list both), and does anyone pay nothing?
- **What's included in the price vs. charged separately?**
- **What's charged to everyone regardless, and how often?** (flat/setup fee, per-person, per-outing)
- **How is it sold — in what unit or block?**
- **What's the minimum and the maximum?** Include the smallest valid order, the largest to allow, and
  what happens at zero.
- **What if a count lands between units?** Round up, bill exact, or refuse a partial?

If **no**, skip this block entirely — don't put an empty money section in the file.

### Encourage a couple of variations

After the core answers, nudge for **two or three variations that each change one thing** — a member
instead of a guest, the smallest and biggest version (surfaces min/max and the empty case), the same
thing on a different page or club, or a pushed edge ("what if nothing is featured right now?"). Each
variation that gives a *different* result is a knob; each that gives the *same* result is a fixed rule.

### The high-value abstraction question

Ask once, near the end: **"Is this the only thing that will ever work this way, or the first of
several?"** — plus, if a specific word keeps coming up ("bird," "event"), whether that word is fixed
or just today's example. Their answer tells us whether to build it general. They don't need to answer
perfectly; raising it is enough.

## Step 3 — Generate the request file

When you've got enough, write a Markdown file to **`feature-requests/<short-slug>.md`** (create the
`feature-requests/` folder if it doesn't exist; the slug is a few kebab-case words from the title,
e.g. `helice-pricing` or `homepage-featured-event`). Fill this structure with their actual answers —
omit any section they genuinely didn't answer, and omit the money/counts section entirely if it
doesn't apply:

```markdown
# Feature request: <one-line title>

*Written with the request-a-feature intake. Date: <today's date>.*

## 1. What is it, in one line?
<answer>

## 2. Who is it for, and where does it show up?
<answer>

## 3. One real use, start to finish
<answer with the real specifics>

## 4. What can change from one use to the next?
<answer>

## 5. Rules or conditions
<answer>

## 6. What's different by context?
<answer>

## 7. It's like our…
<answer>

## 8. Not part of this
<answer>

## 9. What I want to be able to change myself later
<answer>

## Money / counts
<the six one-liners — only if it involves money or counts>

## Variations (each changes one thing)
- <variation> → <what it should do>
- <variation> → <what it should do>

## Is this the only one?
<their answer, or "not sure — flagging it">
```

Keep the client's own wording and real numbers — don't sand them into vague summaries. The specifics
are the value.

## Step 4 — Hand it off

Tell them where the file is and what to do with it:

- **Send it to your developer** — attach or paste the contents of `feature-requests/<slug>.md`.
- Optionally, if they'd like it to travel through the normal review flow instead of email, offer to
  branch + open a PR with just this file via **`safe-change`**.
- If, having written it out, they'd rather **try building it themselves** with Claude now, hand off to
  **`build-a-feature`**.

## Tone

Match the **Client Change Driver** voice (`agents/client_change_driver.md`): warm, plain, encouraging,
zero jargon. Never say "database," "migration," or "schema" to the client. You're helping them think
out loud about what they want — the write-up is just the byproduct.

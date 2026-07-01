# How to describe a new feature so we build the right thing the first time

*A short guide for writing requests — a new page, a homepage section, a booking rule, a price, a
setting, anything. The goal: give us — and Claude — enough detail that we catch the rules and reuse
opportunities you didn't think to mention, before anything gets built.*

> **Prefer to be walked through it?** Ask Claude to "help me request a feature" — it'll ask you these
> questions one at a time and write the finished file for you to send. Everything below is the same
> thing, on paper.

---

## The one habit that helps most: walk through a real one

A description tells us how something *should work in general*. An **example** tells us *exactly what
happens for one real person using it* — and that's where the hidden details live. When you narrate a
specific use with real specifics (the actual words on the screen, the real choices someone makes,
real numbers if there are any), you can't skip the parts a general description glosses over.

Even better: **give us two or three examples that each change one thing.** Comparing them is what
reveals which parts are fixed and which parts are adjustable settings ("knobs"). Those knobs are
usually exactly what we make editable for you in the dashboard.

> **Rule of thumb:** one example shows us the feature. Three examples show us the *shape* of the
> feature — and that's what we can build to last.

---

## A template you can copy for any request

Fill this in. Don't worry about being technical — plain words and real specifics are perfect. The
example answers below show how the Helice request would look filled in.

**1. What is it, in one line?**
> "Helice — a driven-target game, priced per bird (target), offered at Horseshoe Bay and Hog Heaven."

**2. Who is it for, and where does it show up?**
> "Guests building an estimate on the request-estimate page — it's one of the experiences they can
> pick, alongside clays."

**3. Walk me through one real use, start to finish, with the actual specifics.**
> "A non-member at Horseshoe Bay picks Helice for a party of 4 adult guests and chooses a 30-bird
> round. Their estimate shows, line by line: guest fee (4 × $85 = $340), 30 targets × $2.95 =
> $88.50, and a $49.50 setup/ring fee — total $478.00. If they add ammo, it's a separate line."

**4. What can change from one use to the next?**
> "The number of birds (sold in blocks of 30), whether the host is a member or not (member rate
> $2.50 vs. public $2.95), and the party size (which drives the guest fee). The per-bird rates, the
> block size, and the $49.50 fee stay the same."

**5. What are the rules or conditions?**
> "Members shoot on dues (no guest fee); non-member guests pay the tiered guest fee on top. Minimum
> is one 30-bird block. There should be a maximum we can set. Same '1 range officer per 5 guests'
> and '9+ people = private event, 72-hour notice' rules as clays."

**6. What's different by context?**
> "Rates differ by club — Horseshoe Bay $2.95 / $2.50, Hog Heaven $2.75 / $2.25. The $49.50 fee is
> the same at both. Not offered at Packsaddle."

**7. Does it remind you of something we already offer?** *(In plain terms — you don't need to know
how the app is built. Just "it's like our ___" is enough for us to reuse the right pieces.)*
> "It's like our clays — the price covers the targets, and guests buy ammo separately the same way
> they do for clays. The main difference is Helice is charged per bird instead of per person."

**8. What's NOT part of this?**
> "Tournament pricing — not yet (TBD). Packsaddle — not offered."

**9. What do you want to be able to change yourself later, and what parts?**
> "The per-bird rates, the block size, the maximum, and the setup fee plus its label and description
> — all editable per club in the dashboard."

**If it involves money or counts, also answer each of these — one line apiece:**
> - **Who pays what?** Does the price differ for members vs. non-members (list both rates), and does anyone pay nothing? *(e.g. "member rate $2.50/bird vs. public $2.95; members pay no guest fee.")*
> - **What's included in the price vs. charged separately?** *(e.g. "the bird price is all-in for the target; ammo is a separate line.")*
> - **What's charged to everyone regardless, and how often?** Flat/setup fees, per-person, per-outing, per-day. *(e.g. "$49.50 setup fee, once per outing.")*
> - **How is it sold — in what unit or block?** *(e.g. "in 30-bird blocks.")*
> - **What's the minimum and the maximum?** Include the smallest valid order and the largest we should allow — and what happens at zero. *(e.g. "minimum one block; a maximum we can set; zero blocks isn't a valid order.")*
> - **What if a count lands between units?** For anything sold in whole units (blocks, hours, people), say what happens to an in-between amount — round up, bill exact, or refuse it. *(e.g. "birds only sell in whole 30-blocks — 40 birds rounds up to two blocks (60); we don't sell partial blocks.")*

---

## Then vary it — this is where the good stuff comes out

After the first example, hand us a few more that each change **one** thing. You don't need to be
exhaustive — just poke at the edges:

- **Change who's using it:** a member instead of a visitor. Staff instead of a guest.
- **Change the amount:** the smallest version, and the biggest. (This surfaces minimums, maximums,
  and "what if there are zero of these?" — the empty case people always forget.)
- **Change the context:** the same thing on a different page, or at a different club.
- **Push an edge:** "What if the headline is really long?" "What if nothing is featured right now?"
  "What if two people do this at once?"

Each variation that produces a *different* result is a knob we need to build. Each one that produces
the *same* result confirms a fixed rule.

---

## The question that catches the biggest things: "Is this the only one?"

The details easiest to miss aren't edge cases — they're **abstractions**: the moment where your
specific request is really an example of a more general thing. A minute on these three questions
usually saves a rebuild later:

- **"Is this the only thing that will ever work this way, or the first of several?"**
  *(Helice was the first game "priced per target" — naming that up front let us build it so the next
  one is just a settings change, not new code. The same goes for a homepage section: is it a
  one-off, or the first of a kind of block you'll want again?)*
- **"Is [this word] a fixed thing, or just today's example?"**
  *(Is it always "birds," or is a bird just one kind of countable target? Is it always "this event,"
  or the first of many things you might feature? If the label might change, tell us — we'll make it
  a setting.)*
- **"Is this rule/piece specific to this feature, or could it apply to other things too?"**
  *(A setup fee "because we staff the ring" isn't really about Helice — it's a flat fee any
  experience might have. A "featured" toggle isn't really about events — lots of things could be
  featured. Spotting that means the next feature gets it for free.)*

You don't have to answer these perfectly. Just raising them gives us the thread to pull.

---

## Two quick worked examples

Here's the same template answered for two real requests — one that's all about money, one with no
pricing at all. Notice how each answer points at a thing we'd build.

**Pricing — Helice** *(the short version of the template above)*

> **1. What is it?** "Helice — a driven-target game priced per bird, at Horseshoe Bay and Hog Heaven."
> **2. Who / where?** "Guests building an estimate on the request-estimate page, alongside clays."
> **3. One real use?** "Non-member at Horseshoe Bay, party of 4, one 30-bird round → guest fee 4 × $85 = $340, 30 targets × $2.95 = $88.50, $49.50 setup = $478.00. Ammo is a separate line if they add it."
> **Money / counts?** "Member $2.50 vs. public $2.95 per bird; members pay no guest fee. Sold in 30-bird blocks — minimum one, a maximum we can set, no partial blocks. $49.50 setup once per outing."
> **Rules & context?** "Rates differ by club (Hog Heaven $2.75 / $2.25); not offered at Packsaddle."
> **Is this the only one?** "'Bird' is really 'target' — a future driven game would reuse this, so build it general."
> **Out of scope / later?** "Tournament pricing — not yet."

**Non-pricing — a homepage "featured event" section**

> **1. What is it?** "A spot near the top of the homepage to show off an upcoming event."
> **2. Who / where?** "Public visitors landing on the homepage."
> **3. One real use?** "Feature 'Fall Clays Classic,' Nov 8, with its photo and a 'Learn more' link to the event."
> **What changes / how many?** "Usually one event; sometimes two or three → show a row. Sometimes none right now → hide the section (or show a fallback line)."
> **Who edits it?** "I pick the featured event, swap the photo, and reorder them — from the dashboard."
> **Is this the only one?** "I might later feature a membership offer or a property, not just events → build a general 'featured item,' not an events-only box."
> **Out of scope / later?** "No ticketing or RSVP here — just the spotlight."

Same technique, no pricing in sight — every answer is either a thing we build or a rule we lock in.

---

## Quick checklist before you send a request

- [ ] One full example with **real specifics** (real words, real numbers), start to finish
- [ ] Two or three **variations**, each changing one thing (who, how many, which context, an edge — including the **empty / none** case)
- [ ] Said **who it's for and where it shows up**, and what **changes vs. stays the same**
- [ ] Listed the **rules or conditions**, any **limits**, and any **per-context** differences
- [ ] Pointed at something **that already exists** that it's like
- [ ] Answered **"is this the only one?"** — flagged anything that might be a pattern
- [ ] Noted what's **out of scope / later**, and what you want to **edit yourself**

You can paste this whole thing to Claude along with your request — it's written to help Claude ask
you the right follow-ups and spot the reusable pieces.

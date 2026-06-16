# Schema Training Corpus — Abnormality Report

**Purpose** Identify drift between the training corpus I built today (`Rhythm_Schema_Training_Corpus_v1.0.md`) and the canonical Drive documents (Claude Bearings, HSB SC Q&A, Estimating Templates Index). Surface these to Nicholas BEFORE shipping the corpus to a Claude Code app build, so the next agent boots from truth instead of inherited drift.

**Source documents read for this audit:**
- `Claude_Bearings_Rhythm_AI_Schemas.md` (2026-05-07, lives at `Rhythm AI Schemas → _Index & README`)
- `HSBSC Q&A_5.1.26.pdf` (2026-05-01, canonical HSB SC FAQ)
- `Rhythm_Estimating_Templates / _INDEX.md` (2026-05-11, template registry)
- `Packsaddle Questions` (2026-02-20, Packsaddle planning doc)

---

## SHOW-STOPPER FINDINGS — fix before shipping the corpus

### 1. Operating window is wrong on HSB Resort partner profile

**What I wrote into Notion (Horseshoe Bay Resort Partner Profile):**
Operating Days: Tue–Sat. Earliest 09:00. Latest 16:00. Sunday + Monday closed.

**Canonical (HSB SC Q&A):**
- Summer (Jun 1 – Aug 31): Tue–Sat 9 AM – 5 PM + **Sunday 10 AM – 5 PM**.
- Sep 1 – May 31: Tue–Sat 9 AM – 6 PM + **Sunday 10 AM – 6 PM**.
- **Closed Monday only.**
- Bar 12 PM – 7 PM.

**Implication:** The intake form refuses Sunday bookings. The partner pricing guide says "no Sunday or Monday bookings." Both are wrong if the Resort partnership inherits the standard member operating window. **Nicholas decision required:** does the Channel B Hotel Group partnership channel run a constrained Tue–Sat 9–4 window for ops reasons, or does it inherit the full member hours? If the latter, the Partner Profile, the intake form, and the Pricing Guide all need correction.

### 2. Camp Lucy Group Proposal — standing-rule violation

**The Standing Rule (Bearings §6):**
> Camp Lucy bid template: Do not rebuild `public/HH_CampLucy_Group_Proposal.html`. Reference, don't recreate.

**What I have on disk:** `05_Group_Proposal_Template_v2.5.html` — a 102 KB HTML file. The Drive has the canonical `HH_CampLucy_Group_Proposal.html` (file ID `16i3HTRV1f2q2M9vQZo_LhAxfEFGoWYt8`, also ~102 KB).

**Implication:** My version may or may not be a parallel build I should not have made. The Handover README references it as "legacy template, kept available; primarily superseded by the intake form below" — so it might be intentional. But the canonical Drive version is the one the Bearings names as off-limits to recreate. **Nicholas decision required:** confirm whether my `05_*.html` was sanctioned, or whether it duplicates the canonical and should be marked Historical / removed from the Camp Lucy kit.

### 3. HHSC vs HH naming conflation

**What I encoded:** "Hog Heaven (HH)" as one of two operators.

**Canonical (Bearings §1):** Five distinct properties:
- HSB Sporting Club (members club)
- Hog Heaven × Camp Lucy (joint-bid surface, Cross-Channel partnership)
- **HHSC (Hog Heaven Sporting Club)** — Hog Heaven's *membership arm* with its own six-tier catalog
- Packsaddle Precision (long-range / precision rifle, standalone — actively planned, not a placeholder)
- Rhythm Outdoors (parent / umbrella brand)

**Implication:** My corpus blurred HHSC (the membership business) with "Hog Heaven × Camp Lucy" (the partnership bid surface). They are different commercial surfaces with different audiences. The new agent will conflate them too unless this is fixed.

### 4. Hog Heaven brand fonts are wrong

**What I encoded for HH artifacts (and used in the Camp Lucy build):**
- Display: Playfair Display
- Body: Libre Franklin
- Mono: DM Mono

**Canonical (Bearings §4, source `HH Colors and Fonts.pdf`):**
- Display: **P22 Mackinak**
- Headings (H1, H2): **Arpona**
- Sub-headings (P1): **Arpona Sans**
- Body (P2): **Libre Franklin** ← only this one matches

**Implication:** Camp Lucy artifacts (`03_Sales_Reference_Card`, `04_Partner_Pricing_Guide`, `05_Group_Proposal`, `08_Customer_Sales_Brochure`) all use Playfair Display + DM Mono, neither of which is the HH brand font. The HSB SC artifacts are unaffected (they use Cormorant Garamond + Inter, which appears HSB SC brand-correct — though I haven't read the HSB Brands folder yet to confirm).

---

## IMPORTANT FINDINGS — should fix or surface

### 5. Charter Principles — incomplete in my corpus

**What I documented:** 4 principles in observed use (#3 Bundle Trap, #5 Wholesale Confidentiality, #6 Partner Confidentiality, #12 Tax Application).

**Canonical (Bearings §5):** 8 named principles (#1, #2, #3, #6, #7, #11, #12) plus 4 placeholder-unfilled (#4, #5, #8, #9, #10).
- **#1 Notion canonical** — Notion wins over Drive when they disagree. Eleven canonical Notion databases.
- **#2 Member Pricing Convention** — refer to Notion.
- **#3 Bundle Trap (TX §151.0048)** — correct in my corpus.
- **#5** — UNFILLED in Bearings. I had this as "Wholesale Confidentiality" which is wrong.
- **#6 Confidentiality** — correct.
- **#7 Single-Payer Billing** — missing from my corpus.
- **#11 Visibility / Channel** — structured properties for visibility/channel control. Missing from my corpus.
- **#12 Tax Application** — correct.

**Implication:** Eight of twelve principles remain to be pulled from Notion. My corpus's "Section 8 Charter Principles" needs a rewrite against the Bearings naming.

### 6. HHSC membership tier catalog — entirely missing

**Canonical (Bearings §7):** Six membership tiers:
| Tier | Initiation | Monthly | Status |
|---|---|---|---|
| Corporate | $12,500 + tax | $750 + tax | Active |
| Legacy Family | $8,500 | $325 | Active |
| Limited Household | $5,950 | $295 | Active |
| Individual | $3,450 | $195 | Active |
| Out-of-State | $3,450 | $195 | Active |
| Safety Team | $0 waived | $325/mo per 5 participants | DRAFT |

Plus grandfathered Shotgun-Family ($125/mo, $1,500/yr).

**Implication:** None of this appears in my training corpus. The next agent has no awareness of HHSC's actual membership business.

### 7. HHSC Guest & Safety Policy v3.0 — Five Triggers entirely missing

**Canonical (Bearings §8):**
- 9+ total: Reservation required (Private Event).
- 5+ guests: Per-guest fee $75; club RSO included.
- 5+ guests on pistol bays: Concierge Booking with mandatory instructor.
- 15+ guests: Senior Professional Instructor required.
- 20+ guests: Two Senior Professional Instructors required.
- RSO ratio: 1 per 5 guests. Members and Keyholders excluded from count.
- Corporate Rule of 8: any gathering > 8 individuals is a Private Event.

**Implication:** My corpus has different instructor ratio rules (1:3 per shotgun for HSB SC, 1:5 per student for pistol/carbine). The HHSC Guest & Safety Policy v3.0 is the canonical authority for HHSC. **Confirm whether HSB SC has its own equivalent policy** or inherits these triggers — the HSB SC Q&A says reservations required only for groups of 6+, which differs from HHSC's 9+ Private Event threshold.

### 8. Key personnel — significant gaps in my corpus

**Missing from my corpus (now surfaced):**
- **Jay Krug** — General Manager, HSB Sporting Club. Email `Jay@HSBSportingclub.com`, phone 830-825-1550. NSCA shooter, certified instructor, Front Sight + Staccato Ranch background.
- **Robert Henry Seale III, Lyssa M. Seale** — Owners on record for HHSC (Sportsman's Finest Hog Heaven LLC).
- **Adam McCaw** — HH membership routing (replaces the old `membership@sportsmansfinest.com`).
- **Cassi Payne, Zanna Ward, Courtney Ward** — HSB and HH intake recipients per the Estimating Templates _INDEX.md.
- **Ryan @ rhythm.co** — Brand asset contributor.

**Implication:** Routing decisions, contact updates, and partner introductions all depend on knowing who owns what. The new agent needs this roster.

### 9. Existing Estimating Templates registry — I didn't reference it

**Canonical (`_INDEX.md` in `Rhythm_Estimating_Templates`):**
The Drive has a documented template library with conventions:
- One file per template, single-file deployable.
- Header comment block with brand / audience / last-sync date / source database ID / Charter link / status.
- Status tag `★ AUTHORITATIVE BIDDING STANDARD ★` on designated standards.
- Pricing constants in a `RATES` (or equivalent) object at the top of JS.
- Brand assets in Drive `02_Brand & Standards / [HSB or HH] - Brands`.
- Tax per Charter Principle #12.

There's already a documented **Rhythm Intake Form (Direct/Public, v1.1)** — 8-screen progressive intake for HSB and HH paths with Packsaddle Coming Soon. **This is DIFFERENT from our passworded partner intake form.** Public is for direct/general inquiries (corporate planners, weddings, individuals contacting either club directly); the partner intake is for partner concierges submitting on behalf of their guests with confidential pricing visible.

**Implication:** Our HSB Partner Intake Form fits into this template family but should carry the canonical header comment block, status tag, and registration in the Notion Source Documents DB (`https://www.notion.so/9c20d400e7904c1aaf15de1aa50e7b92`). My v1.0 file does not.

### 10. Notion has 11 canonical databases — I documented 2

**Canonical (Bearings §5):** "Eleven canonical databases in Notion (Pricing/SKUs, Policies, Charter, FAQ, Members rosters, Adventures, Inquiries, etc.)"

**My corpus references:** Pricing, Partner Profiles. Plus relation pointers to Events, Source Documents, Used In Quotes (three more, schemas unknown).

**Implication:** Six or more canonical Notion databases I have never read or documented. Charter, Policies, FAQ are particularly important — they're the upstream canonical rules my corpus would inherit. The next agent should fetch all 11 before doing partnership work.

### 11. Source Documents database ID drift

**Bearings / Estimating Templates _INDEX.md references:** `https://www.notion.so/9c20d400e7904c1aaf15de1aa50e7b92` (the Source Documents DB page).

**My corpus references:** `fde68cfb-d060-4e9d-9c64-3c563b911214` (data source / collection ID found via Pricing DB relation).

**Implication:** Likely the same database (page ID vs collection ID), but worth reconciling explicitly so the next agent doesn't address two distinct IDs as the same resource.

---

## USEFUL CONTEXT — would improve the corpus

### 12. HSB SC member-side economics entirely missing

**Canonical (HSB SC Q&A):**
- Initiation: $2,950 + tax
- Monthly dues: $295 + tax
- Cart fee: $15/person + tax (annual cart plan under consideration)
- Guest fee: $85/person (includes cart, clays)
- Junior guest (15 and under): $55
- Guests per visit: up to 5 (larger groups need GM approval)
- Guests per year per guest: 3 max
- Reservations required only for groups of 6+

### 13. HSB SC facility list — Helice ring is news

**Canonical (HSB SC Q&A):** Facilities include sporting clays, flurry deck, shooting platforms, **Helice ring**, pistol/carbine bays. NOT currently offered: skeet, trap, long-range (long-range at Packsaddle Precision).

**Implication:** A Helice ring at HSB SC is a meaningful brand differentiator. None of my artifacts mention it.

### 14. HSB SC technical specs

**Canonical (HSB SC Q&A):**
- Address: 23753 State Highway 71 (~10 min from resort)
- Property: 150+ acres
- Caliber limit: up to 5.56/300 Blackout
- Rifle zeroing: up to 50 yards (longer ranges at Packsaddle)
- Targets: paper and steel
- Loads: lead shot only (7.5–9), 24" minimum barrel at shotgun stand and shooting decks
- Shorter shotguns permitted at pistol bays

### 15. Packsaddle Precision is real and planning is detailed

**Canonical (`Packsaddle Questions` doc):**
- Located at Packsaddle Mountain
- 1,250 yards maximum distance
- 6-9 ranges, 2 covered decks, 10 shooters per deck
- Caliber limit: 30 cal for general range usage
- Member-only, no walk-ins; membership not required for training
- Membership: Initiation $1,250 (Hog) / $1,450, monthly ~$125
- Year 1 revenue projection: $400-500k (2026)
- Year 2: $800k-1.2M (2027)
- Year 3: $1m-1.5m (2028)
- Year 1 revenue split: 50% training / 15% events / 35% memberships
- Hours: 5 days a week, Wed–Sunday
- "HSB is CAPX — We do OPX" (note from Nicholas in the planning doc)

**Implication:** My corpus called Packsaddle a "placeholder." It is an active facility with detailed planning and projected operations. The new agent should treat it as a real property in the same tier as HSB SC and HHSC.

### 16. Domain rule

**Canonical (Bearings §2 / Verification Report):**
- **NEVER use `sportsmansfinest.com`** — sold company with bad terms with new owners.
- **Use `@hhsporting.com` instead.**

**Implication:** I do not believe my work touched this domain, but worth verifying with a sweep. The legal entity `Sportsman's Finest Hog Heaven LLC` remains canonical — that's the registered legal name, distinct from the sold domain.

### 17. The Bronco — a separate experience

**Canonical (HSB SC Q&A):** "Q: Is this part of the Bronco experience? A: No. The Sporting Club operates independently in partnership with The Club."

**Implication:** Bronco is a separate Horseshoe Bay Resort experience. The Sporting Club is independent. Worth flagging in the corpus so the new agent doesn't conflate.

### 18. Bearings doc itself has stale references

The Bearings doc was last revised 2026-05-07 and still cites:
- `membership@sportsmansfinest.com` as the membership email of record (now `adam@hhsporting.com` per the Verification Report).

**Implication:** Even the canonical orientation doc is mortal and behind on at least one piece. The Verification Report (`HHSC_Verification_Report_v1.md`) is newer (2026-05-08) and explicitly notes this. The next agent should prefer the Verification Report for any conflict on contact info.

---

## Recommended pre-ship corrections

Before shipping the training corpus to a Claude Code app build, the following should land:

1. **Operating window decision.** Confirm whether HSB Resort partnership channel runs Tue–Sat 9–4 (current Notion state) or inherits full HSB SC member hours (Tue–Sun, closed Monday only). Update Notion Partner Profile, intake form, and Pricing Guide accordingly.

2. **Camp Lucy Group Proposal decision.** Confirm whether `05_Group_Proposal_Template_v2.5.html` should be retained, marked Historical, or removed. The Bearings standing rule says "reference, don't recreate" the existing `HH_CampLucy_Group_Proposal.html`.

3. **HHSC vs HH naming.** Rewrite Section 2 of the corpus to distinguish HSB Sporting Club, HHSC (Hog Heaven Sporting Club), Hog Heaven × Camp Lucy (joint-bid), Packsaddle Precision, and Rhythm Outdoors as five distinct properties.

4. **HH brand fonts.** Reload the canonical (P22 Mackinak / Arpona / Arpona Sans / Libre Franklin) into the corpus. Note in the Camp Lucy kit's "next iteration" task list that the Playfair Display / DM Mono usage is a brand drift to correct in v2 of the artifacts.

5. **Reload the full Bearings doc** as the first read on session start. This becomes Section 0 of the corpus.

6. **Pull all 11 canonical Notion databases** and document their schemas + content scope. Charter, Policies, FAQ are highest priority.

7. **Pull the HHSC Guest & Safety Policy v3.0** from Drive and document the Five Triggers + RSO ratio + Corporate Rule of 8 in the corpus.

8. **Add HHSC's six membership tiers** as a Section 5.5 to the corpus.

9. **Add Packsaddle Precision** as a real property in Section 2, with the planning specs from `Packsaddle Questions`.

10. **Add the key personnel roster** (Jay Krug, Robert/Lyssa Seale, Adam McCaw, Cassi Payne, Zanna Ward, Courtney Ward, Ryan @ rhythm.co, Georgia, Jeff, PJ).

11. **Add HSB SC member-side economics** ($2,950 / $295 / $85 guest / $55 junior / 5-guest cap / 3-visits-per-year-per-guest cap).

12. **Add HSB SC facility list** including the Helice ring.

13. **Add the Estimating Templates conventions** to the corpus's Section 10 Partnership Artifact Kit so the new agent uses the canonical header comment block / RATES object / status tag pattern.

14. **Add the domain rule** prohibiting `sportsmansfinest.com`.

15. **Reconcile Source Documents DB ID** — confirm whether `9c20d400e7904c1aaf15de1aa50e7b92` (page ID) and `fde68cfb-d060-4e9d-9c64-3c563b911214` (collection ID) refer to the same database.

---

## Net assessment

The corpus I wrote today is a faithful record of what we built in this session, and the HSB SC × Horseshoe Bay Resort partnership work is internally consistent. But it is *partial* — it captures one cross-section of a larger operating company.

The corpus is not yet safe to ship to a new agent build without the corrections above, because the next agent would inherit four real abnormalities (operating window, HH brand fonts, HHSC/HH naming, the Camp Lucy proposal standing-rule violation) that would cause visible drift the moment it tried to extend or reuse the work.

Recommendation: spend one focused session pulling the Drive `_Index & README` folder + the 11 Notion canonical databases in full, then revise the corpus to v2.0 against that ground truth. The pattern is right; the foundation just needs to widen.

— end of abnormality report —

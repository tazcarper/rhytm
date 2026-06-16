# Rhythm Outdoors — Schema Training Corpus v2.1

**Prepared by** Nicholas Vedros (Rhythm Outdoors) + Claude session 2026-06-16
**Purpose** Train a new agent instance with the full operational, schema, pricing, brand, and personnel context for Rhythm-managed properties and partner programs. Notion is canonical for commercial logic; Drive is canonical for source documents and brand assets; Agilisys is canonical for retail inventory.
**Supersedes** Schema Training Corpus v2.0 (which had a stale GM, was missing the full Chart of Accountability, was missing the HSB SC legal entities, and referenced the older Q&A 5.1.26 instead of the canonical 5.12.26).

---

## 0. Read this first — the Bearings doc + the Chart of Accountability are canonical orientation

Before any work, the new agent reads:

1. **Claude Bearings document** — Drive file ID `1Ctzu4f_rDZ2_bCjCIrzhUSM_do-nNHV7`. Last revised 2026-05-07. Living orientation doc; mismatches propose, don't silently fix.
2. **Rhythm Chart of Accountability** — `rhythm-accountability.html`, revised 2026-06-15. The living command structure with every seat and accountability across HHSC, HSB SC, Packsaddle, Rhythm Central, and Rhythm Media. Section 14 of this corpus carries the full roster.
3. **HSBC Q&A 5.12.26** — Drive PDF, the canonical HSB Sporting Club member-facing FAQ.
4. **HSBC Sporting Club Upgrade Request Form REV 5.12.26** — Drive PDF, the canonical legal entry-point for HSB SC membership upgrades. Contains the Release of Liability and Rules and Regulations.

If anything in this corpus conflicts with the live Bearings or Chart, the live document wins for orientation; Notion wins for commercial data per Charter Principle #1.

---

## 1. The five properties

| Property | Role | Commercial Channel(s) | Established |
|---|---|---|---|
| **HSB Sporting Club** | Members club at Horseshoe Bay | Four-channel topology (A Member-Led, B Hotel Group, C SC-Booked Non-Member, D Daily F&B) | 2025 |
| **Hog Heaven × Camp Lucy** | Joint-bid surface for field operations × hospitality | Cross-Channel partnership | — |
| **HHSC (Hog Heaven Sporting Club)** | Hog Heaven's membership arm | Members + Corporate + Safety Team | (pre-2026) |
| **Packsaddle Precision** | Long-range / precision rifle at Packsaddle Mountain | Standalone — active planning, launch in flight | 2026 (in motion) |
| **Rhythm Outdoors** | Parent / umbrella brand | — | — |

HHSC and Hog Heaven × Camp Lucy share a physical property in Dripping Springs but are commercially distinct. HSB SC and Hog Heaven × Camp Lucy are two completely separate partnerships — HSB SC runs through Horseshoe Bay Resort; Hog Heaven × Camp Lucy runs through Camp Lucy Resort.

---

## 2. Legal entities and anchor facts

### HHSC (Dripping Springs)
- **Legal entity:** Sportsman's Finest Hog Heaven LLC ("SF").
- **Owners on record (Release & T&C):** Robert Henry Seale III, Lyssa M. Seale.
- **Property address:** 24905 Ranch Road 12, Dripping Springs, Texas 78620.
- **Membership routing:** Currently `adam@hhsporting.com` (legacy address — Adam McCaw moved to HSB SC GM 2026-06-15; HHSC routing in transition pending Brandon Evans confirmation as GM).
- **Emergency contact:** Zanna (Zannah Ward) · 512-801-2065.

### HSB Sporting Club (Horseshoe Bay)
- **Legal entities:** **HSBR Sporting Club, LLC** (Texas LLC) AND **HSBRSC Operating Company, LLC** (Texas LLC) — both surfaced in the Upgrade Form Rev 5.12.26 Release of Liability.
- **Operating entity for partnership context:** "HSBR Sporting Club, LLC, a Texas limited liability company and HSBRSC Operating Company, LLC, a Texas limited liability company and all of their respective affiliates."
- **Property address:** 23753 State Highway 71, Horseshoe Bay, Texas 78657.
- **Facility legal county designation (per Release of Liability):** Llano County, Texas (ZIP 78657 spans Burnet and Llano counties).
- **Property size:** 150+ acres.
- **HSB SC phone:** 830-825-1550.
- **Website:** `www.hsbsportingclub.com`.
- **Membership routing:** `membership@hsbresort.com` (HSB SC member office routes through the Resort).
- **Resort main line:** The Club at Horseshoe Bay · 830-596-CLUB (2582).
- **Established:** 2025.

### Cross-cutting facts
- **Texas sales tax rate:** 8.25% applies to initiation fees, monthly dues, and per-guest experience lines. Worked example: $2,950 initiation × 8.25% = $243.38 tax = $3,193.38 grand total (confirmed in Upgrade Form Rev 5.12.26).
- **Bundle Trap (TX Tax Code §151.0048):** Instructor service is exempt only when isolated. If bundled with taxable goods or access on a single line, the whole line becomes taxable. Always isolate.
- **Governing law / arbitration:** Texas; arbitration in Austin, TX.

### Domain rule (critical)
- **NEVER use `sportsmansfinest.com`** — sold company with bad terms with new owners. Use `@hhsporting.com` for HHSC, `@hsbsportingclub.com` for HSB SC, `@rhythm.co` for Rhythm Central.
- The legal entity name "Sportsman's Finest Hog Heaven LLC" remains canonical and stays on every contract; only the domain is prohibited.

---

## 3. The Drive folder map (Rhythm AI Schemas)

Root: `Rhythm AI Schemas` — Drive folder ID `1tjvzBJtl8hJLeN8UgOYNM4ALeDBy3S5S` — owned by `nicholas@hhsporting.com`.

| Subfolder | Drive Folder ID |
|---|---|
| `_Index & README` (Bearings lives here) | `1O2bwCUS4tSuA_Nw2rlsGBKKlcgfF7Y8A` |
| `01_Pricing & Revenue` | `1DEuZLO9wET4Llu3bWcn_VtJx3qONH2kv` |
| `02_Brand & Standards` | `1nAGwALsKwrM3MrF2ulhTI372pGXAAWP0` |
| ↳ `HH - Brands` | `1ldE6A6bc8dUWwhy1FlfR6WQlbeEtmA0K` |
| ↳ `HSB - Brands` | `1s6NJ9ZuKSTY1VOkhFd2Rx__ilOnGYjDq` |
| `03_HR & Onboarding` | `1kUktmFAqG0DCzgrGK7N_1y0rG4MfjLDn` |
| `04_Operations` | `1rzbWoETtWFAPv6EI6UAyDM0uaBXQYIZY` |
| `05_Legal & Agreements` | `12CjgdM_ObsOvJM9uQbqBAGwCs8UWZT1w` |
| `06_Sales & Marketing` | `13vdibY02FNQbmYjZZrlC92YOtkGD1lWk` |
| `07_Finance` | `1Uvw5f03pZidg_Il01gqAhxe-rnNnKABP` |

---

## 4. The Notion canonical databases

Nine of eleven confirmed; two remain to be identified.

| Database | Page ID | Data Source ID |
|---|---|---|
| **Charter (Project Charter — page, not DB)** | `3534912f-90bd-81db-b29d-d35edf65665b` | — |
| **Pricing** | `c1a1acdf-5a69-4150-abaf-45dc3a1d4273` | `d680b4ad-16d8-42b1-ac94-2a3fbe08fd13` |
| **Partner Profiles** | `ecfc0a1d-3838-41ba-8d19-398d1774fe63` | `abb67c20-4925-42e3-911c-f9f1f6be42dd` |
| **Policies** | `95898e10-896a-4c1e-a7f8-213bd3eeca03` | (fetch) |
| **FAQ** | `d5472634-d4f4-4758-8d67-622b5faa6bdd` | (fetch) |
| **HSB Members** | `b907aeea-576e-4ab6-87a3-9bb2a6144704` | (fetch) |
| **HSB Member Adventures** | `e06e888d-d4a4-4183-9e54-978563c500f0` | (fetch) |
| **Events & Tournaments** | (page TBD) | `0e164287-d4f1-43fd-a510-6626601df7f1` |
| **Source Documents** | `9c20d400e7904c1aaf15de1aa50e7b92` | `fde68cfb-d060-4e9d-9c64-3c563b911214` |
| **Used In Quotes** | (page TBD) | `feb41466-b96a-46a7-837a-1ecc2ab0235c` |

Source Documents is the canonical index of every artifact built across the system. Every new HTML template gets a row there with Status `Authoritative` or `Reference`.

---

## 5. The Charter — twelve principles

Lives at Notion page `3534912f-90bd-81db-b29d-d35edf65665b`. Last updated 2026-05-14.

| # | Principle | Working note |
|---|---|---|
| 1 | **Notion canonical** | Notion wins over Drive when they disagree. Eleven canonical databases. |
| 2 | **Member Pricing Convention** | Universal 20% off retail for direct members (Channel A). Does NOT stack on Channel B Hotel Group. |
| 3 | **Bundle Trap (TX §151.0048)** | Instructor labor exempt only when isolated. Always isolate. |
| 4 | — | (pull from Notion) |
| 5 | — | (pull from Notion) |
| 6 | **Confidentiality** | Partner pricing, wholesale, margin never on guest-facing surfaces. Two-document workflow enforces at file level. |
| 7 | **Single-Payer Billing** | Host-of-Record concept; authenticated booking entity carries the line. |
| 8 | — | (pull from Notion) |
| 9 | — | (pull from Notion) |
| 10 | — | (pull from Notion) |
| 11 | **Visibility / Channel** | Structured properties for visibility (Public/Member-Only/Internal-Only/Confidential) and channel routing. |
| 12 | **Tax Application** | TX 8.25% on taxable lines; Bundle Trap on instructor lines. |

**Next-iteration action:** fetch the Charter page and write back the full text of #4, #5, #8, #9, #10.

---

## 6. Standing Rules

From Bearings §6 — do not violate without explicit Nicholas approval:

- **Notion schema:** Do not add, remove, or rename properties or databases without Nicholas's explicit go-ahead.
- **HSB portal:** Do not touch HSB portal files in `/outputs/rhythm-deploy/`. A parallel thread owns that surface.
- **Draft policy:** Do not promote any policy from `Draft` to `Active` without Nicholas's review.
- **Camp Lucy bid template:** Per Nicholas directive 2026-06-03, the v2.5 in `/outputs/` supersedes the Drive v2.4. Updates flow forward; do not revert.
- **Reactive bid pattern:** URL-param driven; `computeTotals()` uses `TAX_RATE = 0.0825`; instructor-exempt lines stay isolated.
- **When in doubt:** propose, don't ship.

---

## 7. HHSC Membership Stack (2026 Edition)

| Tier | Initiation | Monthly | Status |
|---|---|---|---|
| Corporate | $12,500 + tax | $750 + tax | Active |
| Legacy Family | $8,500 | $325 | Active |
| Limited Household | $5,950 | $295 | Active |
| Individual | $3,450 | $195 | Active |
| Out-of-State | $3,450 | $195 | Active |
| Safety Team | $0 (waived) | $325/mo per 5 participants | **DRAFT** |

Grandfathered **Shotgun-Family** ($125/mo, $1,500/yr) preserved indefinitely; forced migration once the clubhouse is operational. Not in public 2026 lineup.

---

## 8. HHSC Guest & Safety Policy v3.0 — The Five Triggers + Master Fee Schedule

| Trigger | Effect |
|---|---|
| **9+ total** | Reservation required (Private Event classification). 72-hour minimum advance. |
| **5+ guests** | Per-guest fee rises to $75. Dedicated club RSO included. |
| **5+ guests on pistol bays** | Concierge Booking with mandatory instructor. Reserved bay, premium amenities. |
| **15+ guests** | Senior Professional Instructor required. |
| **20+ guests** | Two Senior Professional Instructors required. |

| Guest Count | Per-Guest Fee | Tier | Safety Requirement |
|---|---|---|---|
| 1–4 | $50 | Standard | Staff on property; no dedicated RSO required. |
| 5–9 | $75 | Concierge | Dedicated club RSO + bay reservation + shade tent + water cooler. |
| 10–14 | $95 | Concierge+ | Club RSO + additional RSO. |
| 15–19 | $115 | Private Event | Club RSO + Senior Professional Instructor. |
| 20–24 | $125 | Private Event | Two Senior Professional Instructors. |

**Standing rules:**
- **RSO ratio:** 1 RSO per 5 guests. Members and Keyholders excluded from the count. Round up.
- **Minors 17 and under:** Exempt from guest fees. Must be supervised by an adult or Member at all times.
- **Corporate Rule of 8:** Any Corporate gathering exceeding eight individuals (including Authorized Executives) is a Private Event.
- **Returned-payment fee:** $25.
- **Member resignation:** 30-day written notice.
- **Initiation Fee:** non-refundable upon receipt.

**HHSC operating hours:** Monday–Sunday, 8:00 AM – 8:00 PM. Off property by 8:00 PM. Shooting ends at sundown. Office staffed Tuesday–Saturday, 10 AM – 4 PM.

---

## 9. HSB Sporting Club — member economics, hours, facilities (Q&A 5.12.26)

**Membership economics:**
- Initiation: **$2,950 + tax** ($243.38 = $3,193.38 grand total)
- Monthly dues: **$295 + tax**
- Cart fee: $15/person + tax (annual cart plan under consideration)
- Guest fee (Adult, 16+): $85/person (includes cart, clays)
- Junior guest (15 and under): $55 (includes cart and clays)
- Guests per visit: up to 5 (larger groups need GM approval)
- Guests per year per guest: 3 max
- Non-shooting guests: no additional fee (counted toward 5-guest cap)
- Reservations required only for groups of 6+

**Operating window (canonical member hours per Q&A 5.12.26):**
- **Summer (June 1 – August 31):** Tue–Sat 9:00 AM – 5:00 PM | Sun 10:00 AM – 5:00 PM
- **Winter (September 1 – May 31):** Tue–Sat 9:00 AM – 6:00 PM | Sun 10:00 AM – 6:00 PM
- **Closed Monday only.**
- Bar hours: 12:00 PM – 7:00 PM.

**HSB SC Channel B partner channel** inherits the member operating calendar per Nicholas directive 2026-06-03 (Notion Partner Profile `3754912f-90bd-81b3-8e6f-e12b7d4c563c` updated). Partner intake form enforces 09:00–16:00 as the safe year-round window with seasonal nuance documented.

**Children and shooting policy (UPDATED per Q&A 5.12.26 — supersedes earlier versions):**
- **16+ may drive carts.**
- **21+ may shoot without an adult present.**
- **20 and under must have an adult present.** Applies to youth shotgun and youth pistol teams.
- Members must be 21 or older to shoot unsupervised.
- The Club may allow exceptions under instructor supervision at its discretion.
- A person's capability also determines whether an instructor is required, regardless of age.
- All participants required to complete the onboarding safety orientation prior to shooting.

(Note: this is a tightening from the earlier 5.1.26 version which had 18+ unsupervised, 17- needs adult.)

**Facilities:**
- Sporting clays course — 12 stations (visible on facility map)
- Flurry deck
- East Shooting Deck + West Shooting Deck
- **Helice Ring** (brand differentiator)
- Pistol and carbine bays
- Trophy Room (bar + game room)
- Clubhouse with firepit
- Pro Shop
- Conference room, lounges
- Full coffee bar
- Shower (no full locker rooms)

**Technical specs:**
- Caliber limit: up to 5.56/300 Blackout
- Rifle zeroing: up to 50 yards (longer at Packsaddle)
- Targets: paper and steel
- Loads: lead shot only (7.5–9), 24" minimum barrel at shotgun stand and shooting decks
- Shorter shotguns permitted at pistol bays

**Facilities NOT currently offered:** skeet, trap, long-range. Long-range moves to Packsaddle Precision. Skeet/trap "may be coming soon."

**The Bronco** at Horseshoe Bay Resort is separate from the Sporting Club. The Sporting Club operates independently in partnership with The Club at Horseshoe Bay.

**HSB SC Group Event Policy v1.0** lives at Notion `3524912f-90bd-81b0-97af-c8339e7699b2` (full policy) with Quick Reference at `3524912f-90bd-81b0-b77b-f1c8816ad9ae`. Effective 2026-04-30. HSB SC has its own policy distinct from HHSC's v3.0 — reservations required only for groups of 6+ (not 9+).

**Hunting Experiences:** Training and guided hunts coming soon.

**Corporate memberships:** Not currently available at HSB SC (per Q&A 5.12.26).

---

## 10. Packsaddle Precision — active property

- Located at Packsaddle Mountain (Llano County)
- 1,250 yards maximum distance
- 6–9 ranges, 2 covered decks, 10 shooters per deck
- Caliber limit: 30 cal for general range usage
- Member-only, no walk-ins; membership not required for training
- Membership: Initiation ~$1,250–$1,450, monthly ~$125
- Revenue projections: Year 1 (2026) $400–500K · Year 2 $800K–1.2M · Year 3 $1M–1.5M
- Year 1 revenue split: 50% training / 15% events / 35% memberships
- Operating cadence: 5 days/week, Wednesday–Sunday
- **Senior Instructor:** Casey Duran

---

## 11. The two partnership programs (Channel B Hotel Group)

### Camp Lucy Resort × Hog Heaven (`camp-lucy-resort`)

- **Notion Partner Profile ID:** `3724912f-90bd-81c5-aa6a-c292d96d19c0`
- **Intake passcode:** `CampLucyResort`
- **Markup features / instructor:** 25% / 15%
- **F&B policy:** `excluded_partner_bids`
- **Operating window:** Tue–Sat 9 AM – 4 PM (Camp Lucy-specific, not full HH member hours)
- **Resort contacts:** Catherine Mears, Taylor Crawford
- **Intake recipients:** zanna@hhsporting.com, adam@hhsporting.com (transition pending HHSC GM resolution), nicholas@rhythm.co, jeff@hhsporting.com

**Three packages:**
- **Last Stand – Shotgun Showdown** (PRC-97): $145 SC / $185 retail
- **Hill Country Sporting Clay Pigeon Roundups** (PRC-98): $145 SC / $185 retail
- **The Texas Pistol Range** (Camp Lucy package): $125 retail. Pistol Instructor required at all party sizes at $395 retail / $343 wholesale (15% markup applied 2026-06-03)

**Shotgun instructor** (PRC-104): $304 wholesale / $350 retail (15% markup applied 2026-06-03)

### Horseshoe Bay Resort × HSB Sporting Club (`horseshoe-bay-resort`)

- **Notion Partner Profile ID:** `3754912f-90bd-81b3-8e6f-e12b7d4c563c`
- **Intake passcode:** `HSBResort`
- **Markup features / instructor:** 25% / 15%
- **F&B policy:** `excluded_partner_bids`
- **Operating window:** Tue–Sun, closed Monday only, seasonal time bands (matches HSB SC member calendar)
- **HSB SC primary contact:** Adam McCaw (GM); supporting: Cassi Payne (AGM), Cuatro Smith (Sales & Partnerships)
- **Resort partner concierges per Estimating Templates _INDEX:** Lacee, Remington
- **Intake recipients:** Lacee, Remington, Cassi Payne, Nicholas, Jeff Blackburn

**Four packages:**

| SKU | Marketing Name | SC Cost | Retail | Notes |
|---|---|---|---|---|
| HSB-HGE-001 | Shotgun Standard | $156 | $195 | Self-guided default; optional instructor at $345 (1:3 per shotgun) |
| HSB-HGE-002 | Shotgun Premium | $180 | $225 | Senior Instructor MANDATORY (1:3 per shotgun); $24 Premium Tier Service line |
| HSB-HGE-003 | The Texas Pistol Range | $117 | $147 | Proposed; mandatory Certified Instructor (1:5 per student); custom striker-fired w/ red dots |
| HSB-HGE-004 | The Carbine Range | $129 | $161 | Proposed; mandatory Certified Instructor (1:5 per student); suppressed AR-15s w/ optics |

**HSB SC Hotel Group Instructor** SKU: $300 wholesale / $345 retail (15% markup). TX §151.0048 exempt; separate POS line.

**Universal locks (HSB SC):**
- Range Access / Facility: $30 SC cost across all four packages.
- Firearm Rental: $52 SC cost (matches canonical Firearms Rental Any Model SKU PRC-95/96 walk-in retail; $41.60 member).
- Pistol rental: belt, holster, mag pouches included free.
- Ammunition: $36 (Standard/Premium shotgun), $25 (Pistol 100 rounds), $32 (Carbine rifle).
- Clay Targets: $38 (Shotgun events). Paper targets $10 (Pistol), $15 (Carbine).
- F&B: excluded from per-guest; Resort bids separately via Hotel Banquets.
- Tax: 8.25% on per-guest lines only; instructor exempt.

---

## 12. Brand systems

### Hog Heaven Sporting Club (HHSC + Hog Heaven × Camp Lucy)

**Source:** `02_Brand & Standards / HH - Brands / HH Colors and Fonts.pdf` (Drive `1UlcygRdV1_ppH8T7ywGbCGOt-ZuhDLsk`).

**Colors:**
- Primary dark: `#232b26` (deep forest)
- Primary accent: `#c95d2d` (warm rust)
- Secondary: `#c2b695` (khaki)
- Tint: `#ecd9ca` (cream)

**Fonts (canonical):**
- Display: **P22 Mackinak**
- Headings (H1, H2): **Arpona**
- Sub-headings (P1): **Arpona Sans**
- Body (P2): **Libre Franklin**

Camp Lucy artifacts updated 2026-06-03 to declare canonical font names with **Fraunces** + **Manrope** as Google Fonts fallbacks until @font-face declarations with licensed font files are added. P22 Mackinak and Arpona are commercially licensed; not in Drive HH-Brands folder.

**Logo variants (PNG):** `HH_Primary` · `HH_Horizontal` · `HH_Emblem` · `HH_Hog` · `HH_Monogram` (plus White variants). Source: Drive `1ldE6A6bc8dUWwhy1FlfR6WQlbeEtmA0K`.

### Horseshoe Bay Sporting Club

**Logo identity:** HB monogram inside circular badge with "HORSESHOE BAY SPORTING CLUB" + "ESTD 2025" (established 2025). Brand mark visible on Q&A 5.12.26 facility page.

**Working brand canonicals (pending HSB-Brands folder verification at Drive `1s6NJ9ZuKSTY1VOkhFd2Rx__ilOnGYjDq`):**
- Olive: `#3F4A21`
- Olive deep: `#2A3216`
- Tan: `#B89C73`
- Cream: `#E8E4D5`
- Paper: `#FBFAF3`
- Amber accent: `#C68C2E`

**Fonts (working):** Cormorant Garamond + Inter.

### Rhythm Outdoors (parent brand)
Per accountability chart styling:
- Background: `#161B17`
- Card: `#232B26` (matches HHSC primary dark)
- Cream: `#ECD9CA`
- Tan: `#C2B695`
- Accent: `#D4682E` (similar to HHSC rust)
- Typography: **Zilla Slab** (display/headings) + **Libre Franklin** (body)

**Division colors (from accountability chart):**
- Ownership: `#E0CBA8` (parchment)
- Executive: `#AFC0A0` (sage)
- Rhythm Central: `#D4A24E` (gold)
- Rhythm Media: `#C98A3A` (amber)
- Hog Heaven SC: `#C95D2D` (rust — matches HH primary accent)
- Horseshoe Bay SC: `#4E8FA0` (teal)
- Packsaddle Precision: `#8B997A` (sage-green)

---

## 13. The Estimating Templates registry

Per Drive `_INDEX.md` at `Rhythm AI Schemas / 06_Sales & Marketing / Estimating Templates /` (file ID `1qgr0pE9iF1zFyjTvdFbxSpVTeyIK5hxQ`):

**Conventions every template follows:**
- One file per template (self-contained HTML).
- Header comment block: brand, audience, last-sync date, source DB ID, Drive Pricing folder, Charter link, status.
- Customer-facing pricing only on guest-facing templates.
- Pricing constants in a `RATES` object near top of JS.
- Tax application per Charter Principle #12.
- Notion registration: every template has a Source Documents row.

**Existing canonical templates:**

| Template | Status |
|---|---|
| Rhythm Intake Form — Direct/Public v1.1 | 8-screen progressive (HSB/HH/Packsaddle paths) |
| Rhythm Partner Intake Form v1.0 | 7-screen passworded (HSB:`HSBResort` / HH:`CampLucy`) |
| HSB Group Event Bid — STANDARD | ★ AUTHORITATIVE (Channel C focused) |
| HSB Membership Showcase — STANDARD | ★ AUTHORITATIVE (membership previews) |
| HSB Members Portal v0.3 | ⚑ WIP |
| HH × Camp Lucy Partner Pricing Guide v2.1 | Notion `3584912f-90bd-819b-9f90-edde218a850e` |
| HH × Camp Lucy Sales Reference Card v1.0 | Sales-desk reference |
| HH × Camp Lucy Group Proposal v2.4 → v2.5 | Notion `3584912f-90bd-81ad-bb38-c79a1f2aa02b` (v2.5 supersedes per Nicholas 2026-06-03) |

**Per Nicholas directive 2026-06-03:** HSB Partner Pricing Guide v1.5, HSB Sales Reference Card v1.0, HSB Customer Sales Brochure, HSB Partner Intake Form v1.0, and Camp Lucy `05_Group_Proposal_Template_v2.5.html` built in the 2026-06-03 session supersede their Drive predecessors as the latest canonical.

---

## 14. Chart of Accountability — full roster

Per `rhythm-accountability.html` revised 2026-06-15.

### Founders & Owners (Ownership)
| Name | Role | Accountabilities |
|---|---|---|
| **Nicholas Vedros** | Founder / Owner | Business Vision · Legal & Financial Oversight · Strategic Relationships & Expansion |
| **Hannah Vedros** | Founder / Owner | Experience Vision · Expense Recording & Payroll · Human Resources |

### Executive
| Name | Role | Accountabilities |
|---|---|---|
| **Jeff Blackburn** | Chief Operating Officer | Operations Oversight · Process Capture & Creation · Organizational Design |
| **Savannah Ames** | Chief Financial Officer | Financial Planning · Financial Accounting · Taxes |
| **PJ Ajibola** | Bookkeeping & Office Admin (reports to Savannah) | Bookkeeping · AP/AR · Financial Reporting · Office Admin |

### Rhythm Central
| Name | Role | Accountabilities |
|---|---|---|
| **Ryan Schweke** | Director of Marketing | Brand Management · Membership Growth & Retention · Digital Event Sales |
| **Laryd Dugat** | Marketing Coordinator (reports to Ryan) | Recurring Marketing HH · Recurring Marketing HSB SC · Project Support |
| **Jake Saenz** | Education & Adventure Architect | Strategic E&A Programming · Curriculum Design & Approval · Instructor Standards & Cadre Development |
| **John Johnson** | Lead Pistol Instructor (reports to Jake) | Pistol Program Delivery · Curriculum Execution · Cadre Standards |
| **Cooper Weatherby** | Lead Rifle Instructor (reports to Jake) | Rifle & Precision Instruction · Curriculum Execution · Cadre Standards |
| **Madison Sharpe** | Lead Shotgun Instructor (reports to Jake) | Shotgun Program Delivery · Curriculum Execution · Cadre Standards |
| OPEN | Director of Programming & Events | Community & Culinary Programming · Event Systems & Logistics · Cross-Pillar CLEAR Integration |

### Rhythm Media (reports up through Ryan)
| Name | Role | Accountabilities |
|---|---|---|
| **Christine Tolson** | Executive Producer | Content Strategy & IP Development · Content Production · Production Management |
| OPEN | Editor / Story Director | Edit & Story Direction · Post-Production Pipeline · Narrative & IP Continuity |
| OPEN | Camera Operator / 1st AC | Principal Photography · Camera & Lens Management · On-Set Production Support |

### Hog Heaven Sporting Club (Dripping Springs)
| Name | Role | Status | Accountabilities |
|---|---|---|---|
| **Brandon Evans** | General Manager · Hog Heaven | **HOPEFUL** | HH Facility Operations Oversight · Admin Approvals & Payroll · Membership Experience |
| **Georgia Stone** | Director of Event Sales & Relationships | Active | Event Sales Outreach · Membership Sales Outreach · CRM Database Management |
| **Courtney Ward** | Assistant General Manager | Active | GM Support · Club Admin & Office Processes · Member Support & Reporting |
| **Zannah Ward** | Events Coordinator | Active | Event Sales/Planning/Coordination · Property Management Support · Office & Member Support |
| **Luke Benton** | Sr. Ranch Hand | Active | Facility Presentation · Managing Ranch Hands · Machine/Clay Inventory & Maintenance |
| **Caleb Reese** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |
| **Joshua Gray** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |
| OPEN | Ranch Hand | Open | Member Hospitality · Facility Upkeep · Event Preparation |

*(Zannah Ward is the same person previously referenced as "Zanna" — emergency contact 512-801-2065 per Bearings.)*

### Horseshoe Bay Sporting Club (Lake LBJ)
| Name | Role | Status | Accountabilities |
|---|---|---|---|
| **Adam McCaw** | General Manager · Horseshoe Bay | **Active** | HSB Membership Experience · HSB Operations · HSB Facility Oversight |
| **Cuatro Smith** | Sales & Partnerships | Active | Event Sales Outreach · Membership Sales Outreach · CRM Database Management |
| **Cassi Payne** | Assistant General Manager | Active | Membership Hospitality · Front Desk Functions · Event Sales & Execution |
| **Marlee** | Assistant to the Assistant | Active | AGM Support · Front Desk & Member Support · Event & Office Coordination |
| OPEN | Bartender | Open | Membership Hospitality · Bar & Beverage Service · Event Support |
| **Michael Gutierrez** | Sr. Ranch Hand | Active | Facility Presentation · Managing Ranch Hands · Machine/Clay Inventory & Maintenance |
| **Will De Dufour** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |
| **Joe Portillo** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |
| **Chase Giddens** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |
| **Bill Hamilton** | Ranch Hand | Active | Member Hospitality · Facility Upkeep · Event Preparation |

**Jay Krug has been removed from the HSB SC organization.** Previous Q&A 5.1.26 listed him as GM; Q&A 5.12.26 omits the GM section entirely. Chart of Accountability rev 2026-06-15 lists Adam McCaw in that seat. Update propagated to Notion HSB Resort Partner Profile on 2026-06-16.

### Packsaddle Precision (Llano County)
| Name | Role | Status | Accountabilities |
|---|---|---|---|
| **Casey Duran** | Senior Instructor · Packsaddle | Active | Primary Instruction & Delivery · Training Module Curriculum · Brand Culture & Media Experience |
| OPEN | Assistant General Manager | Open | GM Support · Club Admin & Office Processes · Member Support & Reporting |
| OPEN | Sr. Ranch Hand | Open | Facility Presentation · Managing Ranch Hands · Machine/Clay Inventory & Maintenance |
| OPEN | Ranch Hand | Open | Member Hospitality · Facility Upkeep · Event Preparation |

### Roster summary
- **Total seats:** 32 (per accountability chart counter)
- **Filled (active):** 23
- **Hopeful (not yet confirmed):** 1 (Brandon Evans as HH GM)
- **Open seats:** 8
- **Properties:** 3 (HHSC, HSB SC, Packsaddle Precision)

---

## 15. Pricing model (canonical)

### Three-step ladder
`SC Cost (Wholesale Rate)  →  × Markup Pct  →  Final Retail`

### Differential markup per partner profile
- `Markup Features Pct` — per-guest experience lines. Both partnerships: **25%**.
- `Markup Instructor Pct` — instructor labor. Both partnerships: **15%**.

### Two-line customer estimate
1. **Per-guest experience** = guests × per-guest customer rate (taxable 8.25% TX).
2. **Per-instructor staffing** = instructor count × per-instructor customer rate (TX §151.0048 EXEMPT, separate POS line).

Instructor count = `ceil(headcount ÷ ratio_denominator)`, minimum 1 if `instructor_required_when = always`.

### Two-document workflow
Every quote generates Customer Estimate (forward to guest, retail only) + Internal Reconciliation (partner-confidential, SC cost + markup math + invoice template). File-level split prevents confidential leakage.

---

## 16. Open gaps and next-iteration priorities

### Charter content
- Pull full text of Charter principles #4, #5, #8, #9, #10 from Notion.

### Bearings doc updates
- Bearings (2026-05-07) cites `membership@sportsmansfinest.com` — superseded by `adam@hhsporting.com` per Verification Report (2026-05-08) and now in transition since Adam moved to HSB SC GM. Propose a Bearings edit reflecting the GM transitions.

### HHSC routing transition
- Adam McCaw moved from HHSC routing to HSB SC GM. Who owns `adam@hhsporting.com` now? Brandon Evans (HHSC GM, hopeful) or Courtney Ward (HH AGM)? Confirm with Nicholas.

### Notion data
- Fetch and document the eleven canonical databases. Two remain to be identified.

### HSB SC brand canonicals
- Read the HSB - Brands folder (`1s6NJ9ZuKSTY1VOkhFd2Rx__ilOnGYjDq`) and verify/correct working font + color canonicals. Current Cormorant Garamond + Inter is unverified against the Drive.

### Pistol and Carbine pricing validation
- HSB-HGE-003 and HSB-HGE-004 remain Proposed at $117/$147 and $129/$161. Flip to Published once Nicholas validates.

### HH font files
- P22 Mackinak, Arpona, Arpona Sans are licensed fonts not in the Drive HH - Brands folder. Source the font files and add @font-face declarations to Camp Lucy artifacts.

### Drive sync of superseded canonicals
- Update Drive copies of HH × Camp Lucy Group Proposal (v2.4 → v2.5) and Rhythm Partner Intake Form (v1.0 → HSB-specific).

### Source Documents DB hygiene
- Register HSB Partner Pricing Guide v1.5, HSB Sales Reference Card v1.0, HSB Customer Sales Brochure, HSB Partner Intake Form v1.0, HSB Image Filename Map, HSB Final Handover README in Source Documents.

### Imagery
- HSB SC `staples/` folder needs population. Nine files defined; none exist yet.

### Pricing artifacts and accountability
- HSB Pricing Guide v1.5, Sales Reference Card v1.0, Customer Brochure, Intake Form, Handover README do not currently name Adam McCaw, Cassi Payne, or Cuatro Smith. Update on next iteration of any of these to introduce the HSB SC GM team.

---

## 17. Agent operating model

### Voice and tone
Eloquent, professional, visionary. Concise, direct prose. Minimal formatting drag.

### Authority defaults
- Notion writes touching financial data: verify direction, surface ambiguity.
- Notion schema changes: require explicit Nicholas approval per Standing Rules.
- Promoting policy Draft → Active: explicit Nicholas approval.
- Recreating canonical templates: reference, don't rebuild, unless sanctioned.
- Email send on user's behalf: draft, surface, await confirmation.
- Deployment to Netlify: prepare, surface, let user deploy unless explicitly delegated.

### Defaults for ambiguity
- Honor canonical Notion SKU values over derived inferences.
- Preserve customer-facing retail anchors; adjust non-inventory allocation.
- Preserve Bundle Trap (instructor isolated, exempt).
- Preserve differential markup (25% features / 15% instructor) unless partner profile says otherwise.
- F&B exclusion when configured at partner level.
- Two-document workflow on every quote.
- "When in doubt, propose, don't ship."

### Tool ordering
1. Read for known paths; Grep/Glob for code searches; Explore for open-ended.
2. Drive: `mcp__77a26875-...__search_files` then `read_file_content`.
3. Notion: `notion-search` for page IDs, then `notion-fetch` for content. Pass `collection://` URLs to `data_source_url`.
4. Schema changes: `notion-update-data-source` (DDL); `notion-update-page` (content); `notion-create-pages` (new rows).
5. Verify property exists before updating. Use exact property names from data-source fetch.
6. Surface large or financially impactful writes before committing.

### Session start ritual
1. Read this Corpus v2.1 in full.
2. Read the live Bearings doc for any updates since this corpus's date.
3. Read the live `rhythm-accountability.html` for any personnel updates.
4. For Charter-canonical questions, fetch the Charter page from Notion.
5. For HSB SC member-side questions, refer to HSBC Q&A 5.12.26 (or newer).
6. For Guest Policy questions at HHSC, cite Guest & Safety Policy v3.0 by section.
7. For HSB work, confirm with Nicholas whether the parallel `/outputs/rhythm-deploy/` thread owns the topic.

---

## 18. Document history

- **v2.1 (2026-06-16):** Adam McCaw → HSB SC GM (Jay Krug removed). HSBR Sporting Club LLC + HSBRSC Operating Company LLC added as canonical legal entities. HSBC Q&A 5.12.26 absorbed (supersedes 5.1.26). Child shooting policy updated to 21+/20- (was 18+/17-). Full Chart of Accountability (32 seats) added in §14 (rev 2026-06-15). Rhythm Media as distinct division. Lead Instructor tier (John Johnson, Cooper Weatherby, Madison Sharpe). HSB SC established 2025 per facility map.
- **v2.0 (2026-06-03):** Initial comprehensive corpus written from canonical Drive + Notion sources. Five-property model, twelve Charter principles (eight named), HHSC tier catalog, Guest & Safety Policy v3.0 Five Triggers + Master Fee Schedule, HSB SC Q&A v5.1.26 economics, brand systems, Estimating Templates registry. Superseded by v2.1.
- **v1.0 (2026-06-03):** First-pass corpus from session memory + recent Notion fetches. Had four show-stoppers (operating window, Camp Lucy proposal violation, HHSC/HH conflation, HH brand fonts) flagged by Abnormality Report. Superseded by v2.0.

— end of corpus v2.1 —

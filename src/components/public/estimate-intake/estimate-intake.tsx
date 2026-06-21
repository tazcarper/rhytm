"use client";

import { useMemo, useState, useTransition } from "react";
import { submitEstimateAction } from "@/app/(public)/request-estimate/submit/action";
import {
  CLUB_LABELS,
  CLUB_TO_SLUG,
  RULES,
  availableExperiences,
  cateringFor,
  computeEstimate,
  isComingSoon,
  isExperienceLocked,
  isHsbBlocked,
  money,
  type CateringOption,
  type ClubCode,
  type CustomLine,
  type HostCode,
  type IntakeState,
} from "./rules";
import s from "./estimate-intake.module.css";

interface EstimateIntakeProps {
  // Staff (admin-portal) viewers get the phone-intake toggle: instructor/RSO
  // math, internal notes, discount authority, and manual line items. Hidden
  // from the public.
  canUseStaffMode: boolean;
}

const ARRIVAL_OPTIONS = [
  { value: "9", label: "9:00 AM" },
  { value: "10", label: "10:00 AM" },
  { value: "12", label: "12:00 PM" },
  { value: "13", label: "1:00 PM" },
  { value: "15", label: "3:00 PM" },
];

const LESSON_HOURS = [
  { value: 2, label: "2 hours · recommended" },
  { value: 1, label: "1 hour" },
  { value: 3, label: "3 hours" },
  { value: 4, label: "4 hours" },
];

const INITIAL: IntakeState = {
  host: "member",
  club: "hsb",
  exps: [],
  addons: { ammo: 0, gear: 0, cart: false },
  catering: null,
  members: 1,
  guestAdults: 0,
  guestJuniors: 0,
  hours: 2,
  staffMode: false,
  discountValue: 0,
  discountType: "pct",
  customLines: [],
  arrival: "9",
  date: "",
};

export function EstimateIntake({ canUseStaffMode }: EstimateIntakeProps) {
  const [st, setSt] = useState<IntakeState>(INITIAL);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffRep, setStaffRep] = useState("");
  const [backupDate, setBackupDate] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");
  // Manual-line input fields (staff).
  const [custLabel, setCustLabel] = useState("");
  const [custAmt, setCustAmt] = useState("");

  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<IntakeState>) => setSt((p) => ({ ...p, ...patch }));

  const estimate = useMemo(() => computeEstimate(st), [st]);
  const memberHost = st.host === "member";

  // --- gating ---
  function pickClub(club: ClubCode) {
    set({ club, exps: [], catering: null });
  }
  function pickHost(host: HostCode) {
    set({ host, exps: [], catering: null });
  }
  function toggleExp(id: string) {
    set({
      exps: st.exps.includes(id)
        ? st.exps.filter((e) => e !== id)
        : [...st.exps, id],
    });
  }

  const exps = availableExperiences(st.club, st.host);
  const cateringSet = cateringFor(st.club, st.host);
  const showCatering = cateringSet !== null;
  const lessonSelected = st.exps.includes("lesson");

  function bump(id: "ammo" | "gear", delta: number) {
    set({ addons: { ...st.addons, [id]: Math.max(0, st.addons[id] + delta) } });
  }
  function pickCatering(opt: CateringOption | null) {
    set({ catering: opt });
  }

  function addCustomLine() {
    const label = custLabel.trim();
    const amount = Math.max(0, +custAmt || 0);
    if (!label || amount <= 0) return;
    set({ customLines: [...st.customLines, { label, amount }] });
    setCustLabel("");
    setCustAmt("");
  }
  function removeCustomLine(index: number) {
    set({ customLines: st.customLines.filter((_, i) => i !== index) });
  }

  // Composition hint under the party inputs (mirrors the prototype partyNote).
  const partyNote = memberHost
    ? `${st.members} member${st.members !== 1 ? "s" : ""} hosting ${st.guestAdults + st.guestJuniors} guest${st.guestAdults + st.guestJuniors !== 1 ? "s" : ""} · billed to the member account (single-payer). Members shoot on dues; guests pay guest fees.`
    : st.club === "hsb"
      ? "Non-member direct booking is not available at HSB."
      : `${st.guestAdults + st.guestJuniors} non-member${st.guestAdults + st.guestJuniors !== 1 ? "s" : ""} · direct booking at retail rates.`;

  function onSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please add your name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please add a valid email so we can send your bid.");
      return;
    }

    const composedNotes =
      st.staffMode && internalNotes.trim()
        ? `${notes}\n\n[Internal] ${internalNotes}`.trim()
        : notes;

    startTransition(async () => {
      const res = await submitEstimateAction(
        {
          propertySlug: CLUB_TO_SLUG[st.club],
          host: st.host,
          experiences: st.exps,
          addons: st.addons,
          catering: st.catering,
          members: memberHost ? st.members : 0,
          guestAdults: st.guestAdults,
          guestJuniors: st.guestJuniors,
          lessonHours: lessonSelected ? st.hours : null,
          customLines: st.staffMode ? st.customLines : [],
          name,
          email,
          phone,
          preferredDate: st.date,
          backupDate,
          arrival: st.arrival,
          notes: composedNotes,
          indicativeTotal: estimate.grandLabel,
          staffMode: st.staffMode,
          staffRepName: staffRep,
        },
        honeypot,
      );
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.message);
      }
    });
  }

  if (submitted) {
    return (
      <div className={s.wrap}>
        <div className={s.successCard}>
          <div className={s.kick}>Estimate request created</div>
          <h2 className={s.successTitle}>
            {st.staffMode ? "Lead logged for the customer" : "Thanks — we've got it"}
          </h2>
          <p className={s.successBody}>
            {st.staffMode
              ? "This created an estimate request (a lead) and dropped it into the admin queue. A coordinator builds the binding bid; the customer gets a link to review, sign, and pay."
              : "Your request is in. Our team will build your bid and send a link to review, sign, and pay a deposit — no phone tag."}
          </p>
          <button
            type="button"
            className={s.secondaryBtn}
            onClick={() => {
              setSubmitted(false);
              setSt(INITIAL);
              setName("");
              setEmail("");
              setPhone("");
              setNotes("");
              setInternalNotes("");
              setBackupDate("");
            }}
          >
            Start another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <header className={s.top}>
        <div>
          <div className={s.kick}>Rhythm Outdoors · Estimate Request</div>
          <h1 className={s.h1}>Plan your outing</h1>
        </div>
        {canUseStaffMode && (
          <div className={s.modeWrap} role="tablist" aria-label="Mode">
            <button type="button" className={!st.staffMode ? s.modeOn : ""} onClick={() => set({ staffMode: false })}>
              Customer
            </button>
            <button type="button" className={st.staffMode ? s.modeOn : ""} onClick={() => set({ staffMode: true })}>
              Staff (phone)
            </button>
          </div>
        )}
      </header>
      <p className={s.modeNote}>
        {st.staffMode
          ? "Staff mode — full phone-intake: instructor/RSO math, internal notes, discount authority, and manual line items. Fill it while the customer is on the line."
          : "Tell us about your outing and we'll build a bid you can review, sign, and pay online."}
      </p>

      <div className={s.grid}>
        <div>
          {/* 1 · WHO'S BOOKING */}
          <section className={s.card}>
            <h3 className={s.cardH}>1 · Who&apos;s booking</h3>
            <p className={s.sub}>
              A member host can bring non-member guests (guests pay guest fees). At HSB a member must host;
              HH also allows non-member direct bookings.
            </p>
            <div className={s.seg}>
              <button type="button" className={memberHost ? s.optOn : s.opt} onClick={() => pickHost("member")}>
                Member-hosted
              </button>
              <button type="button" className={!memberHost ? s.optOn : s.opt} onClick={() => pickHost("nonmember")}>
                Non-member (direct)
              </button>
            </div>
            <div className={s.row} style={{ marginTop: "10px" }}>
              <div>
                <label className={s.fld}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className={s.fld}>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
            </div>
            {st.staffMode && (
              <div className={s.row} style={{ marginTop: "10px" }}>
                <div>
                  <label className={s.fld}>Caller phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(xxx) xxx-xxxx" />
                </div>
                <div>
                  <label className={s.fld}>Taken by (staff)</label>
                  <input value={staffRep} onChange={(e) => setStaffRep(e.target.value)} placeholder="Staff member name" />
                </div>
              </div>
            )}
          </section>

          {/* 2 · CLUB */}
          <section className={s.card}>
            <h3 className={s.cardH}>2 · Which club</h3>
            <p className={s.sub}>The club gates everything below.</p>
            <div className={s.seg}>
              {(Object.keys(CLUB_LABELS) as ClubCode[]).map((code) => (
                <button key={code} type="button" className={st.club === code ? s.optOn : s.opt} onClick={() => pickClub(code)}>
                  {CLUB_LABELS[code]}
                  {isComingSoon(code) && <span className={s.soon}> SOON</span>}
                </button>
              ))}
            </div>
          </section>

          {/* 3 · EXPERIENCES */}
          <section className={s.card}>
            <h3 className={s.cardH}>3 · Experiences</h3>
            <p className={s.sub}>Pick one or more.</p>
            {isComingSoon(st.club) ? (
              <div className={s.gate}>
                <div className={s.gateT}>Packsaddle Precision — Coming Soon</div>
                <div className={s.gateD}>
                  Our precision long-range program is still being built, so we can&apos;t quote it yet.
                  Leave your details and we&apos;ll reach out the moment it opens.
                </div>
              </div>
            ) : isHsbBlocked(st.club, st.host) ? (
              <div className={`${s.gate} ${s.gateBlock}`}>
                <div className={s.gateT}>Members only</div>
                <div className={s.gateD}>
                  Horseshoe Bay Sporting Club is private — shooting is reserved for members and their
                  accompanied guests. Non-members can&apos;t book here. Become a member, or have a member host you.
                </div>
              </div>
            ) : (
              <div>
                {exps.map((e) => {
                  const locked = isExperienceLocked(e, st.host);
                  const on = st.exps.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      disabled={locked}
                      className={`${s.exp} ${on ? s.expOn : ""} ${locked ? s.expLocked : ""}`}
                      onClick={() => !locked && toggleExp(e.id)}
                    >
                      <span>
                        <span className={s.expT}>{e.t}</span>
                        <span className={s.expD}>
                          {locked ? "Members only — not available to non-members" : e.d}
                        </span>
                      </span>
                      <span className={s.expMark}>{locked ? "✕" : on ? "✓" : "+"}</span>
                    </button>
                  );
                })}
                {lessonSelected && (
                  <div style={{ marginTop: "12px" }}>
                    <label className={s.fld}>
                      Private lesson length — standard block is 2 hours; privates extend hourly.
                    </label>
                    <select value={st.hours} onChange={(e) => set({ hours: +e.target.value })}>
                      {LESSON_HOURS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4 · PARTY COMPOSITION */}
          <section className={s.card}>
            <h3 className={s.cardH}>4 · Who&apos;s in the party</h3>
            <p className={s.sub}>
              Members shoot on their membership; non-member guests pay guest fees. Capture both — a party can
              be 2 members hosting 10 guests.
            </p>
            {memberHost && (
              <div className={s.row}>
                <div>
                  <label className={s.fld}>Members in party</label>
                  <input
                    type="number"
                    min={0}
                    value={st.members}
                    onChange={(e) => set({ members: Math.max(0, +e.target.value || 0) })}
                  />
                </div>
                <div />
              </div>
            )}
            <div className={s.row}>
              <div>
                <label className={s.fld}>{memberHost ? "Guest adults (16+)" : "Adults (16+)"}</label>
                <input
                  type="number"
                  min={0}
                  value={st.guestAdults}
                  onChange={(e) => set({ guestAdults: Math.max(0, +e.target.value || 0) })}
                />
              </div>
              <div>
                <label className={s.fld}>{memberHost ? "Guest juniors (15 & under)" : "Juniors (15 & under)"}</label>
                <input
                  type="number"
                  min={0}
                  value={st.guestJuniors}
                  onChange={(e) => set({ guestJuniors: Math.max(0, +e.target.value || 0) })}
                />
              </div>
            </div>
            <div className={s.partyNote}>{partyNote}</div>
          </section>

          {/* 5 · ADD-ONS */}
          <section className={s.card}>
            <h3 className={s.cardH}>5 · Add-ons</h3>
            <p className={s.sub}>Ammo needs a quantity; others are per-person or yes/no.</p>
            {RULES.addons.map((a) => (
              <div key={a.id} className={s.addon}>
                <div>
                  <div className={s.addonNm}>{a.nm}</div>
                  <div className={s.addonMeta}>{a.meta}</div>
                </div>
                {a.shape === "bool" ? (
                  <button
                    type="button"
                    className={st.addons.cart ? s.optOn : s.opt}
                    style={{ minWidth: "64px", flex: "none" }}
                    onClick={() => set({ addons: { ...st.addons, cart: !st.addons.cart } })}
                  >
                    {st.addons.cart ? "Yes" : "No"}
                  </button>
                ) : (
                  <div className={s.qty}>
                    <button type="button" onClick={() => bump(a.id as "ammo" | "gear", -1)}>−</button>
                    <input readOnly value={st.addons[a.id as "ammo" | "gear"]} />
                    <button type="button" onClick={() => bump(a.id as "ammo" | "gear", 1)}>+</button>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* F&B CATERING — HH / Packsaddle only */}
          {showCatering && (
            <section className={s.card}>
              <h3 className={s.cardH}>
                F&amp;B · Catering <span className={s.pill}>HH &amp; Packsaddle</span>
              </h3>
              <p className={s.sub}>
                Per-head, good / better / best by vendor — priced × total headcount. (HSB dining runs through The Club.)
              </p>
              <div className={s.cateringWarn}>
                ⚠ Placeholder vendors &amp; rates — <b>Salt Lick, County Line, and Contigo</b> selections and per-head
                pricing need confirmation before final sign-off.
              </div>
              {[{ tier: "None", name: "No catering", per: 0 }, ...(cateringSet ?? [])].map((o) => {
                const sel = (st.catering?.tier ?? "None") === o.tier;
                return (
                  <div key={o.tier} className={s.addon}>
                    <div>
                      <div className={s.addonNm}>
                        {o.tier}
                        {o.per ? " · " + o.name : ""}
                      </div>
                      <div className={s.addonMeta}>{o.per ? `$${o.per} / head` : "skip catering"}</div>
                    </div>
                    <button
                      type="button"
                      className={sel ? s.optOn : s.opt}
                      style={{ minWidth: "56px", flex: "none" }}
                      onClick={() => pickCatering(o.per ? o : null)}
                    >
                      {sel ? "✓" : "Pick"}
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          {/* 6 · WHEN */}
          <section className={s.card}>
            <h3 className={s.cardH}>6 · When</h3>
            <div className={s.row}>
              <div>
                <label className={s.fld}>Preferred date</label>
                <input type="date" value={st.date} onChange={(e) => set({ date: e.target.value })} />
              </div>
              <div>
                <label className={s.fld}>Backup date</label>
                <input type="date" value={backupDate} onChange={(e) => setBackupDate(e.target.value)} />
              </div>
            </div>
            <label className={s.fld}>Arrival window</label>
            <select value={st.arrival} onChange={(e) => set({ arrival: e.target.value })}>
              {ARRIVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {estimate.heat && (
              <div className={s.heat}>
                ☀ Summer heat advisory: midday arrival runs under full Hill Country sun. Morning (9–10 AM)
                or 3 PM is recommended. Water stations stocked at every stand.
              </div>
            )}
          </section>

          {/* 7 · NOTES */}
          <section className={s.card}>
            <h3 className={s.cardH}>7 · Anything else</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="First-time shooters, accessibility, dietary, VIPs, a special occasion…"
            />
            {st.staffMode && (
              <>
                <label className={s.fld}>Internal notes (staff only)</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Confidential — not shown to the customer"
                />
              </>
            )}
          </section>

          {/* STAFF · DISCOUNT */}
          {st.staffMode && (
            <section className={s.card}>
              <h3 className={s.cardH}>
                Staff · Discount authority <span className={s.pill}>staff only</span>
              </h3>
              <p className={s.sub}>Apply a comp or discount to the indicative total.</p>
              <div className={s.row}>
                <div>
                  <label className={s.fld}>Discount</label>
                  <div className={s.qty}>
                    <input
                      type="number"
                      min={0}
                      value={st.discountValue}
                      onChange={(e) => set({ discountValue: Math.max(0, +e.target.value || 0) })}
                      style={{ textAlign: "left" }}
                    />
                    <select
                      value={st.discountType}
                      onChange={(e) => set({ discountType: e.target.value as "pct" | "amt" })}
                      style={{ width: "auto" }}
                    >
                      <option value="pct">%</option>
                      <option value="amt">$</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STAFF · MANUAL LINE ITEMS */}
          {st.staffMode && (
            <section className={s.card}>
              <h3 className={s.cardH}>
                Staff · Manual line items <span className={s.pill}>staff only</span>
              </h3>
              <p className={s.sub}>
                Add anything custom to the bid — Musical Guest, Snake Trainer, Hair &amp; Makeup, etc. Flat amounts.
              </p>
              <div className={s.row}>
                <div>
                  <label className={s.fld}>Description</label>
                  <input value={custLabel} onChange={(e) => setCustLabel(e.target.value)} placeholder="e.g. Musical Guest" />
                </div>
                <div>
                  <label className={s.fld}>Amount $</label>
                  <input type="number" min={0} value={custAmt} onChange={(e) => setCustAmt(e.target.value)} placeholder="350" />
                </div>
              </div>
              <button type="button" className={s.secondaryBtn} style={{ marginTop: "9px" }} onClick={addCustomLine}>
                + Add line
              </button>
              {st.customLines.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  {st.customLines.map((c: CustomLine, i) => (
                    <div key={i} className={s.addon}>
                      <div>
                        <div className={s.addonNm}>{c.label}</div>
                        <div className={s.addonMeta}>flat · staff-added</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span>{money(c.amount)}</span>
                        <button type="button" className={s.removeLine} onClick={() => removeCustomLine(i)} aria-label="Remove line">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className={s.honeypot}
          />
        </div>

        {/* ESTIMATE PANEL */}
        <div>
          <div className={s.estimate}>
            <h3 className={s.estH}>Indicative estimate</h3>
            <div>
              {estimate.lines.length === 0 && !estimate.comingSoon && !estimate.hsbBlocked && (
                <div className={s.estNote}>Add who&apos;s in the party and an experience to see an indicative estimate.</div>
              )}
              {estimate.comingSoon && (
                <div className={s.estNote}>
                  Packsaddle Precision is coming soon — leave your details and we&apos;ll reach out when the program opens.
                </div>
              )}
              {estimate.hsbBlocked && (
                <div className={s.estNote}>
                  Horseshoe Bay Sporting Club is members-only — non-members can&apos;t bid here. Become a member, or have a member host you.
                </div>
              )}
              {estimate.lines.map((li, i) => (
                <div key={i} className={`${s.li} ${li.exempt ? s.liExempt : ""}`}>
                  <span className={s.liLbl}>
                    {li.label}
                    {li.exempt ? " · tax-exempt" : ""}
                  </span>
                  <span className={s.liAmt}>
                    {li.tbd ? "TBD" : li.negative ? `−${money(-li.amount)}` : money(li.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className={s.total}>
              <span className={s.totalLbl}>Starting from</span>
              <span className={s.totalBig}>{estimate.grandLabel}</span>
            </div>
            {estimate.escalation && <div className={s.escal}>{estimate.escalation}</div>}
            {estimate.isEvent && (
              <div className={s.eventFlag}>
                ▲ This party crosses <b>9 total</b> — it&apos;s a <b>Private Event</b>: advance reservation required
                (72-hour notice). Per-guest fees are already tiered by group size.
              </div>
            )}
            <p className={s.estFoot}>
              Indicative only — final pricing is confirmed by our team on the bid you&apos;ll sign. Clays &amp; cart
              are bundled into the per-guest fee; ammunition and instruction are separate. Instruction is tax-exempt.
            </p>
            {error && <div className={s.error}>{error}</div>}
            <button type="button" className={s.cta} disabled={pending} onClick={onSubmit}>
              {pending ? "Sending…" : estimate.ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

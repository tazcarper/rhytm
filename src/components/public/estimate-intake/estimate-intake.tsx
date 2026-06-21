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
  type IntakeState,
  type WhoCode,
} from "./rules";
import s from "./estimate-intake.module.css";

interface EstimateIntakeProps {
  // Staff (admin-portal) viewers get the phone-intake toggle: instructor/RSO
  // math, internal notes, and discount authority. Hidden from the public.
  canUseStaffMode: boolean;
}

const ARRIVAL_OPTIONS = [
  { value: "9", label: "9:00 AM" },
  { value: "10", label: "10:00 AM" },
  { value: "12", label: "12:00 PM" },
  { value: "13", label: "1:00 PM" },
  { value: "15", label: "3:00 PM" },
];

const INITIAL: IntakeState = {
  who: "member",
  club: "hsb",
  exps: [],
  addons: { ammo: 0, gear: 0, cart: false },
  catering: null,
  adults: 4,
  juniors: 0,
  staffMode: false,
  discountValue: 0,
  discountType: "pct",
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

  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<IntakeState>) => setSt((p) => ({ ...p, ...patch }));

  const estimate = useMemo(() => computeEstimate(st), [st]);

  // --- experience / club gating ---
  function pickClub(club: ClubCode) {
    set({ club, exps: [], catering: null });
  }
  function pickWho(who: WhoCode) {
    // Switching member status can lock/unlock experiences; clear to be safe.
    set({ who, exps: [], catering: null });
  }
  function toggleExp(id: string) {
    set({
      exps: st.exps.includes(id)
        ? st.exps.filter((e) => e !== id)
        : [...st.exps, id],
    });
  }

  const exps = availableExperiences(st.club, st.who);
  const cateringSet = cateringFor(st.club, st.who);
  const showCatering = cateringSet !== null;

  function bump(id: "ammo" | "gear", delta: number) {
    set({
      addons: { ...st.addons, [id]: Math.max(0, st.addons[id] + delta) },
    });
  }

  function pickCatering(opt: CateringOption | null) {
    set({ catering: opt });
  }

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
          who: st.who,
          experiences: st.exps,
          addons: st.addons,
          catering: st.catering,
          adults: st.adults,
          juniors: st.juniors,
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
            <button
              type="button"
              className={!st.staffMode ? s.modeOn : ""}
              onClick={() => set({ staffMode: false })}
            >
              Customer
            </button>
            <button
              type="button"
              className={st.staffMode ? s.modeOn : ""}
              onClick={() => set({ staffMode: true })}
            >
              Staff (phone)
            </button>
          </div>
        )}
      </header>
      <p className={s.modeNote}>
        {st.staffMode
          ? "Staff mode — full phone-intake: instructor/RSO math, internal notes, and discount authority. Fill it while the customer is on the line."
          : "Tell us about your outing and we'll build a bid you can review, sign, and pay online."}
      </p>

      <div className={s.grid}>
        <div>
          {/* 1 · YOU */}
          <section className={s.card}>
            <h3 className={s.cardH}>1 · You</h3>
            <p className={s.sub}>This sets your pricing — members see member rates.</p>
            <div className={s.seg}>
              <button
                type="button"
                className={st.who === "member" ? s.optOn : s.opt}
                onClick={() => pickWho("member")}
              >
                I&apos;m a member
              </button>
              <button
                type="button"
                className={st.who === "nonmember" ? s.optOn : s.opt}
                onClick={() => pickWho("nonmember")}
              >
                Not a member
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
                <button
                  key={code}
                  type="button"
                  className={st.club === code ? s.optOn : s.opt}
                  onClick={() => pickClub(code)}
                >
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
            ) : isHsbBlocked(st.club, st.who) ? (
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
                  const locked = isExperienceLocked(e, st.who);
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
              </div>
            )}
          </section>

          {/* 4 · PARTY */}
          <section className={s.card}>
            <h3 className={s.cardH}>4 · Party size</h3>
            <p className={s.sub}>Drives the safety ratio and any instructor staffing.</p>
            <div className={s.row}>
              <div>
                <label className={s.fld}>Adults</label>
                <input
                  type="number"
                  min={0}
                  value={st.adults}
                  onChange={(e) => set({ adults: Math.max(0, +e.target.value || 0) })}
                />
              </div>
              <div>
                <label className={s.fld}>Juniors (15 &amp; under)</label>
                <input
                  type="number"
                  min={0}
                  value={st.juniors}
                  onChange={(e) => set({ juniors: Math.max(0, +e.target.value || 0) })}
                />
              </div>
            </div>
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
                Per-head, good / better / best by vendor — priced × total guests. (HSB dining runs through The Club.)
              </p>
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

          {/* Honeypot — visually hidden, off-screen; bots fill it, humans don't. */}
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
                <div className={s.estNote}>
                  Pick a club, experience, and party size to see an indicative estimate.
                </div>
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

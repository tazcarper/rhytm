"use client";

import { useMemo, useState, useTransition } from "react";
import { submitEstimateAction } from "@/app/(public)/request-estimate/submit/action";
import {
  CLUB_LABELS,
  CLUB_TO_SLUG,
  isComingSoon,
  isHsbBlocked,
  type ClubCode,
  type CustomLine,
  type HostCode,
} from "./rules";
import {
  computeEstimate,
  money,
  type EstimateSelections,
} from "@/src/services/estimates/estimate-pricing";
import {
  EMPTY_ESTIMATE_CATALOG,
  type EstimateCatalog,
  type EstimateCatalogByClub,
  type EstimateExperience,
} from "@/src/services/public/estimate-catalog";
import {
  DateTimePicker,
  type DateTimePickerValue,
} from "@/src/components/public/scheduling/date-time-picker";
import type { ClubScheduling } from "@/src/services/public/estimate-scheduling";
import s from "./estimate-intake.module.css";

interface EstimateIntakeProps {
  // Staff (admin-portal) viewers get the phone-intake toggle: instructor/RSO
  // math, internal notes, discount authority, and manual line items. Hidden
  // from the public.
  canUseStaffMode: boolean;
  // When set (from a per-club link like /request-estimate/horseshoe-bay), the
  // club is fixed and the "which club?" picker is hidden — no wrong-club
  // mistakes. Undefined → the generic picker behaves exactly as before.
  lockedClub?: ClubCode;
  // Per-club calendar data (slots + horizon) for the WHEN step's shared
  // <DateTimePicker>. Bookable clubs only; absent for coming-soon clubs.
  clubScheduling: ClubScheduling;
  // Per-club DB catalog (experiences, add-ons, guest-fee tiers, catering). The
  // club can switch in-form, so every bookable club's catalog is provided.
  catalogByClub: EstimateCatalogByClub;
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

interface IntakeState {
  host: HostCode;
  club: ClubCode;
  // Selected experience (service) ids.
  exps: string[];
  // Add-on id → chosen quantity (0/1 for a Yes/No add-on).
  addOnQuantities: Record<string, number>;
  // per_target experience id → chosen target count (multiple of the allotment).
  targetQuantities: Record<string, number>;
  // Selected catering option id (catering_options.id), or null.
  cateringId: string | null;
  // Party composition. members shoot on dues (only meaningful for a member
  // host); guestAdults/guestJuniors are non-member guests that drive fees.
  members: number;
  guestAdults: number;
  guestJuniors: number;
  // Private lesson length in hours (2-hr standard block).
  hours: number;
  // Staff-only fields.
  staffMode: boolean;
  discountValue: number;
  discountType: "pct" | "amt";
  customLines: CustomLine[];
  // Timing. `arrival` is the hour-of-day used by the heat/escalation
  // advisories; `slotStart` ("HH:MM:SS") is the concrete slot picked in the
  // shared calendar (when scheduling data is available for the club).
  arrival: string;
  date: string;
  slotStart?: string;
}

const INITIAL: IntakeState = {
  host: "member",
  club: "hsb",
  exps: [],
  addOnQuantities: {},
  targetQuantities: {},
  cateringId: null,
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

export function EstimateIntake({
  canUseStaffMode,
  lockedClub,
  clubScheduling,
  catalogByClub,
}: EstimateIntakeProps) {
  const [st, setSt] = useState<IntakeState>(() =>
    lockedClub ? { ...INITIAL, club: lockedClub } : INITIAL,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffRep, setStaffRep] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");
  // Manual-line input fields (staff).
  const [custLabel, setCustLabel] = useState("");
  const [custAmt, setCustAmt] = useState("");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<IntakeState>) => setSt((p) => ({ ...p, ...patch }));

  const memberHost = st.host === "member";

  // The selected club's catalog. Missing (coming-soon / unconfigured) → empty.
  const catalog: EstimateCatalog = catalogByClub[st.club] ?? EMPTY_ESTIMATE_CATALOG;

  const gatedOut = isComingSoon(st.club) || isHsbBlocked(st.club, st.host);
  const availableExperiences: EstimateExperience[] = gatedOut
    ? []
    : catalog.experiences;
  const cateringSet = gatedOut ? [] : catalog.catering;
  const showCatering = cateringSet.length > 0;

  const selectedExperiences = availableExperiences.filter((e) =>
    st.exps.includes(e.id),
  );
  const lessonSelected = selectedExperiences.some(
    (e) => e.pricingKind === "lesson_ladder",
  );

  const selections: EstimateSelections = useMemo(
    () => ({
      host: st.host,
      experienceIds: st.exps,
      lessonHours: st.hours,
      members: memberHost ? st.members : 0,
      guestAdults: st.guestAdults,
      guestJuniors: st.guestJuniors,
      addOnQuantities: st.addOnQuantities,
      targetQuantities: st.targetQuantities,
      cateringId: st.cateringId,
      staffMode: st.staffMode,
      discountValue: st.discountValue,
      discountType: st.discountType,
      customLines: st.customLines,
      arrival: st.arrival,
      date: st.date,
    }),
    [st, memberHost],
  );

  const estimate = useMemo(
    () =>
      computeEstimate(catalog, selections, {
        comingSoon: isComingSoon(st.club),
        membersOnlyBlocked: isHsbBlocked(st.club, st.host),
      }),
    [catalog, selections, st.club, st.host],
  );

  // --- gating ---
  function pickClub(club: ClubCode) {
    if (lockedClub) return; // club is fixed by the link
    if (isComingSoon(club)) return; // coming soon — not selectable / submittable yet
    // Catalog + slots differ per club, so clear experience/add-on/catering/date.
    set({ club, exps: [], addOnQuantities: {}, targetQuantities: {}, cateringId: null, date: "", slotStart: undefined });
  }

  // Calendar data for the selected club; absent (coming-soon / unconfigured)
  // → the WHEN step falls back to a plain date + arrival select.
  const schedule = clubScheduling[st.club];

  function handleWhenChange(next: DateTimePickerValue) {
    set({
      date: next.dateISO ?? "",
      slotStart: next.slotStart,
      ...(next.slotStart
        ? { arrival: String(Number.parseInt(next.slotStart, 10)) }
        : {}),
    });
  }
  function pickHost(host: HostCode) {
    const party =
      host === "member"
        ? { members: 1, guestAdults: 0, guestJuniors: 0 }
        : { members: 0, guestAdults: 1, guestJuniors: 0 };
    set({ host, exps: [], addOnQuantities: {}, targetQuantities: {}, cateringId: null, ...party });
  }
  function toggleExp(id: string) {
    const turningOn = !st.exps.includes(id);
    const exps = turningOn ? [...st.exps, id] : st.exps.filter((e) => e !== id);
    // A per_target experience defaults to one allotment when selected (the
    // default lives in state, not as a read-site fallback), and is cleared when
    // deselected so a stale count can't ride along.
    const exp = availableExperiences.find((e) => e.id === id);
    const targetQuantities = { ...st.targetQuantities };
    if (exp?.pricingKind === "per_target") {
      if (turningOn) {
        targetQuantities[id] = exp.targetAllotmentSize > 0 ? exp.targetAllotmentSize : 30;
      } else {
        delete targetQuantities[id];
      }
    }
    set({ exps, targetQuantities });
  }

  function setAddOnQty(id: string, quantity: number, maxQuantity: number) {
    const clamped = Math.max(0, Math.min(maxQuantity, quantity));
    set({ addOnQuantities: { ...st.addOnQuantities, [id]: clamped } });
  }
  // Step a per_target experience's target count by whole allotments (min 1 block,
  // capped at the optional maximum — the largest whole allotment within it).
  function stepTargets(
    id: string,
    deltaBlocks: number,
    allotment: number,
    maxCount: number | null,
  ) {
    const current = st.targetQuantities[id] ?? allotment;
    let blocks = Math.max(1, Math.round(current / allotment) + deltaBlocks);
    if (maxCount && maxCount > 0) {
      blocks = Math.min(blocks, Math.max(1, Math.floor(maxCount / allotment)));
    }
    set({ targetQuantities: { ...st.targetQuantities, [id]: blocks * allotment } });
  }
  function pickCatering(id: string | null) {
    set({ cateringId: id });
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

  // Composition hint under the party inputs.
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

    startTransition(async () => {
      const res = await submitEstimateAction(
        {
          propertySlug: CLUB_TO_SLUG[st.club],
          host: st.host,
          experienceIds: st.exps,
          addOnQuantities: st.addOnQuantities,
          targetQuantities: st.targetQuantities,
          cateringId: st.cateringId,
          members: memberHost ? st.members : 0,
          guestAdults: st.guestAdults,
          guestJuniors: st.guestJuniors,
          lessonHours: lessonSelected ? st.hours : null,
          customLines: st.staffMode ? st.customLines : [],
          name,
          email,
          phone,
          preferredDate: st.date,
          arrival: st.arrival,
          slotStart: st.slotStart,
          notes,
          indicativeTotal: estimate.grandLabel,
          staffMode: st.staffMode,
          staffRepName: staffRep,
          internalNotes: st.staffMode ? internalNotes : "",
        },
        honeypot,
      );
      if (res.ok) {
        window.location.assign(res.bidPath);
      } else {
        setError(res.message);
      }
    });
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
              HH also allows non-member direct bookings. We verify membership before comfirming events.
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
            {lockedClub ? (
              <div className={s.gate}>
                <div className={s.gateT}>🔒 Booking at {CLUB_LABELS[lockedClub]}</div>
                <div className={s.gateD}>Set by your link.</div>
              </div>
            ) : (
              <>
                <p className={s.sub}>The club gates everything below.</p>
                <div className={s.seg}>
                  {(Object.keys(CLUB_LABELS) as ClubCode[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={isComingSoon(code)}
                      aria-disabled={isComingSoon(code)}
                      title={isComingSoon(code) ? "Coming soon — not open for booking yet" : undefined}
                      className={st.club === code ? s.optOn : s.opt}
                      onClick={() => pickClub(code)}
                    >
                      {CLUB_LABELS[code]}
                      {isComingSoon(code) && <span className={s.soon}> SOON</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
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
                {availableExperiences.map((e) => {
                  const locked = e.membersOnly && st.host === "nonmember";
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
                        <span className={s.expT}>{e.name}</span>
                        <span className={s.expD}>
                          {locked ? "Members only — not available to non-members" : e.description}
                        </span>
                      </span>
                      <span className={s.expMark}>{locked ? "✕" : on ? "✓" : "+"}</span>
                    </button>
                  );
                })}
                {selectedExperiences
                  .filter((e) => e.pricingKind === "per_target")
                  .map((e) => {
                    const allotment =
                      e.targetAllotmentSize > 0 ? e.targetAllotmentSize : 30;
                    const targets = st.targetQuantities[e.id] ?? allotment;
                    return (
                      <div key={`tgt-${e.id}`} style={{ marginTop: "12px" }}>
                        <label className={s.fld}>
                          {e.name} — {e.targetUnitLabel}s (sold in {allotment}s)
                          {e.targetMaxCount
                            ? ` · max ${e.targetMaxCount} ${e.targetUnitLabel}s`
                            : ""}
                        </label>
                        <div className={s.qty}>
                          <button
                            type="button"
                            onClick={() => stepTargets(e.id, -1, allotment, e.targetMaxCount)}
                          >
                            −
                          </button>
                          <input readOnly value={targets} />
                          <button
                            type="button"
                            onClick={() => stepTargets(e.id, +1, allotment, e.targetMaxCount)}
                          >
                            +
                          </button>
                        </div>
                      </div>
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
                  <label className={s.fld}>Adult Members</label>
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
          {availableExperiences.length > 0 && catalog.addOns.length > 0 && (
            <section className={s.card}>
              <h3 className={s.cardH}>5 · Add-ons</h3>
              <p className={s.sub}>Pick a quantity, or yes/no for single items.</p>
              {catalog.addOns.map((a) => {
                const qty = st.addOnQuantities[a.id] ?? 0;
                return (
                  <div key={a.id} className={s.addon}>
                    <div>
                      <div className={s.addonNm}>{a.name}</div>
                      <div className={s.addonMeta}>
                        {a.description ?? `${money(a.price)}${a.control === "bool" ? "" : " each"}`}
                      </div>
                    </div>
                    {a.control === "bool" ? (
                      <div className={s.toggle} role="group" aria-label={a.name}>
                        <button
                          type="button"
                          className={qty > 0 ? s.toggleOn : ""}
                          aria-pressed={qty > 0}
                          onClick={() => setAddOnQty(a.id, 1, a.maxQuantity)}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={qty === 0 ? s.toggleOn : ""}
                          aria-pressed={qty === 0}
                          onClick={() => setAddOnQty(a.id, 0, a.maxQuantity)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className={s.qty}>
                        <button type="button" onClick={() => setAddOnQty(a.id, qty - 1, a.maxQuantity)}>−</button>
                        <input readOnly value={qty} />
                        <button type="button" onClick={() => setAddOnQty(a.id, qty + 1, a.maxQuantity)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

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
                ⚠ Placeholder vendors &amp; rates — vendor selections and per-head pricing need confirmation
                before final sign-off.
              </div>
              {cateringSet.map((o) => {
                const sel = st.cateringId === o.id;
                return (
                  <div key={o.id} className={s.addon}>
                    <div>
                      <div className={s.addonNm}>
                        {o.tier} · {o.vendorName}
                      </div>
                      <div className={s.addonMeta}>${o.pricePerHead} / head</div>
                    </div>
                    <button
                      type="button"
                      className={sel ? `${s.optOn} ${s.cateringSelected}` : s.opt}
                      style={{ minWidth: "84px", flex: "none" }}
                      aria-pressed={sel}
                      title={sel ? "Click to remove catering" : undefined}
                      onClick={() => pickCatering(sel ? null : o.id)}
                    >
                      {sel ? (
                        <>
                          <span className={s.cateringSelLabel}>✓ Selected</span>
                          <span className={s.cateringDeselLabel}>Remove</span>
                        </>
                      ) : (
                        "Pick"
                      )}
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          {/* 6 · WHEN */}
          <section className={s.card}>
            <h3 className={s.cardH}>6 · When</h3>
            {schedule ? (
              <>
                <p className={s.sub}>
                  Pick the date and time you&apos;d like. We&apos;ll hold it as
                  your requested slot and the team confirms availability on your
                  bid. All times Central.
                </p>
                {estimate.isEvent && (
                  <div className={s.heat}>
                    ▲ Private events (9+ total) need 72 hours&apos; notice — the
                    earliest dates are unavailable to select.
                  </div>
                )}
                <DateTimePicker
                  propertyId={schedule.propertyId}
                  slotsByDayOfWeek={schedule.slotsByDayOfWeek}
                  bookingHorizonDays={schedule.bookingHorizonDays}
                  bookingType="plan_a_visit"
                  durationHours={2}
                  enforceAvailability={false}
                  minLeadDays={estimate.isEvent ? 3 : 0}
                  value={{
                    dateISO: st.date || undefined,
                    slotStart: st.slotStart,
                  }}
                  onChange={handleWhenChange}
                />
              </>
            ) : (
              <>
                <div className={s.row}>
                  <div>
                    <label className={s.fld}>Preferred date</label>
                    <input type="date" value={st.date} onChange={(e) => set({ date: e.target.value })} />
                  </div>
                  <div />
                </div>
                <label className={s.fld}>Arrival window</label>
                <select value={st.arrival} onChange={(e) => set({ arrival: e.target.value })}>
                  {ARRIVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
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

          {/* Honeypot — a bot fills it; a human never sees it. */}
          <input
            type="text"
            name="url"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className={s.honeypot}
          />
        </div>

        {/* ESTIMATE PANEL */}
        <div className={s.rail}>
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

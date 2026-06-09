import { Card } from "@/lib/ui";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { InstructorGameplan } from "@/src/services/instructors/gameplan";
import s from "./gameplan-detail.module.css";

// The pre-event briefing for one booking, ordered for a quick scan on the way
// to meet the guests: who + when up top, the activity, anything special they
// asked for, who's in the party, then how to find the place. Read-only — the
// instructor never edits anything here.
export function GameplanDetail({ gameplan }: { gameplan: InstructorGameplan }) {
  const { property } = gameplan;
  const dateLabel = formatDateLongTz(gameplan.startTime, property.timezone);
  const startLabel = formatSlotLabelTz(gameplan.startTime, property.timezone);
  const endLabel = formatSlotLabelTz(gameplan.endTime, property.timezone);
  const partyLabel =
    gameplan.guestCount === 1
      ? "Solo guest"
      : `Party of ${gameplan.guestCount}`;

  const partySigners = gameplan.signers.filter((signer) => !signer.isPrimary);
  const primarySigned = gameplan.signers.some((signer) => signer.isPrimary);
  const allSigned =
    gameplan.signers.length > 0 && gameplan.unsignedCount === 0;

  return (
    <div className={s.stack}>
      <header className={s.header}>
        <span className={s.eyebrow}>
          {dateLabel} · {startLabel}–{endLabel} CT
        </span>
        <h1 className={s.guestName}>{gameplan.guestName}</h1>
        <span className={s.sub}>
          {partyLabel} · {property.name}
        </span>
        <div className={s.contact}>
          {gameplan.guestPhone && (
            <a className={s.contactLink} href={`tel:${gameplan.guestPhone}`}>
              {gameplan.guestPhone}
            </a>
          )}
          <a className={s.contactLink} href={`mailto:${gameplan.guestEmail}`}>
            {gameplan.guestEmail}
          </a>
        </div>
      </header>

      <Card padding="loose" elevation="soft">
        <h2 className={s.sectionTitle}>Activity</h2>
        {gameplan.activities.length > 0 ? (
          <ul className={s.chips}>
            {gameplan.activities.map((activity) => (
              <li key={activity} className={s.chip}>
                {activity}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>No discipline recorded for this booking.</p>
        )}
        {gameplan.scheduleNotes && (
          <p className={s.scheduleNotes}>{gameplan.scheduleNotes}</p>
        )}
      </Card>

      {gameplan.specialRequests && (
        <Card padding="loose" elevation="soft" className={s.requests}>
          <h2 className={s.sectionTitle}>Special requests</h2>
          <p className={s.requestText}>{gameplan.specialRequests}</p>
        </Card>
      )}

      <Card padding="loose" elevation="soft">
        <div className={s.rosterHead}>
          <h2 className={s.sectionTitle}>Guests</h2>
          <span className={`${s.count} ${allSigned ? s.countDone : ""}`}>
            {gameplan.signers.length} of {gameplan.guestCount} signed
            {allSigned ? " ✓" : ""}
          </span>
        </div>

        <ul className={s.roster}>
          <li className={s.rosterRow}>
            <span className={s.rosterName}>{gameplan.guestName}</span>
            <span className={s.rosterMeta}>
              <span className={`${s.badge} ${s.badgePrimary}`}>Primary</span>
              <span className={s.status}>
                {primarySigned ? "Signed" : "Awaiting signature"}
              </span>
            </span>
          </li>

          {partySigners.map((signer, index) => (
            <li key={`${signer.name}-${index}`} className={s.rosterRow}>
              <span className={s.rosterName}>{signer.name}</span>
              <span className={s.rosterMeta}>
                <span className={s.badge}>Guest</span>
                <span className={s.status}>Signed</span>
              </span>
            </li>
          ))}
        </ul>

        {gameplan.unsignedCount > 0 && (
          <p className={s.note}>
            {gameplan.unsignedCount}{" "}
            {gameplan.unsignedCount === 1 ? "guest hasn't" : "guests haven't"}{" "}
            signed a waiver yet — they can sign on their own phone via the
            scan-to-sign QR at arrival.
          </p>
        )}
      </Card>

      {(property.directions ||
        property.parking ||
        property.arrivalContact ||
        property.mapUrl) && (
        <Card padding="loose" elevation="soft">
          <h2 className={s.sectionTitle}>Logistics</h2>
          <dl className={s.logistics}>
            <div className={s.logRow}>
              <dt className={s.logTerm}>Duration</dt>
              <dd className={s.logDef}>{gameplan.durationHours} hr</dd>
            </div>
            {property.arrivalContact && (
              <div className={s.logRow}>
                <dt className={s.logTerm}>On arrival</dt>
                <dd className={s.logDef}>{property.arrivalContact}</dd>
              </div>
            )}
            {property.parking && (
              <div className={s.logRow}>
                <dt className={s.logTerm}>Parking</dt>
                <dd className={s.logDef}>{property.parking}</dd>
              </div>
            )}
            {property.directions && (
              <div className={s.logRow}>
                <dt className={s.logTerm}>Directions</dt>
                <dd className={s.logDef}>{property.directions}</dd>
              </div>
            )}
          </dl>
          {property.mapUrl && (
            <a
              className={s.mapLink}
              href={property.mapUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open map →
            </a>
          )}
        </Card>
      )}
    </div>
  );
}

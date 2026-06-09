import Link from "next/link";
import { Card } from "@/lib/ui";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { AdminBidPartyWaiver } from "@/src/services/admin/get-bid-detail";
import s from "./bid-waiver-roster.module.css";

interface BidWaiverRosterProps {
  bidId: string;
  // The party size on the booking — the denominator for "X of N signed".
  partySize: number;
  timezone: string;
  // The primary / bid signer (the canonical bid waiver). Its PDF lives at
  // /admin/bids/[id]/waiver, not /admin/waivers/[id].
  primary: { signedName: string; signedAt: string | null } | null;
  // Everyone else who signed via the scan-to-sign QR.
  partyWaivers: AdminBidPartyWaiver[];
  className?: string;
}

function signedAtLabel(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return `${formatDateLongTz(iso, timezone)} · ${formatSlotLabelTz(
    iso,
    timezone,
  )} CT`;
}

// Roster of everyone who has signed a waiver for this booking — the primary
// (bid) signer plus each party guest who signed on their own phone via the
// QR. Surfaces "X of N signed" so staff can tell at a glance who is still
// outstanding (we have names for signers, only a count for the rest — no
// per-guest roster is captured at booking time).
export function BidWaiverRoster({
  bidId,
  partySize,
  timezone,
  primary,
  partyWaivers,
  className,
}: BidWaiverRosterProps) {
  const signedCount = (primary ? 1 : 0) + partyWaivers.length;
  // The party size can lag reality (a guest may bring a +1 who signs), so
  // never report a negative remainder.
  const remaining = Math.max(0, partySize - signedCount);
  const allSigned = signedCount > 0 && remaining === 0;

  return (
    <Card padding="loose" elevation="soft" className={className}>
      <div className={s.head}>
        <h2 className={s.title}>Waivers</h2>
        <span className={`${s.count} ${allSigned ? s.countDone : ""}`}>
          {signedCount} of {partySize} signed{allSigned ? " ✓" : ""}
        </span>
      </div>

      {signedCount === 0 ? (
        <p className={s.empty}>
          No one has signed yet. Show the scan-to-sign QR so each guest can sign
          on their own phone.
        </p>
      ) : (
        <ul className={s.list}>
          {primary && (
            <li className={s.row}>
              <div className={s.who}>
                <span className={s.nameLine}>
                  <span className={s.name}>{primary.signedName}</span>
                  <span className={`${s.badge} ${s.badgePrimary}`}>Primary</span>
                </span>
              </div>
              <span className={s.when}>
                {signedAtLabel(primary.signedAt, timezone)}
              </span>
              <Link
                className={s.view}
                href={`/admin/bids/${bidId}/waiver`}
                target="_blank"
                rel="noreferrer"
              >
                View PDF →
              </Link>
            </li>
          )}

          {partyWaivers.map((waiver) => (
            <li key={waiver.id} className={s.row}>
              <div className={s.who}>
                <span className={s.nameLine}>
                  <span className={s.name}>{waiver.signedName}</span>
                  <span className={s.badge}>Guest</span>
                </span>
                {waiver.signerEmail && (
                  <a className={s.email} href={`mailto:${waiver.signerEmail}`}>
                    {waiver.signerEmail}
                  </a>
                )}
              </div>
              <span className={s.when}>
                {signedAtLabel(waiver.signedAt, timezone)}
              </span>
              <Link
                className={s.view}
                href={`/admin/waivers/${waiver.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View PDF →
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!allSigned && signedCount > 0 && (
        <p className={s.note}>
          {remaining} more {remaining === 1 ? "guest" : "guests"} in the party of{" "}
          {partySize} {remaining === 1 ? "hasn't" : "haven't"} signed yet.
        </p>
      )}
    </Card>
  );
}

"use client";

import { Fragment, type MouseEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminMemberListRow } from "@/src/services/admin/members";
import { MembershipStatusDot } from "./membership-status-dot";
import { PropertyPill } from "./property-pill";
import s from "./queue-list.module.css";

function formatJoinedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function MemberListTable({
  rows,
}: {
  rows: ReadonlyArray<AdminMemberListRow>;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className={s.tableWrap}>
        <p className={s.empty}>No members match these filters.</p>
      </div>
    );
  }

  function navigate(personId: string | null) {
    if (personId) router.push(`/admin/members/${personId}`);
  }

  function handleRowClick(
    event: MouseEvent<HTMLTableRowElement>,
    personId: string | null,
  ) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    navigate(personId);
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    personId: string | null,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(personId);
    }
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Member</th>
            <th>
              Memberships
              <span className={s.colHint}>Status · Property · Member #</span>
            </th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clickable = row.personId !== null;
            return (
              <tr
                key={row.key}
                className={clickable ? s.clickableRow : undefined}
                role={clickable ? "link" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={
                  clickable
                    ? `Open member ${row.primaryName ?? ""}`
                    : undefined
                }
                onClick={(e) => handleRowClick(e, row.personId)}
                onKeyDown={(e) => handleRowKeyDown(e, row.personId)}
              >
                <td>
                  <div className={s.guest}>
                    <span className={s.guestName}>{row.primaryName ?? "—"}</span>
                    {row.primaryDisplayName &&
                      row.primaryDisplayName !== row.primaryName && (
                        <span className={s.guestAlias}>
                          “{row.primaryDisplayName}”
                        </span>
                      )}
                    <span className={s.guestEmail}>
                      {row.primaryEmail ?? "no contact on file"}
                    </span>
                  </div>
                </td>
                <td>
                  <div className={s.membershipGrid}>
                    {row.memberships.map((membership) => (
                      <Fragment key={membership.membershipId}>
                        <MembershipStatusDot status={membership.status} />
                        <PropertyPill
                          name={membership.propertyName}
                          slug={membership.propertySlug}
                        />
                        <span className={s.membershipNumber}>
                          #{membership.memberNumber}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </td>
                <td className={s.createdAt}>
                  {formatJoinedDate(row.earliestJoined)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

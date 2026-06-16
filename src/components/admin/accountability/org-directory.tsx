"use client";

import { useMemo, useState } from "react";
import { Badge, Button } from "@/lib/ui";
import { DIVISION_ACCENT, DIVISION_LABEL } from "@/src/constants/accountability/divisions";
import { STATUS_META } from "@/src/constants/accountability/status";
import type { OrgSeat } from "@/src/types/accountability";
import s from "./accountability.module.css";

interface OrgDirectoryProps {
  seats: ReadonlyArray<OrgSeat>;
  editable: boolean;
  onEdit: (seat: OrgSeat) => void;
}

type SortKey = "name" | "title" | "division" | "status";

export function OrgDirectory({ seats, editable, onEdit }: OrgDirectoryProps) {
  const [sortKey, setSortKey] = useState<SortKey>("division");
  const [ascending, setAscending] = useState(true);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    seats.forEach((seat) => map.set(seat.id, seat.name ?? seat.title));
    return map;
  }, [seats]);

  const sorted = useMemo(() => {
    const value = (seat: OrgSeat): string => {
      switch (sortKey) {
        case "name":
          return seat.name ?? "zzz"; // open seats sort last
        case "title":
          return seat.title;
        case "division":
          return DIVISION_LABEL[seat.division];
        case "status":
          return STATUS_META[seat.status].label;
      }
    };
    return [...seats].sort((a, b) => {
      const cmp = value(a).localeCompare(value(b));
      return ascending ? cmp : -cmp;
    });
  }, [seats, sortKey, ascending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setAscending((prev) => !prev);
    } else {
      setSortKey(key);
      setAscending(true);
    }
  }

  const arrow = (key: SortKey) =>
    key === sortKey ? <span className={s.sortArrow}>{ascending ? "↑" : "↓"}</span> : null;

  if (seats.length === 0) {
    return <p className={s.empty}>No seats match.</p>;
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th onClick={() => toggleSort("name")}>Name {arrow("name")}</th>
            <th onClick={() => toggleSort("title")}>Title {arrow("title")}</th>
            <th onClick={() => toggleSort("division")}>Division {arrow("division")}</th>
            <th onClick={() => toggleSort("status")}>Status {arrow("status")}</th>
            <th className={s.noSort}>Reports to</th>
            <th className={s.noSort}>Email</th>
            <th className={s.noSort}>Phone</th>
            {editable && <th className={s.noSort} aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((seat) => (
            <tr key={seat.id}>
              <td className={s.tName}>
                {seat.name ?? <span className={s.nameOpen}>Open seat</span>}
              </td>
              <td>{seat.title}</td>
              <td>
                <span className={s.divisionTag}>
                  <span
                    className={s.chipDot}
                    style={{ background: DIVISION_ACCENT[seat.division] }}
                  />
                  {DIVISION_LABEL[seat.division]}
                </span>
              </td>
              <td>
                <Badge variant={STATUS_META[seat.status].variant} pill>
                  {STATUS_META[seat.status].label}
                </Badge>
              </td>
              <td>{seat.parentId ? nameById.get(seat.parentId) ?? "—" : "—"}</td>
              <td>{seat.email ?? "—"}</td>
              <td>{seat.phone ?? "—"}</td>
              {editable && (
                <td>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(seat)}>
                    Edit
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

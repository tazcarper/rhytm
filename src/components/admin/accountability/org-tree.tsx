"use client";

import { DIVISION_ACCENT, DIVISION_LABEL } from "@/src/constants/accountability/divisions";
import { STATUS_META } from "@/src/constants/accountability/status";
import { Badge } from "@/lib/ui";
import type { CSSProperties } from "react";
import type { OrgNode, OrgSeat } from "@/src/types/accountability";
import s from "./accountability.module.css";

interface OrgTreeProps {
  roots: OrgNode[];
  matches: (seat: OrgSeat) => boolean;
  editable: boolean;
  onEdit: (seat: OrgSeat) => void;
}

// Founders sit at the apex; everyone reporting into them forms the tree.
export function OrgTree({ roots, matches, editable, onEdit }: OrgTreeProps) {
  const reports = roots.flatMap((root) => root.children);

  return (
    <div className={s.tree}>
      <div className={s.apexRow}>
        {roots.map((node) => (
          <SeatCard
            key={node.id}
            node={node}
            apex
            matches={matches}
            editable={editable}
            onEdit={onEdit}
          />
        ))}
      </div>
      {reports.length > 0 && (
        <div className={s.branch}>
          {reports.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              matches={matches}
              editable={editable}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  matches,
  editable,
  onEdit,
}: {
  node: OrgNode;
  matches: (seat: OrgSeat) => boolean;
  editable: boolean;
  onEdit: (seat: OrgSeat) => void;
}) {
  return (
    <div className={s.nodeWrap}>
      <SeatCard node={node} matches={matches} editable={editable} onEdit={onEdit} />
      {node.children.length > 0 && (
        <div className={s.children}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              matches={matches}
              editable={editable}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeatCard({
  node,
  apex = false,
  matches,
  editable,
  onEdit,
}: {
  node: OrgNode;
  apex?: boolean;
  matches: (seat: OrgSeat) => boolean;
  editable: boolean;
  onEdit: (seat: OrgSeat) => void;
}) {
  const status = STATUS_META[node.status];
  const accent = DIVISION_ACCENT[node.division];
  const dimmed = !matches(node);
  const cardClass = [s.card, apex && s.cardApex, dimmed && s.cardDimmed]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} style={{ "--seat-accent": accent } as CSSProperties}>
      <div className={s.cardHead}>
        <div>
          <div className={node.name ? s.name : `${s.name} ${s.nameOpen}`}>
            {node.name ?? "Open seat"}
          </div>
          <div className={s.role}>{node.title}</div>
        </div>
        <Badge variant={status.variant} pill>
          {status.label}
        </Badge>
      </div>

      <div className={s.meta}>
        <span className={s.divisionTag}>
          <span className={s.chipDot} style={{ background: accent }} />
          {DIVISION_LABEL[node.division]}
        </span>
      </div>

      {node.accountabilities.length > 0 && (
        <ul className={s.acct}>
          {node.accountabilities.map((line, i) => (
            <li key={i} className={s.acctLine}>
              {line}
            </li>
          ))}
        </ul>
      )}

      {node.email && <div className={s.contact}>{node.email}</div>}

      {editable && (
        <div className={s.cardActions}>
          <button type="button" className={s.editLink} onClick={() => onEdit(node)}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

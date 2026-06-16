"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/lib/ui";
import { DIVISIONS } from "@/src/constants/accountability/divisions";
import type { OrgDivision, OrgSeat } from "@/src/types/accountability";
import { OrgTree } from "./org-tree";
import { OrgDirectory } from "./org-directory";
import { SeatEditor } from "./seat-editor";
import { buildOrgTree, seatMatchesQuery } from "./org-tree-utils";
import s from "./accountability.module.css";

type ViewMode = "structure" | "directory";
type DivisionFilter = OrgDivision | "all";

interface AccountabilityViewProps {
  seats: OrgSeat[];
  editable: boolean;
}

// `editorState` is undefined when closed; { seat: null } when adding; { seat }
// when editing — distinguishing "add" from "edit a seat that has no id yet".
type EditorState = { seat: OrgSeat | null } | undefined;

export function AccountabilityView({ seats, editable }: AccountabilityViewProps) {
  const [view, setView] = useState<ViewMode>("structure");
  const [query, setQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>("all");
  const [editorState, setEditorState] = useState<EditorState>(undefined);

  const matches = useMemo(() => {
    return (seat: OrgSeat) =>
      seatMatchesQuery(seat, query) &&
      (divisionFilter === "all" || seat.division === divisionFilter);
  }, [query, divisionFilter]);

  const roots = useMemo(() => buildOrgTree(seats), [seats]);
  const directorySeats = useMemo(() => seats.filter(matches), [seats, matches]);

  return (
    <>
      <div className={s.controls}>
        <Input
          className={s.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name, role, accountability, or email…"
          aria-label="Search the chart"
        />
        <span className={s.spacer} />
        {editable && (
          <Button size="sm" onClick={() => setEditorState({ seat: null })}>
            Add seat
          </Button>
        )}
        <div className={s.toggle} role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "structure"}
            className={view === "structure" ? `${s.toggleButton} ${s.toggleButtonActive}` : s.toggleButton}
            onClick={() => setView("structure")}
          >
            Structure
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "directory"}
            className={view === "directory" ? `${s.toggleButton} ${s.toggleButtonActive}` : s.toggleButton}
            onClick={() => setView("directory")}
          >
            Directory
          </button>
        </div>
      </div>

      <div className={s.chips}>
        <button
          type="button"
          className={divisionFilter === "all" ? `${s.chip} ${s.chipActive}` : s.chip}
          onClick={() => setDivisionFilter("all")}
        >
          All divisions
        </button>
        {DIVISIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={divisionFilter === d.key ? `${s.chip} ${s.chipActive}` : s.chip}
            onClick={() => setDivisionFilter(d.key)}
          >
            <span className={s.chipDot} style={{ background: d.accent }} />
            {d.label}
          </button>
        ))}
      </div>

      {view === "structure" ? (
        <OrgTree
          roots={roots}
          matches={matches}
          editable={editable}
          onEdit={(seat) => setEditorState({ seat })}
        />
      ) : (
        <OrgDirectory
          seats={directorySeats}
          editable={editable}
          onEdit={(seat) => setEditorState({ seat })}
        />
      )}

      {editorState && (
        <SeatEditor
          seat={editorState.seat}
          seats={seats}
          onClose={() => setEditorState(undefined)}
        />
      )}
    </>
  );
}

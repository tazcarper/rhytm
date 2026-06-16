"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, FormField, Input, Textarea } from "@/lib/ui";
import { DIVISIONS } from "@/src/constants/accountability/divisions";
import { STATUS_META } from "@/src/constants/accountability/status";
import type {
  OrgDivision,
  OrgSeat,
  OrgSeatStatus,
} from "@/src/types/accountability";
import {
  createSeatAction,
  deleteSeatAction,
  updateSeatAction,
} from "@/app/admin/accountability/actions";
import { descendantIds } from "./org-tree-utils";
import s from "./accountability.module.css";

interface SeatEditorProps {
  /** The seat being edited; null = creating a new seat. */
  seat: OrgSeat | null;
  seats: ReadonlyArray<OrgSeat>;
  onClose: () => void;
}

const STATUS_ORDER: OrgSeatStatus[] = ["active", "open", "hopeful"];

export function SeatEditor({ seat, seats, onClose }: SeatEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(seat?.name ?? "");
  const [title, setTitle] = useState(seat?.title ?? "");
  const [division, setDivision] = useState<OrgDivision>(seat?.division ?? "central");
  const [status, setStatus] = useState<OrgSeatStatus>(seat?.status ?? "active");
  const [email, setEmail] = useState(seat?.email ?? "");
  const [phone, setPhone] = useState(seat?.phone ?? "");
  const [parentId, setParentId] = useState(seat?.parentId ?? "");
  const [accountabilities, setAccountabilities] = useState(
    (seat?.accountabilities ?? []).join("\n"),
  );

  // A seat can't report to itself or to one of its own reports (no cycles).
  const parentOptions = useMemo(() => {
    const blocked = seat ? descendantIds(seats, seat.id) : new Set<string>();
    if (seat) blocked.add(seat.id);
    return seats
      .filter((candidate) => !blocked.has(candidate.id))
      .map((candidate) => ({
        id: candidate.id,
        label: `${candidate.name ?? "Open seat"} — ${candidate.title}`,
      }));
  }, [seat, seats]);

  function handleSubmit() {
    setError(null);
    const payload = {
      name: name.trim() || null,
      title: title.trim(),
      division,
      status,
      email: email.trim() || null,
      phone: phone.trim() || null,
      parentId: parentId || null,
      accountabilities: accountabilities
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    };

    startTransition(async () => {
      const result = seat
        ? await updateSeatAction(seat.id, payload)
        : await createSeatAction(payload);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function handleDelete() {
    if (!seat) return;
    if (!window.confirm("Remove this seat from the chart?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSeatAction(seat.id);
      if (!result.ok) {
        setError(result.error ?? "Couldn't remove the seat.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={s.modal}>
        <h2 className={s.modalTitle}>{seat ? "Edit seat" : "Add a seat"}</h2>

        <div className={s.formGrid}>
          <FormField label="Name" helper="Leave blank for an open seat">
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            )}
          </FormField>

          <FormField label="Title" required>
            {(control) => (
              <Input
                {...control}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. General Manager"
              />
            )}
          </FormField>

          <FormField label="Division">
            {(control) => (
              <select
                {...control}
                className={s.select}
                value={division}
                onChange={(e) => setDivision(e.target.value as OrgDivision)}
              >
                {DIVISIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Status">
            {(control) => (
              <select
                {...control}
                className={s.select}
                value={status}
                onChange={(e) => setStatus(e.target.value as OrgSeatStatus)}
              >
                {STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Reports to">
            {(control) => (
              <select
                {...control}
                className={s.select}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— No one (apex) —</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Email">
            {(control) => (
              <Input
                {...control}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@rhythm.co"
              />
            )}
          </FormField>

          <FormField label="Phone" className={s.formFull}>
            {(control) => (
              <Input
                {...control}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            )}
          </FormField>

          <FormField
            label="Accountabilities"
            helper="One per line"
            className={s.formFull}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                value={accountabilities}
                onChange={(e) => setAccountabilities(e.target.value)}
                placeholder={"Financial Planning\nFinancial Accounting\nTaxes"}
              />
            )}
          </FormField>
        </div>

        {error && <p className={s.modalError}>{error}</p>}

        <div className={s.modalActions}>
          {seat && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending}>
              Remove seat
            </Button>
          )}
          <div className={s.modalActionsEnd}>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} loading={isPending}>
              {seat ? "Save changes" : "Add seat"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

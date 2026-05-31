"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input } from "@/lib/ui";
import {
  addBidAddOnAction,
  removeBidAddOnAction,
} from "@/app/admin/bids/[id]/add-ons-actions";
import { formatMoney } from "@/src/services/public/format";
import type { AdminBidAddOn, AdminBidDiscipline } from "@/src/services/admin/get-bid-detail";
import detail from "./bid-detail.module.css";
import s from "./bid-add-ons-editor.module.css";

export interface AvailableAddOn {
  addOnId: string;
  name: string;
  price: number;
}

interface BidAddOnsEditorProps {
  className?: string;
  bidId: string;
  bookingId: string;
  // When false (paid/signed/etc.) the card renders read-only.
  editable: boolean;
  disciplines: AdminBidDiscipline[];
  addOns: AdminBidAddOn[];
  // serviceId → catalog add-ons that are active and linked to that service.
  availableByService: Record<string, AvailableAddOn[]>;
}

interface AddDraft {
  addOnId: string;
  quantity: string;
}

const EMPTY_DRAFT: AddDraft = { addOnId: "", quantity: "1" };

export function BidAddOnsEditor({
  className,
  bidId,
  bookingId,
  editable,
  disciplines,
  addOns,
  availableByService,
}: BidAddOnsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The line / add-row currently mutating, so only that control shows a
  // busy state. Keyed by line id for removes, `add:<serviceId>` for adds.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AddDraft>>({});

  const draftFor = (serviceId: string): AddDraft =>
    drafts[serviceId] ?? EMPTY_DRAFT;
  const setDraft = (serviceId: string, patch: Partial<AddDraft>) =>
    setDrafts((prev) => ({
      ...prev,
      [serviceId]: { ...(prev[serviceId] ?? EMPTY_DRAFT), ...patch },
    }));

  const addOnsByService = new Map<string, AdminBidAddOn[]>();
  for (const addOn of addOns) {
    const list = addOnsByService.get(addOn.serviceId) ?? [];
    list.push(addOn);
    addOnsByService.set(addOn.serviceId, list);
  }

  const addOnTotal = addOns.reduce(
    (sum, addOn) => sum + addOn.unitPrice * addOn.quantity,
    0,
  );

  const runAdd = (serviceId: string) => {
    const draft = draftFor(serviceId);
    if (!draft.addOnId) {
      setError("Pick an add-on to add.");
      return;
    }
    setError(null);
    setBusyKey(`add:${serviceId}`);
    startTransition(async () => {
      const result = await addBidAddOnAction(bidId, {
        bookingId,
        serviceId,
        addOnId: draft.addOnId,
        quantity: draft.quantity,
      });
      setBusyKey(null);
      if (!result.ok) {
        setError(result.error ?? "Couldn't add the add-on.");
        return;
      }
      setDrafts((prev) => ({ ...prev, [serviceId]: EMPTY_DRAFT }));
      router.refresh();
    });
  };

  const runRemove = (bookingAddOnId: string) => {
    setError(null);
    setBusyKey(bookingAddOnId);
    startTransition(async () => {
      const result = await removeBidAddOnAction(bidId, {
        bookingId,
        bookingAddOnId,
      });
      setBusyKey(null);
      if (!result.ok) {
        setError(result.error ?? "Couldn't remove the add-on.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card padding="loose" elevation="soft" className={className}>
      <h2 className={detail.sectionTitle}>Disciplines & Add-ons</h2>

      {error && (
        <Alert variant="error" title="Add-on change failed">
          {error}
        </Alert>
      )}

      {disciplines.length === 0 ? (
        <p className={detail.empty}>No disciplines on this booking.</p>
      ) : (
        <ul className={detail.list}>
          {disciplines.map((discipline) => {
            const lines = addOnsByService.get(discipline.id) ?? [];
            const alreadyAdded = new Set(lines.map((line) => line.addOnId));
            const available = (availableByService[discipline.id] ?? []).filter(
              (option) => !alreadyAdded.has(option.addOnId),
            );
            const draft = draftFor(discipline.id);

            return (
              <li key={discipline.id} className={detail.listItem}>
                <p className={detail.disciplineName}>{discipline.name}</p>
                {discipline.description && (
                  <p className={detail.disciplineDesc}>{discipline.description}</p>
                )}

                {lines.length > 0 && (
                  <ul className={s.lineList}>
                    {lines.map((line) => (
                      <li key={line.id} className={s.line}>
                        <span className={s.lineName}>
                          <span className={s.qty}>×{line.quantity}</span>
                          {line.name}
                        </span>
                        <span className={s.lineRight}>
                          <span>
                            ${formatMoney(line.unitPrice * line.quantity)}
                          </span>
                          {editable && (
                            <button
                              type="button"
                              className={s.removeBtn}
                              onClick={() => runRemove(line.id)}
                              disabled={isPending}
                            >
                              {busyKey === line.id ? "Removing…" : "Remove"}
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {lines.length === 0 && !editable && (
                  <p className={detail.empty}>No add-ons.</p>
                )}

                {editable && available.length > 0 && (
                  <div className={s.addRow}>
                    <select
                      className={s.select}
                      value={draft.addOnId}
                      onChange={(e) =>
                        setDraft(discipline.id, { addOnId: e.target.value })
                      }
                      disabled={isPending}
                      aria-label={`Add an add-on to ${discipline.name}`}
                    >
                      <option value="">Add an add-on…</option>
                      {available.map((option) => (
                        <option key={option.addOnId} value={option.addOnId}>
                          {option.name} — ${formatMoney(option.price)}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      className={s.qtyInput}
                      value={draft.quantity}
                      onChange={(e) =>
                        setDraft(discipline.id, { quantity: e.target.value })
                      }
                      disabled={isPending}
                      aria-label="Quantity"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => runAdd(discipline.id)}
                      loading={busyKey === `add:${discipline.id}`}
                      disabled={isPending || !draft.addOnId}
                    >
                      Add
                    </Button>
                  </div>
                )}

                {editable && available.length === 0 && lines.length > 0 && (
                  <p className={s.allAdded}>
                    All available add-ons are on this booking.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {addOns.length > 0 && (
        <div className={s.footer}>
          <span className={s.totalLabel}>Add-ons total</span>
          <span className={s.totalValue}>${formatMoney(addOnTotal)}</span>
        </div>
      )}

      {editable && (
        <p className={s.hint}>
          Adding or removing add-ons does not change the quote automatically —
          update the confirmed quote in Pricing to match.
        </p>
      )}
    </Card>
  );
}

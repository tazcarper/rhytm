"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/lib/ui";
import {
  createCateringAction,
  updateCateringAction,
  deleteCateringAction,
  reorderCateringAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type { AdminCateringOption } from "@/src/services/admin/catering";
import { formatMoney } from "@/src/services/public/format";
import s from "./catalog.module.css";

interface CatalogCateringPanelProps {
  propertyId: string;
  propertySlug: string;
  options: ReadonlyArray<AdminCateringOption>;
}

export function CatalogCateringPanel({
  propertyId,
  propertySlug,
  options,
}: CatalogCateringPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const ctx = { propertyId, propertySlug };

  const [showAdd, setShowAdd] = useState(false);
  const [tier, setTier] = useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  const sorted = options
    .slice()
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.vendorName.localeCompare(b.vendorName),
    );

  const resetDraft = () => {
    setTier("");
    setVendor("");
    setPrice("");
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreateBusy(true);
    const result = await createCateringAction(ctx, {
      propertyId,
      tier,
      vendorName: vendor,
      pricePerHead: price,
      displayOrder: sorted.length,
    });
    setCreateBusy(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    resetDraft();
    setShowAdd(false);
    startTransition(() => router.refresh());
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const index = sorted.findIndex((o) => o.id === id);
    if (index < 0) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const reordered = sorted.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapWith, 0, moved);
    setReorderBusy(true);
    const result = await reorderCateringAction(ctx, {
      propertyId,
      orderedIds: reordered.map((o) => o.id),
    });
    setReorderBusy(false);
    if (result.ok) startTransition(() => router.refresh());
  };

  return (
    <Card padding="loose" elevation="soft" className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <h2 className={s.panelTitle}>Catering (F&amp;B)</h2>
          <p className={s.panelSubtitle}>
            Per-head vendor options shown on the estimate. Priced × total
            headcount.
          </p>
        </div>
        {!showAdd && (
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            + Add option
          </Button>
        )}
      </div>

      <div className={s.list}>
        {sorted.length === 0 && (
          <p className={s.empty}>
            No catering options yet. Add Good / Better / Best vendors here.
          </p>
        )}
        {sorted.map((option, index) => (
          <CateringRow
            key={option.id}
            ctx={ctx}
            option={option}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            reorderBusy={reorderBusy}
            onMoveUp={() => handleMove(option.id, "up")}
            onMoveDown={() => handleMove(option.id, "down")}
            onChanged={() => startTransition(() => router.refresh())}
          />
        ))}
      </div>

      {showAdd && (
        <div className={s.addBlock}>
          <div className={s.addForm}>
            <label>
              <span className={s.fieldLabel}>Tier</span>
              <input
                className={s.input}
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                placeholder="Good / Better / Best"
                autoFocus
              />
            </label>
            <label>
              <span className={s.fieldLabel}>Vendor</span>
              <input
                className={s.input}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. The Salt Lick BBQ"
              />
            </label>
            <label>
              <span className={s.fieldLabel}>Price per head (USD)</span>
              <input
                className={s.input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </label>
            {createError && <span className={s.inlineError}>{createError}</span>}
            <div className={s.addFormActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAdd(false);
                  resetDraft();
                }}
                disabled={createBusy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                loading={createBusy}
                disabled={!tier.trim() || !vendor.trim() || !price || createBusy}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface CateringRowProps {
  ctx: { propertyId: string; propertySlug: string };
  option: AdminCateringOption;
  isFirst: boolean;
  isLast: boolean;
  reorderBusy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}

function CateringRow({
  ctx,
  option,
  isFirst,
  isLast,
  reorderBusy,
  onMoveUp,
  onMoveDown,
  onChanged,
}: CateringRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tier, setTier] = useState(option.tier);
  const [vendor, setVendor] = useState(option.vendorName);
  const [price, setPrice] = useState(String(option.pricePerHead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch?: { isActive?: boolean }) => {
    setBusy(true);
    setError(null);
    const result = await updateCateringAction(ctx, {
      id: option.id,
      tier,
      vendorName: vendor,
      pricePerHead: price,
      isActive: patch?.isActive ?? option.isActive,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save.");
      return;
    }
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteCateringAction(ctx, option.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete.");
      return;
    }
    onChanged();
  };

  if (editing) {
    return (
      <div className={s.row}>
        <div className={s.mainCol} style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <input className={s.input} value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Tier" style={{ maxWidth: 120 }} />
          <input className={s.input} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" style={{ flex: 1, minWidth: 160 }} />
          <input className={s.input} type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} style={{ maxWidth: 120 }} />
          {error && <span className={s.inlineError}>{error}</span>}
        </div>
        <div className={s.actionsCol}>
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => save()} loading={busy} disabled={!tier.trim() || !vendor.trim() || !price || busy}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${s.row} ${!option.isActive ? s.rowInactive : ""}`}>
      <div className={s.reorderCol}>
        <button type="button" className={s.reorderBtn} onClick={onMoveUp} disabled={isFirst || reorderBusy} aria-label={`Move ${option.vendorName} up`}>
          ↑
        </button>
        <button type="button" className={s.reorderBtn} onClick={onMoveDown} disabled={isLast || reorderBusy} aria-label={`Move ${option.vendorName} down`}>
          ↓
        </button>
      </div>
      <div className={s.mainCol}>
        <span className={s.itemName}>
          {option.tier} · {option.vendorName}{" "}
          <span className={s.linkPrice}>${formatMoney(option.pricePerHead)}/head</span>
        </span>
        {error && <span className={s.inlineError}>{error}</span>}
      </div>
      <div className={s.actionsCol}>
        {!option.isActive && <span className={s.inactiveBadge}>Inactive</span>}
        {confirmingDelete ? (
          <>
            <span className={s.itemMeta}>Delete {option.tier}?</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={remove}
              loading={busy}
              disabled={busy}
              style={{ color: "var(--accent-error)", borderColor: "var(--accent-error)" }}
            >
              Yes, delete
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={busy}>
              Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save({ isActive: !option.isActive })} disabled={busy}>
              {option.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(true)} disabled={busy}>
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/lib/ui";
import {
  createAddOnAction,
  reorderAddOnsAction,
  updateAddOnAction,
  listActiveBookingsForAddOnAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type {
  AdminCatalogAddOn,
  AdminCatalogLink,
  AdminCatalogService,
} from "@/src/services/admin/catalog";
import { formatMoney } from "@/src/services/public/format";
import { DeactivateConfirm } from "./deactivate-confirm";
import s from "./catalog.module.css";

interface CatalogAddOnsPanelProps {
  propertyId: string;
  propertySlug: string;
  addOns: ReadonlyArray<AdminCatalogAddOn>;
  /** All current service↔add-on links — used to show "Linked to N services" per row. */
  links: ReadonlyArray<AdminCatalogLink>;
  /** Active services at the property — used to populate the "Available for" checklist in the create form. */
  services: ReadonlyArray<AdminCatalogService>;
}

export function CatalogAddOnsPanel({
  propertyId,
  propertySlug,
  addOns,
  links,
  services,
}: CatalogAddOnsPanelProps) {
  const activeServices = services
    .filter((service) => service.isActive)
    .slice()
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
  const linkCountByAddOn = new Map<string, number>();
  for (const link of links) {
    linkCountByAddOn.set(
      link.addOnId,
      (linkCountByAddOn.get(link.addOnId) ?? 0) + 1,
    );
  }
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftLinkedServiceIds, setDraftLinkedServiceIds] = useState<Set<string>>(
    () => new Set(activeServices.map((service) => service.id)),
  );
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const allLinked =
    activeServices.length > 0 &&
    draftLinkedServiceIds.size === activeServices.length;
  const toggleAllLinked = () => {
    if (allLinked) {
      setDraftLinkedServiceIds(new Set());
    } else {
      setDraftLinkedServiceIds(
        new Set(activeServices.map((service) => service.id)),
      );
    }
  };
  const toggleOneLinked = (serviceId: string) => {
    setDraftLinkedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };
  const resetDraft = () => {
    setDraftName("");
    setDraftDesc("");
    setDraftPrice("");
    setDraftLinkedServiceIds(new Set(activeServices.map((service) => service.id)));
    setCreateError(null);
  };
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] =
    useState<AdminCatalogAddOn | null>(null);

  const sortedActive = addOns
    .filter((addOn) => addOn.isActive)
    .slice()
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
  const sortedInactive = addOns
    .filter((addOn) => !addOn.isActive)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const ctx = { propertyId, propertySlug };

  const handleCreate = async () => {
    setCreateError(null);
    setCreateBusy(true);
    const result = await createAddOnAction(ctx, {
      propertyId,
      name: draftName,
      description: draftDesc || null,
      price: draftPrice,
      displayOrder: sortedActive.length,
      linkedServiceIds: [...draftLinkedServiceIds],
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

  const handleMove = async (addOnId: string, direction: "up" | "down") => {
    const index = sortedActive.findIndex((addOn) => addOn.id === addOnId);
    if (index < 0) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sortedActive.length) return;
    const reordered = sortedActive.map((addOn) => addOn);
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapWith, 0, moved);
    setReorderBusy(true);
    const result = await reorderAddOnsAction(ctx, {
      propertyId,
      orderedIds: reordered.map((addOn) => addOn.id),
    });
    setReorderBusy(false);
    if (result.ok) startTransition(() => router.refresh());
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return { ok: false, error: "No target" };
    const result = await updateAddOnAction(ctx, {
      addOnId: deactivateTarget.id,
      name: deactivateTarget.name,
      description: deactivateTarget.description,
      price: deactivateTarget.price,
      isActive: false,
      imageUrl: deactivateTarget.imageUrl,
      includedDetail: deactivateTarget.includedDetail,
      maxQuantity: deactivateTarget.maxQuantity,
    });
    if (result.ok) {
      setDeactivateTarget(null);
      startTransition(() => router.refresh());
    }
    return result;
  };

  const handleReactivate = async (addOn: AdminCatalogAddOn) => {
    const result = await updateAddOnAction(ctx, {
      addOnId: addOn.id,
      name: addOn.name,
      description: addOn.description,
      price: addOn.price,
      isActive: true,
      imageUrl: addOn.imageUrl,
      includedDetail: addOn.includedDetail,
      maxQuantity: addOn.maxQuantity,
    });
    if (result.ok) startTransition(() => router.refresh());
  };

  return (
    <>
      <Card padding="loose" elevation="soft" className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h2 className={s.panelTitle}>Add-ons</h2>
            <p className={s.panelSubtitle}>
              {sortedActive.length} active
              {sortedInactive.length > 0 && ` · ${sortedInactive.length} inactive`}
            </p>
          </div>
          {!showAdd && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              + Add add-on
            </Button>
          )}
        </div>

        <div className={s.list}>
          {sortedActive.length === 0 && sortedInactive.length === 0 && (
            <p className={s.empty}>
              No add-ons yet. Create the property&rsquo;s common library here
              (ammunition, gear, food). Each one can attach to many services.
            </p>
          )}

          {sortedActive.map((addOn, index) => (
            <AddOnRow
              key={addOn.id}
              addOn={addOn}
              linkCount={linkCountByAddOn.get(addOn.id) ?? 0}
              isFirst={index === 0}
              isLast={index === sortedActive.length - 1}
              reorderBusy={reorderBusy}
              propertyId={propertyId}
              onMoveUp={() => handleMove(addOn.id, "up")}
              onMoveDown={() => handleMove(addOn.id, "down")}
              onDeactivate={() => setDeactivateTarget(addOn)}
            />
          ))}

          {sortedInactive.length > 0 && (
            <>
              <div className={s.inactiveDivider}>Inactive</div>
              {sortedInactive.map((addOn) => (
                <AddOnRow
                  key={addOn.id}
                  addOn={addOn}
                  linkCount={linkCountByAddOn.get(addOn.id) ?? 0}
                  isFirst
                  isLast
                  reorderBusy
                  propertyId={propertyId}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  onDeactivate={() => {}}
                  onActivate={() => handleReactivate(addOn)}
                />
              ))}
            </>
          )}
        </div>

        <p className={s.help} style={{ marginTop: "var(--space-2)" }}>
          Creating an add-on here adds it to the property library. To make it
          selectable in the booking funnel, open a service&rsquo;s Edit page
          and check the box next to it.
        </p>

        {showAdd && (
          <div className={s.addBlock}>
            <div className={s.addForm}>
              <label>
                <span className={s.fieldLabel}>Name</span>
                <input
                  className={s.input}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Ammunition (box of 25)"
                  autoFocus
                />
              </label>
              <label>
                <span className={s.fieldLabel}>Description (optional)</span>
                <textarea
                  className={s.textarea}
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={2}
                />
              </label>
              <label>
                <span className={s.fieldLabel}>Price (USD)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <div>
                <span className={s.fieldLabel}>Available for</span>
                {activeServices.length === 0 ? (
                  <p className={s.help}>
                    No active services at this property yet. Create one first
                    in the Services panel — you&rsquo;ll be able to attach
                    add-ons during that step.
                  </p>
                ) : (
                  <>
                    <label
                      style={{
                        display: "flex",
                        gap: "var(--space-2)",
                        alignItems: "center",
                        padding: "var(--space-2) 0",
                        fontWeight: 500,
                      }}
                    >
                      <input
                        type="checkbox"
                        className={s.linkCheckbox}
                        checked={allLinked}
                        onChange={toggleAllLinked}
                      />
                      <span>
                        All services at this property{" "}
                        <span className={s.help}>
                          (recommended for common items like drink cart or eye protection)
                        </span>
                      </span>
                    </label>
                    <div className={s.linkGrid}>
                      {activeServices.map((service) => (
                        <label key={service.id} className={s.linkRow}>
                          <input
                            type="checkbox"
                            className={s.linkCheckbox}
                            checked={draftLinkedServiceIds.has(service.id)}
                            onChange={() => toggleOneLinked(service.id)}
                          />
                          <div className={s.linkBody}>
                            <span className={s.itemName}>{service.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {createError && (
                <span className={s.inlineError}>{createError}</span>
              )}
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
                  disabled={!draftName.trim() || !draftPrice || createBusy}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {deactivateTarget && (
        <DeactivateConfirm
          noun="add-on"
          itemName={deactivateTarget.name}
          loadRefs={() => listActiveBookingsForAddOnAction(deactivateTarget.id)}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </>
  );
}

interface AddOnRowProps {
  addOn: AdminCatalogAddOn;
  linkCount: number;
  isFirst: boolean;
  isLast: boolean;
  reorderBusy: boolean;
  propertyId: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeactivate: () => void;
  onActivate?: () => void;
}

function AddOnRow({
  addOn,
  linkCount,
  isFirst,
  isLast,
  reorderBusy,
  propertyId,
  onMoveUp,
  onMoveDown,
  onDeactivate,
  onActivate,
}: AddOnRowProps) {
  const linkLabel =
    linkCount === 0
      ? "Not linked to any service"
      : `Linked to ${linkCount} service${linkCount === 1 ? "" : "s"}`;
  return (
    <div className={`${s.row} ${!addOn.isActive ? s.rowInactive : ""}`}>
      <div className={s.reorderCol}>
        <button
          type="button"
          className={s.reorderBtn}
          onClick={onMoveUp}
          disabled={isFirst || reorderBusy || !addOn.isActive}
          aria-label={`Move ${addOn.name} up`}
        >
          ↑
        </button>
        <button
          type="button"
          className={s.reorderBtn}
          onClick={onMoveDown}
          disabled={isLast || reorderBusy || !addOn.isActive}
          aria-label={`Move ${addOn.name} down`}
        >
          ↓
        </button>
      </div>
      <div className={s.mainCol}>
        <span className={s.itemName}>
          {addOn.name}{" "}
          <span className={s.linkPrice}>${formatMoney(addOn.price)}</span>
        </span>
        {addOn.description && (
          <span className={s.itemMeta}>{addOn.description}</span>
        )}
        <span
          className={s.itemMeta}
          style={{
            color:
              linkCount === 0 && addOn.isActive
                ? "var(--accent-warn)"
                : undefined,
            fontWeight: linkCount === 0 && addOn.isActive ? 500 : undefined,
          }}
        >
          {linkLabel}
        </span>
        {addOn.estimateMemberDiscount && (
          <span className={s.itemMeta} style={{ color: "var(--olive)", fontWeight: 500 }}>
            Member discount · 20% off
          </span>
        )}
      </div>
      <div className={s.actionsCol}>
        {!addOn.isActive && <span className={s.inactiveBadge}>Inactive</span>}
        <Button asChild variant="secondary" size="sm">
          <Link
            href={`/admin/properties/${propertyId}/catalog/add-ons/${addOn.id}/edit`}
          >
            Edit
          </Link>
        </Button>
        {addOn.isActive ? (
          <Button variant="secondary" size="sm" onClick={onDeactivate}>
            Deactivate
          </Button>
        ) : (
          onActivate && (
            <Button variant="primary" size="sm" onClick={onActivate}>
              Reactivate
            </Button>
          )
        )}
      </div>
    </div>
  );
}

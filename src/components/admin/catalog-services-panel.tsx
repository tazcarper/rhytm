"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/lib/ui";
import {
  createServiceAction,
  reorderServicesAction,
  updateServiceAction,
  listActiveBookingsForServiceAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type { AdminCatalogService, AdminCatalogLink } from "@/src/services/admin/catalog";
import type { EstimatePricingKind } from "@/src/services/public/estimate-catalog";
import { DeactivateConfirm } from "./deactivate-confirm";
import s from "./catalog.module.css";

// Short estimate-pricing labels for the on-estimate badge.
const PRICING_KIND_LABEL: Record<EstimatePricingKind, string> = {
  guest_fee_tier: "guest fee",
  lesson_ladder: "lesson",
  class_per_person: "class",
  quote: "quote",
};

interface CatalogServicesPanelProps {
  propertyId: string;
  propertySlug: string;
  services: ReadonlyArray<AdminCatalogService>;
  /** All current service↔add-on links — used so a deactivate save can preserve the linked set. */
  links: ReadonlyArray<AdminCatalogLink>;
  /** Open the inline editor drawer for a service (handled by the workspace). */
  onEditItem: (serviceId: string) => void;
}

export function CatalogServicesPanel({
  propertyId,
  propertySlug,
  services,
  links,
  onEditItem,
}: CatalogServicesPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] =
    useState<AdminCatalogService | null>(null);

  const sortedActive = services
    .filter((service) => service.isActive)
    .slice()
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
  const sortedInactive = services
    .filter((service) => !service.isActive)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const ctx = { propertyId, propertySlug };

  const handleCreate = async () => {
    setCreateError(null);
    setCreateBusy(true);
    const result = await createServiceAction(ctx, {
      propertyId,
      name: draftName,
      description: draftDesc || null,
      displayOrder: sortedActive.length,
    });
    setCreateBusy(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setDraftName("");
    setDraftDesc("");
    setShowAdd(false);
    startTransition(() => router.refresh());
  };

  const handleMove = async (serviceId: string, direction: "up" | "down") => {
    const index = sortedActive.findIndex((service) => service.id === serviceId);
    if (index < 0) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sortedActive.length) return;
    const reordered = sortedActive.map((service) => service);
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapWith, 0, moved);
    setReorderBusy(true);
    const result = await reorderServicesAction(ctx, {
      propertyId,
      orderedIds: reordered.map((service) => service.id),
    });
    setReorderBusy(false);
    if (result.ok) startTransition(() => router.refresh());
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return { ok: false, error: "No target" };
    const currentLinkedIds = links
      .filter((link) => link.serviceId === deactivateTarget.id)
      .map((link) => link.addOnId);
    const result = await updateServiceAction(ctx, {
      serviceId: deactivateTarget.id,
      propertyId,
      name: deactivateTarget.name,
      description: deactivateTarget.description,
      isActive: false,
      imageUrl: deactivateTarget.imageUrl,
      linkedAddOnIds: currentLinkedIds,
      newAddOns: [],
    });
    if (result.ok) {
      setDeactivateTarget(null);
      startTransition(() => router.refresh());
    }
    return result;
  };

  const handleReactivate = async (service: AdminCatalogService) => {
    const currentLinkedIds = links
      .filter((link) => link.serviceId === service.id)
      .map((link) => link.addOnId);
    const result = await updateServiceAction(ctx, {
      serviceId: service.id,
      propertyId,
      name: service.name,
      description: service.description,
      isActive: true,
      imageUrl: service.imageUrl,
      linkedAddOnIds: currentLinkedIds,
      newAddOns: [],
    });
    if (result.ok) startTransition(() => router.refresh());
  };

  return (
    <>
      <Card padding="loose" elevation="soft" className={s.panel}>
        <div className={s.panelHead}>
          <div className={s.panelHeadText}>
            <div className={s.panelTitleRow}>
              <h2 className={s.panelTitle}>Experiences</h2>
              <span className={s.panelCount}>
                {sortedActive.length} active
                {sortedInactive.length > 0 &&
                  ` · ${sortedInactive.length} inactive`}
              </span>
            </div>
            <p className={s.panelDesc}>
              The bookable experiences guests choose from on this property —
              clays, lessons, hunts, and events. Edit one to set its estimate
              pricing and which add-ons attach to it.
            </p>
          </div>
          {!showAdd && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              + Add experience
            </Button>
          )}
        </div>

        <div className={s.list}>
          {sortedActive.length === 0 && sortedInactive.length === 0 && (
            <p className={s.empty}>No experiences yet. Add one to get started.</p>
          )}

          {sortedActive.map((service, index) => (
            <ServiceRow
              key={service.id}
              service={service}
              isFirst={index === 0}
              isLast={index === sortedActive.length - 1}
              reorderBusy={reorderBusy}
              onEdit={() => onEditItem(service.id)}
              onMoveUp={() => handleMove(service.id, "up")}
              onMoveDown={() => handleMove(service.id, "down")}
              onDeactivate={() => setDeactivateTarget(service)}
            />
          ))}

          {sortedInactive.length > 0 && (
            <>
              <div className={s.inactiveDivider}>Inactive</div>
              {sortedInactive.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  isFirst
                  isLast
                  reorderBusy
                  onEdit={() => onEditItem(service.id)}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  onDeactivate={() => {}}
                  onActivate={() => handleReactivate(service)}
                />
              ))}
            </>
          )}
        </div>

        {showAdd && (
          <div className={s.addBlock}>
            <div className={s.addForm}>
              <label>
                <span className={s.fieldLabel}>Name</span>
                <input
                  className={s.input}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Sporting Clays"
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
              {createError && (
                <span className={s.inlineError}>{createError}</span>
              )}
              <div className={s.addFormActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    setDraftName("");
                    setDraftDesc("");
                    setCreateError(null);
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
                  disabled={!draftName.trim() || createBusy}
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
          noun="service"
          itemName={deactivateTarget.name}
          loadRefs={() => listActiveBookingsForServiceAction(deactivateTarget.id)}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </>
  );
}

interface ServiceRowProps {
  service: AdminCatalogService;
  isFirst: boolean;
  isLast: boolean;
  reorderBusy: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeactivate: () => void;
  onActivate?: () => void;
}

function ServiceRow({
  service,
  isFirst,
  isLast,
  reorderBusy,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDeactivate,
  onActivate,
}: ServiceRowProps) {
  return (
    <div className={`${s.row} ${!service.isActive ? s.rowInactive : ""}`}>
      <div className={s.reorderCol}>
        <button
          type="button"
          className={s.reorderBtn}
          onClick={onMoveUp}
          disabled={isFirst || reorderBusy || !service.isActive}
          aria-label={`Move ${service.name} up`}
        >
          ↑
        </button>
        <button
          type="button"
          className={s.reorderBtn}
          onClick={onMoveDown}
          disabled={isLast || reorderBusy || !service.isActive}
          aria-label={`Move ${service.name} down`}
        >
          ↓
        </button>
      </div>
      <div className={s.mainCol}>
        <span className={s.itemName}>{service.name}</span>
        {service.description && (
          <span className={s.itemMeta}>{service.description}</span>
        )}
        <span
          className={s.itemMeta}
          style={{ color: "var(--olive)", fontWeight: 500 }}
        >
          {`Estimate pricing · ${PRICING_KIND_LABEL[service.pricingKind]}`}
        </span>
      </div>
      <div className={s.actionsCol}>
        {!service.isActive && (
          <span className={s.inactiveBadge}>Inactive</span>
        )}
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {service.isActive ? (
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

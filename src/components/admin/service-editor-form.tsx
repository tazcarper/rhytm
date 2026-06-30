"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  createServiceAction,
  deleteServiceAction,
  listAllBookingsForServiceAction,
  updateServiceAction,
  uploadServiceImageAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type {
  AdminCatalogService,
  AdminCatalogAddOn,
} from "@/src/services/admin/catalog";
import { formatMoney } from "@/src/services/public/format";
import { DeleteCatalogItemConfirm } from "./delete-catalog-item-confirm";
import { downscaleImage } from "./downscale-image";
import s from "./catalog.module.css";

// The discipline card photo renders edge-to-edge in the booking funnel at
// roughly half the page width; a 2000px max edge keeps it crisp on retina
// without shipping originals. Downscale in the browser before upload.
const SERVICE_IMAGE_MAX_EDGE = 2000;

interface ServiceEditorFormProps {
  propertyId: string;
  propertySlug: string;
  /** Omit to render the form in create mode (a brand-new experience). */
  service?: AdminCatalogService;
  /** All add-ons available at this property (active only). */
  availableAddOns: ReadonlyArray<AdminCatalogAddOn>;
  /** IDs of add-ons currently linked to this service (edit mode). */
  initialLinkedAddOnIds?: ReadonlyArray<string>;
  /** Display order for a newly created experience (append to the end). */
  createDisplayOrder?: number;
  /** Close the surrounding modal after save / create / delete. */
  onClose?: () => void;
}

interface NewAddOnDraftRow {
  name: string;
  description: string;
  price: string;
}

export function ServiceEditorForm({
  propertyId,
  propertySlug,
  service,
  availableAddOns,
  initialLinkedAddOnIds = [],
  createDisplayOrder = 0,
  onClose,
}: ServiceEditorFormProps) {
  const isCreate = service === undefined;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");

  // Estimate pricing fields.
  const [pricingKind, setPricingKind] = useState(
    service?.pricingKind ?? "guest_fee_tier",
  );
  const [membersOnly, setMembersOnly] = useState(service?.membersOnly ?? false);
  const [lessonLadderText, setLessonLadderText] = useState(
    (service?.lessonLadder ?? []).join(", "),
  );
  const [lessonCohortSize, setLessonCohortSize] = useState(
    String(service?.lessonCohortSize ?? 5),
  );
  const [classPriceMember, setClassPriceMember] = useState(
    service?.classPriceMember == null ? "" : String(service.classPriceMember),
  );
  const [classPricePublic, setClassPricePublic] = useState(
    service?.classPricePublic == null ? "" : String(service.classPricePublic),
  );
  const [perTargetRateMember, setPerTargetRateMember] = useState(
    service?.perTargetRateMember == null ? "" : String(service.perTargetRateMember),
  );
  const [perTargetRatePublic, setPerTargetRatePublic] = useState(
    service?.perTargetRatePublic == null ? "" : String(service.perTargetRatePublic),
  );
  const [targetAllotmentSize, setTargetAllotmentSize] = useState(
    String(service?.targetAllotmentSize ?? 30),
  );
  const [targetMaxCount, setTargetMaxCount] = useState(
    service?.targetMaxCount == null ? "" : String(service.targetMaxCount),
  );
  const [targetUnitLabel, setTargetUnitLabel] = useState(
    service?.targetUnitLabel ?? "target",
  );
  // Reusable per-outing session fee — applies to any pricing kind.
  const [sessionFee, setSessionFee] = useState(
    service?.sessionFee == null ? "" : String(service.sessionFee),
  );
  const [sessionFeeLabel, setSessionFeeLabel] = useState(
    service?.sessionFeeLabel ?? "",
  );
  const [sessionFeeDescription, setSessionFeeDescription] = useState(
    service?.sessionFeeDescription ?? "",
  );
  const [linkedIds, setLinkedIds] = useState<Set<string>>(
    new Set(initialLinkedAddOnIds),
  );
  const [newAddOns, setNewAddOns] = useState<NewAddOnDraftRow[]>([]);
  const [showDelete, setShowDelete] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload path: downscale in the browser, hand the file to the admin action,
  // then drop the returned public URL into the same `imageUrl` field a pasted
  // URL fills. Save is still a separate step — uploading only fills the field.
  const handlePickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    startUpload(async () => {
      const optimized = await downscaleImage(file, {
        maxEdge: SERVICE_IMAGE_MAX_EDGE,
      });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadServiceImageAction(formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setImageUrl(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  // Close the surrounding modal + refresh after a delete / deactivate.
  const afterRemoval = () => {
    onClose?.();
    router.refresh();
  };

  const handleDelete = async () => {
    if (!service) return { ok: false, error: "Nothing to delete." };
    const result = await deleteServiceAction(
      { propertyId, propertySlug },
      service.id,
    );
    if (result.ok) afterRemoval();
    return result;
  };

  const handleDeactivateFallback = async () => {
    if (!service) return { ok: false, error: "Nothing to deactivate." };
    const result = await updateServiceAction(
      { propertyId, propertySlug },
      {
        serviceId: service.id,
        propertyId,
        name: service.name,
        description: service.description,
        isActive: false,
        imageUrl: service.imageUrl,
        linkedAddOnIds: [...initialLinkedAddOnIds],
        newAddOns: [],
      },
    );
    if (result.ok) afterRemoval();
    return result;
  };

  const toggleLinked = (id: string) => {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addDraft = () =>
    setNewAddOns((prev) => [...prev, { name: "", description: "", price: "" }]);
  const updateDraft = (index: number, patch: Partial<NewAddOnDraftRow>) =>
    setNewAddOns((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  const removeDraft = (index: number) =>
    setNewAddOns((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    const trimmedDrafts = newAddOns
      .filter((draft) => draft.name.trim() !== "")
      .map((draft) => ({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price: draft.price,
      }));

    const ladderValues = lessonLadderText
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    // Pricing payload is identical for create and update.
    const pricing = {
      pricingKind,
      membersOnly,
      lessonLadder: ladderValues.length > 0 ? ladderValues : null,
      lessonCohortSize: lessonCohortSize.trim() === "" ? 5 : Number(lessonCohortSize),
      classPriceMember: classPriceMember.trim() === "" ? null : Number(classPriceMember),
      classPricePublic: classPricePublic.trim() === "" ? null : Number(classPricePublic),
      perTargetRateMember:
        perTargetRateMember.trim() === "" ? null : Number(perTargetRateMember),
      perTargetRatePublic:
        perTargetRatePublic.trim() === "" ? null : Number(perTargetRatePublic),
      targetAllotmentSize:
        targetAllotmentSize.trim() === "" ? 30 : Number(targetAllotmentSize),
      targetMaxCount: targetMaxCount.trim() === "" ? null : Number(targetMaxCount),
      targetUnitLabel: targetUnitLabel.trim() === "" ? "target" : targetUnitLabel.trim(),
      sessionFee: sessionFee.trim() === "" ? null : Number(sessionFee),
      sessionFeeLabel: sessionFeeLabel.trim() === "" ? null : sessionFeeLabel.trim(),
      sessionFeeDescription:
        sessionFeeDescription.trim() === "" ? null : sessionFeeDescription.trim(),
    };

    startTransition(async () => {
      if (!service) {
        const result = await createServiceAction(
          { propertyId, propertySlug },
          {
            propertyId,
            name,
            description: description.trim() || null,
            displayOrder: createDisplayOrder,
            isActive,
            imageUrl: imageUrl.trim() || null,
            linkedAddOnIds: [...linkedIds],
            newAddOns: trimmedDrafts,
            ...pricing,
          },
        );
        if (!result.ok) {
          setError(result.error ?? "Could not create.");
          return;
        }
        onClose?.();
        router.refresh();
        return;
      }

      const result = await updateServiceAction(
        { propertyId, propertySlug },
        {
          serviceId: service.id,
          propertyId,
          name,
          description: description.trim() || null,
          isActive,
          imageUrl: imageUrl.trim() || null,
          linkedAddOnIds: [...linkedIds],
          newAddOns: trimmedDrafts,
          ...pricing,
        },
      );
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setSavedAt(Date.now());
      setNewAddOns([]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={s.formGroup}>
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {savedAt && !error && (
        <Alert variant="success" title="Saved">
          Changes applied.
        </Alert>
      )}

      <Card padding="loose" elevation="soft">
        <h2 className={s.panelTitle} style={{ marginBottom: "var(--space-3)" }}>
          Details
        </h2>
        <div className={s.fieldStack}>
          <label className={s.field}>
            <span className={s.fieldLabel}>Name</span>
            <input
              className={s.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>Description (optional, markdown supported)</span>
            <textarea
              className={s.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <span className={s.help}>
              Shown to guests in the booking funnel and on the bid page.
            </span>
          </label>

          <div className={s.formGroup}>
            <span className={s.fieldLabel}>Card photo (optional)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handlePickFile(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={isUploading}
                onClick={() => fileRef.current?.click()}
              >
                {isUploading
                  ? "Uploading…"
                  : imageUrl.trim() !== ""
                    ? "Replace photo"
                    : "Upload photo"}
              </Button>
              <span className={s.help}>
                JPEG, PNG, or WebP up to 10&nbsp;MB. Landscape works best;
                larger images are resized automatically. Shown on the
                discipline card in the booking funnel.
              </span>
            </div>
            {uploadError && (
              <span className={s.help} style={{ color: "var(--accent-error)" }}>
                {uploadError}
              </span>
            )}
            <input
              className={s.input}
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="…or paste an image link (https://…)"
            />
            {imageUrl.trim() !== "" && (
              <div
                style={{
                  marginTop: "var(--space-2)",
                  aspectRatio: "16 / 9",
                  maxWidth: 320,
                  overflow: "hidden",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--border)",
                  background: "var(--paper-warm)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl.trim()}
                  alt="Discipline card preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>

          <label
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--olive)" }}
            />
            <span>Active (appears in the public booking funnel)</span>
          </label>
        </div>
      </Card>

      <Card padding="loose" elevation="soft">
        <h2 className={s.panelTitle} style={{ marginBottom: "var(--space-2)" }}>
          Estimate pricing
        </h2>
        <p className={s.help} style={{ marginBottom: "var(--space-3)" }}>
          How this experience is priced on the public Request-an-Estimate page.
          It appears there whenever it&rsquo;s active — deactivate to hide it.
        </p>
        <div className={s.fieldStack}>
          <label className={s.field}>
            <span className={s.fieldLabel}>Pricing strategy</span>
            <select
              className={s.input}
              value={pricingKind}
              onChange={(e) =>
                setPricingKind(e.target.value as typeof pricingKind)
              }
            >
              <option value="guest_fee_tier">
                Guest-fee tier (priced from the property guest-fee schedule)
              </option>
              <option value="lesson_ladder">Private lesson (per-student ladder)</option>
              <option value="class_per_person">Class / clinic (per person)</option>
              <option value="per_target">Per-target (e.g. Helice — rate × targets)</option>
              <option value="quote">Quote (&ldquo;we&rsquo;ll quote this&rdquo;)</option>
            </select>
          </label>

          {pricingKind === "guest_fee_tier" && (
            <p className={s.help}>
              Priced from this property&rsquo;s guest-fee schedule (edit it on the
              Guest fees tab). Guests pay the tiered fee; members shoot on dues.
            </p>
          )}

          {pricingKind === "lesson_ladder" && (
            <>
              <label className={s.field}>
                <span className={s.fieldLabel}>Per-student ladder (comma-separated $)</span>
                <input
                  className={s.input}
                  value={lessonLadderText}
                  onChange={(e) => setLessonLadderText(e.target.value)}
                  placeholder="200, 100, 50, 50, 50"
                />
                <span className={s.help}>
                  Hourly rate per student by slot position — the 1st student is
                  the lead-slot rate, refilling each cohort. Multiplied by lesson
                  length.
                </span>
              </label>
              <label className={s.field}>
                <span className={s.fieldLabel}>Cohort size (students per instructor)</span>
                <input
                  className={s.input}
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  inputMode="numeric"
                  value={lessonCohortSize}
                  onChange={(e) => setLessonCohortSize(e.target.value)}
                />
              </label>
            </>
          )}

          {pricingKind === "class_per_person" && (
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                <span className={s.fieldLabel}>Member price / person (USD)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={classPriceMember}
                  onChange={(e) => setClassPriceMember(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                <span className={s.fieldLabel}>Public price / person (USD)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={classPricePublic}
                  onChange={(e) => setClassPricePublic(e.target.value)}
                  placeholder="0.00"
                />
              </label>
            </div>
          )}

          {pricingKind === "per_target" && (
            <>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                  <span className={s.fieldLabel}>Member rate / target (USD)</span>
                  <input
                    className={s.input}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={perTargetRateMember}
                    onChange={(e) => setPerTargetRateMember(e.target.value)}
                    placeholder="2.50"
                  />
                </label>
                <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                  <span className={s.fieldLabel}>Public rate / target (USD)</span>
                  <input
                    className={s.input}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={perTargetRatePublic}
                    onChange={(e) => setPerTargetRatePublic(e.target.value)}
                    placeholder="2.95"
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                  <span className={s.fieldLabel}>Allotment size (targets per block)</span>
                  <input
                    className={s.input}
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    inputMode="numeric"
                    value={targetAllotmentSize}
                    onChange={(e) => setTargetAllotmentSize(e.target.value)}
                    placeholder="30"
                  />
                </label>
                <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                  <span className={s.fieldLabel}>Maximum targets (optional)</span>
                  <input
                    className={s.input}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={targetMaxCount}
                    onChange={(e) => setTargetMaxCount(e.target.value)}
                    placeholder="no limit"
                  />
                </label>
                <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                  <span className={s.fieldLabel}>Unit label</span>
                  <input
                    className={s.input}
                    value={targetUnitLabel}
                    onChange={(e) => setTargetUnitLabel(e.target.value)}
                    placeholder="target"
                  />
                </label>
              </div>
              <p className={s.help}>
                Priced as rate × targets, sold in allotments (e.g. 30 / 60 / 90).
                The per-target price is all-in; ammo is a separate add-on.
                Non-member guests also pay the property guest fee; members shoot on
                dues.
              </p>
            </>
          )}

          {pricingKind === "quote" && (
            <p className={s.help}>
              Shown as &ldquo;we&rsquo;ll quote this&rdquo; with no number — the
              team prices it on the bid.
            </p>
          )}

          {/* Reusable per-outing flat fee — applies to any pricing kind. */}
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
              <span className={s.fieldLabel}>Session fee / outing (USD, optional)</span>
              <input
                className={s.input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={sessionFee}
                onChange={(e) => setSessionFee(e.target.value)}
                placeholder="49.50"
              />
            </label>
            <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
              <span className={s.fieldLabel}>Session fee label</span>
              <input
                className={s.input}
                value={sessionFeeLabel}
                onChange={(e) => setSessionFeeLabel(e.target.value)}
                placeholder="Setup / ring fee"
              />
            </label>
          </div>
          <label className={s.field}>
            <span className={s.fieldLabel}>Session fee description (optional)</span>
            <input
              className={s.input}
              value={sessionFeeDescription}
              onChange={(e) => setSessionFeeDescription(e.target.value)}
              placeholder="We staff the ring every session."
            />
            <span className={s.help}>
              A flat fee charged once per outing to everyone (members + guests).
              Leave the amount blank for no session fee.
            </span>
          </label>

          <label
            style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={membersOnly}
              onChange={(e) => setMembersOnly(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--olive)" }}
            />
            <span>Members only (locked for a non-member host)</span>
          </label>
        </div>
      </Card>

      <Card padding="loose" elevation="soft">
        <h2 className={s.panelTitle} style={{ marginBottom: "var(--space-2)" }}>
          Add-ons available for this service
        </h2>
        <p className={s.help} style={{ marginBottom: "var(--space-3)" }}>
          Check each add-on a guest can attach to this service. Create new
          property-wide add-ons below — they become available to every
          service at this property.
        </p>

        {availableAddOns.length === 0 ? (
          <p className={s.empty}>
            No active add-ons at this property yet. Create one below or in the
            Add-ons panel.
          </p>
        ) : (
          <div className={s.linkGrid}>
            {availableAddOns.map((addOn) => {
              const checked = linkedIds.has(addOn.id);
              return (
                <label key={addOn.id} className={s.linkRow}>
                  <input
                    type="checkbox"
                    className={s.linkCheckbox}
                    checked={checked}
                    onChange={() => toggleLinked(addOn.id)}
                  />
                  <div className={s.linkBody}>
                    <span className={s.itemName}>{addOn.name}</span>
                    {addOn.description && (
                      <span className={s.itemMeta}>{addOn.description}</span>
                    )}
                  </div>
                  <span className={s.linkPrice}>${formatMoney(addOn.price)}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className={s.addBlock}>
          <div className={s.shellHeaderRow}>
            <span className={s.fieldLabel}>
              New add-ons (will be created and linked to this service on save)
            </span>
            <Button variant="secondary" size="sm" onClick={addDraft} type="button">
              + Add new add-on
            </Button>
          </div>

          {newAddOns.map((draft, index) => (
            <div key={index} className={s.newAddOnDraft}>
              <label>
                <span className={s.fieldLabel}>Name</span>
                <input
                  className={s.input}
                  value={draft.name}
                  onChange={(e) =>
                    updateDraft(index, { name: e.target.value })
                  }
                  placeholder="e.g. Ammunition (box of 25)"
                />
              </label>
              <label>
                <span className={s.fieldLabel}>Description</span>
                <input
                  className={s.input}
                  value={draft.description}
                  onChange={(e) =>
                    updateDraft(index, { description: e.target.value })
                  }
                />
              </label>
              <label>
                <span className={s.fieldLabel}>Price</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) =>
                    updateDraft(index, { price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => removeDraft(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {!isCreate && service && (
        <Card padding="loose" elevation="soft">
          <h2
            className={s.panelTitle}
            style={{ marginBottom: "var(--space-2)", color: "var(--accent-error)" }}
          >
            WARNING
          </h2>
          <p className={s.help} style={{ marginBottom: "var(--space-3)" }}>
            Permanently remove this service. If any booking ever referenced it,
            delete is blocked at the database level — you&rsquo;ll be offered
            deactivate as a fallback. Prefer deactivate in normal operation;
            delete is for cleaning up mistakes.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowDelete(true)}
            style={{
              color: "var(--accent-error)",
              borderColor: "var(--accent-error)",
            }}
          >
            Delete service…
          </Button>
        </Card>
      )}

      <div className={s.stickyActions}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onClose?.()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          {isPending
            ? isCreate
              ? "Creating…"
              : "Saving…"
            : isCreate
              ? "Create experience"
              : "Save"}
        </Button>
      </div>

      {showDelete && service && (
        <DeleteCatalogItemConfirm
          noun="service"
          itemName={service.name}
          loadRefs={() => listAllBookingsForServiceAction(service.id)}
          onDelete={handleDelete}
          onDeactivateInstead={service.isActive ? handleDeactivateFallback : undefined}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </form>
  );
}

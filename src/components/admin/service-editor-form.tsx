"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
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
  service: AdminCatalogService;
  /** All add-ons available at this property (active only — see editor page). */
  availableAddOns: ReadonlyArray<AdminCatalogAddOn>;
  /** IDs of add-ons currently linked to this service. */
  initialLinkedAddOnIds: ReadonlyArray<string>;
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
  initialLinkedAddOnIds,
}: ServiceEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [isActive, setIsActive] = useState(service.isActive);
  const [imageUrl, setImageUrl] = useState(service.imageUrl ?? "");
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

  const handleDelete = async () => {
    const result = await deleteServiceAction(
      { propertyId, propertySlug },
      service.id,
    );
    if (result.ok) {
      router.push(`/admin/properties/${propertyId}/catalog`);
      router.refresh();
    }
    return result;
  };

  const handleDeactivateFallback = async () => {
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
    if (result.ok) {
      router.push(`/admin/properties/${propertyId}/catalog`);
      router.refresh();
    }
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

    startTransition(async () => {
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
        <div className={s.formGroup}>
          <label className={s.formGroup}>
            <span className={s.fieldLabel}>Name</span>
            <input
              className={s.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className={s.formGroup}>
            <span className={s.fieldLabel}>Description (markdown supported)</span>
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
            <span className={s.fieldLabel}>Card photo</span>
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

      <div className={s.stickyActions}>
        <Button
          asChild
          variant="secondary"
          disabled={isPending}
        >
          <a href={`/admin/properties/${propertyId}/catalog`}>Cancel</a>
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>

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

      {showDelete && (
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

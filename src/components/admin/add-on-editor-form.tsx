"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  deleteAddOnAction,
  listAllBookingsForAddOnAction,
  updateAddOnAction,
  uploadAddOnImageAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type { AdminCatalogAddOn } from "@/src/services/admin/catalog";
import { DeleteCatalogItemConfirm } from "./delete-catalog-item-confirm";
import { downscaleImage } from "./downscale-image";
import s from "./catalog.module.css";

// Detail photo shows in the funnel pop-up at ~440px wide (cinematic crop), so
// a 1600px max edge is plenty; downscale in the browser before upload.
const ADDON_IMAGE_MAX_EDGE = 1600;

interface AddOnEditorFormProps {
  propertyId: string;
  propertySlug: string;
  addOn: AdminCatalogAddOn;
}

export function AddOnEditorForm({
  propertyId,
  propertySlug,
  addOn,
}: AddOnEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [name, setName] = useState(addOn.name);
  const [description, setDescription] = useState(addOn.description ?? "");
  const [price, setPrice] = useState(String(addOn.price));
  const [isActive, setIsActive] = useState(addOn.isActive);
  const [includedDetail, setIncludedDetail] = useState(
    addOn.includedDetail ?? "",
  );
  const [imageUrl, setImageUrl] = useState(addOn.imageUrl ?? "");
  const [maxQuantity, setMaxQuantity] = useState(String(addOn.maxQuantity));
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
        maxEdge: ADDON_IMAGE_MAX_EDGE,
      });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadAddOnImageAction(formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setImageUrl(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    const result = await deleteAddOnAction(
      { propertyId, propertySlug },
      addOn.id,
    );
    if (result.ok) {
      router.push(`/admin/properties/${propertyId}/catalog`);
      router.refresh();
    }
    return result;
  };

  const handleDeactivateFallback = async () => {
    const result = await updateAddOnAction(
      { propertyId, propertySlug },
      {
        addOnId: addOn.id,
        name: addOn.name,
        description: addOn.description,
        price: addOn.price,
        isActive: false,
        imageUrl: addOn.imageUrl,
        includedDetail: addOn.includedDetail,
        maxQuantity: addOn.maxQuantity,
      },
    );
    if (result.ok) {
      router.push(`/admin/properties/${propertyId}/catalog`);
      router.refresh();
    }
    return result;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await updateAddOnAction(
        { propertyId, propertySlug },
        {
          addOnId: addOn.id,
          name,
          description: description.trim() || null,
          price,
          isActive,
          imageUrl: imageUrl.trim() || null,
          includedDetail: includedDetail.trim() || null,
          maxQuantity,
        },
      );
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setSavedAt(Date.now());
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
          </label>
          <label className={s.formGroup}>
            <span className={s.fieldLabel}>Price (USD)</span>
            <input
              className={s.input}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <span className={s.help}>
              New bookings use this price. Existing bookings keep the snapshot
              they were created with.
            </span>
          </label>
          <label className={s.formGroup}>
            <span className={s.fieldLabel}>Maximum quantity per booking</span>
            <input
              className={s.input}
              type="number"
              min="1"
              max="99"
              step="1"
              inputMode="numeric"
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
              required
            />
            <span className={s.help}>
              Set to 1 for a simple add/remove. Set higher to let guests choose
              how many — the booking funnel shows a (&minus;&nbsp;#&nbsp;+)
              quantity control, capped at this number.
            </span>
          </label>

          <label className={s.formGroup}>
            <span className={s.fieldLabel}>What&rsquo;s included</span>
            <textarea
              className={s.textarea}
              value={includedDetail}
              onChange={(e) => setIncludedDetail(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Includes 100 rounds · 12, 20, or 28 gauge"
            />
            <span className={s.help}>
              One short line shown under the price in the booking pop-up. Leave
              blank to hide it.
            </span>
          </label>

          <div className={s.formGroup}>
            <span className={s.fieldLabel}>Detail photo</span>
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
                larger images are resized automatically.
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
                  alt="Add-on detail preview"
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
            <span>Active (selectable in the booking funnel)</span>
          </label>
        </div>
      </Card>

      <div className={s.stickyActions}>
        <Button asChild variant="secondary" disabled={isPending}>
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
          Permanently remove this add-on. If any booking ever referenced it,
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
          Delete add-on…
        </Button>
      </Card>

      {showDelete && (
        <DeleteCatalogItemConfirm
          noun="add-on"
          itemName={addOn.name}
          loadRefs={() => listAllBookingsForAddOnAction(addOn.id)}
          onDelete={handleDelete}
          onDeactivateInstead={addOn.isActive ? handleDeactivateFallback : undefined}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </form>
  );
}

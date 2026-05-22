"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  deleteAddOnAction,
  listAllBookingsForAddOnAction,
  updateAddOnAction,
} from "@/app/admin/properties/[id]/catalog/actions";
import type { AdminCatalogAddOn } from "@/src/services/admin/catalog";
import { DeleteCatalogItemConfirm } from "./delete-catalog-item-confirm";
import s from "./catalog.module.css";

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
  const [showDelete, setShowDelete] = useState(false);

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

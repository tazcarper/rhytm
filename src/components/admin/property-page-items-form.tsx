"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { savePropertyPageContentAction } from "@/app/admin/properties/[slug]/content/actions";
import type { PropertyPageKey, PropertyContentItem } from "@/src/services/public/property-page-content";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import type { ItemFieldKey } from "@/src/constants/admin/property-page-sections";
import { ALL_ITEM_FIELDS } from "@/src/constants/admin/property-page-sections";
import { PropertyContentImageInput } from "./property-content-image-input";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface EditableItem extends PropertyContentItem {
  key: string; // client-side stable key, not persisted
}

interface PropertyPageItemsFormProps {
  propertyId: string;
  pageKey: PropertyPageKey;
  sectionKey: string;
  sectionLabel: string;
  helpText?: string;
  section: AdminPropertyPageSection | null;
  /** Which per-card fields to show. Default: all five. */
  itemFields?: ReadonlyArray<ItemFieldKey>;
  /** Cap on how many cards can be added. Default: unlimited. */
  maxItems?: number;
}

function toEditable(items: PropertyContentItem[] | null): EditableItem[] {
  return (items ?? []).map((item) => ({ key: crypto.randomUUID(), ...item }));
}

// Add/remove/reorder editor for a repeating "items" section (benefit
// tiles, amenity cards, occasion cards, programs, onboarding steps,
// pricing figures). Every field is optional and `itemFields` narrows which
// inputs render per section — an admin only ever sees what a given
// section's public page actually reads (see
// src/constants/admin/property-page-sections.ts).
export function PropertyPageItemsForm({
  propertyId,
  pageKey,
  sectionKey,
  sectionLabel,
  helpText,
  section,
  itemFields = ALL_ITEM_FIELDS,
  maxItems,
}: PropertyPageItemsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [items, setItems] = useState<EditableItem[]>(() => toEditable(section?.items ?? null));

  const showTitle = itemFields.includes("title");
  const showLink = itemFields.includes("link");
  const showBody = itemFields.includes("body");
  const showImage = itemFields.includes("image");
  const showBullets = itemFields.includes("bullets");
  const itemsFull = maxItems !== undefined && items.length >= maxItems;

  function addItem() {
    setItems([...items, { key: crypto.randomUUID() }]);
  }

  function removeItem(key: string) {
    setItems(items.filter((item) => item.key !== key));
  }

  function moveItem(key: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  function updateItem(key: string, patch: Partial<EditableItem>) {
    setItems(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function updateBullet(key: string, index: number, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    const bullets = [...(item.bullets ?? [])];
    bullets[index] = value;
    updateItem(key, { bullets });
  }

  function addBullet(key: string) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    updateItem(key, { bullets: [...(item.bullets ?? []), ""] });
  }

  function removeBullet(key: string, index: number) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    updateItem(key, { bullets: (item.bullets ?? []).filter((_, i) => i !== index) });
  }

  const handleSubmit = () => {
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const cleanedItems = items.map(({ key: _key, ...rest }) => ({
        title: rest.title?.trim() || undefined,
        body: rest.body?.trim() || undefined,
        imageUrl: rest.imageUrl?.trim() || undefined,
        bullets: (rest.bullets ?? []).map((b) => b.trim()).filter(Boolean),
        linkHref: rest.linkHref?.trim() || undefined,
      }));

      const result = await savePropertyPageContentAction({
        propertyId,
        pageKey,
        sectionKey,
        items: cleanedItems,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }

      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <Card padding="loose" elevation="soft">
      <div className={h.formHead}>
        <h2 className={h.formTitle}>{sectionLabel}</h2>
      </div>

      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {savedAt && !error && (
        <Alert variant="success" title="Saved">
          Changes are live on the public page.
        </Alert>
      )}
      {helpText && <p className={h.groupDesc}>{helpText}</p>}

      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <div key={item.key} className="rounded-card border border-rule p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-micro uppercase tracking-label text-gray">Card {index + 1}</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => moveItem(item.key, -1)}>
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(item.key, 1)}
                >
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.key)}>
                  Remove
                </Button>
              </div>
            </div>

            {(showTitle || showLink) && (
              <div className={showTitle && showLink ? h.grid2 : undefined}>
                {showTitle && (
                  <label className={s.field}>
                    <span className={s.label}>Title</span>
                    <input
                      type="text"
                      value={item.title ?? ""}
                      onChange={(event) => updateItem(item.key, { title: event.target.value })}
                      className={s.input}
                    />
                  </label>
                )}
                {showLink && (
                  <label className={s.field}>
                    <span className={s.label}>Link{showTitle ? " (optional)" : ""}</span>
                    <input
                      type="text"
                      value={item.linkHref ?? ""}
                      onChange={(event) => updateItem(item.key, { linkHref: event.target.value })}
                      className={s.input}
                      placeholder="/horseshoe-bay/events"
                    />
                  </label>
                )}
              </div>
            )}

            {showBody && (
              <label className={s.field}>
                <span className={s.label}>Body</span>
                <textarea
                  value={item.body ?? ""}
                  onChange={(event) => updateItem(item.key, { body: event.target.value })}
                  className={s.textarea}
                  rows={3}
                />
              </label>
            )}

            {showImage && (
              <PropertyContentImageInput
                label="Image"
                value={item.imageUrl ?? ""}
                onChange={(url) => updateItem(item.key, { imageUrl: url })}
              />
            )}

            {showBullets && (
              <div className="mt-3 flex flex-col gap-2">
                <span className={s.label}>Bullet list (optional)</span>
                {(item.bullets ?? []).map((bullet, bulletIndex) => (
                  <div key={bulletIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bullet}
                      onChange={(event) => updateBullet(item.key, bulletIndex, event.target.value)}
                      className={s.input}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeBullet(item.key, bulletIndex)}>
                      ✕
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={() => addBullet(item.key)}>
                  Add bullet
                </Button>
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" disabled={itemsFull} onClick={addItem}>
          Add card
        </Button>
      </div>

      <div className={h.actions}>
        <Button type="button" variant="primary" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}

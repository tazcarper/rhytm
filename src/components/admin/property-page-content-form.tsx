"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { savePropertyPageContentAction } from "@/app/admin/properties/[slug]/content/actions";
import type { PropertyPageKey, PropertyContentItem } from "@/src/services/public/property-page-content";
import type { AdminPropertyPageSection } from "@/src/services/admin/property-page-content";
import type { SingleFieldKey, ItemFieldKey } from "@/src/constants/admin/property-page-sections";
import { ALL_SINGLE_FIELDS } from "@/src/constants/admin/property-page-sections";
import { PropertyContentImageInput } from "./property-content-image-input";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface EditableGalleryItem {
  key: string; // client-side stable key, not persisted
  imageUrl: string;
}

interface PropertyPageContentFormProps {
  propertyId: string;
  pageKey: PropertyPageKey;
  sectionKey: string;
  sectionLabel: string;
  helpText?: string;
  section: AdminPropertyPageSection | null;
  /** Which of heading/body/image/cta to show. Default: all four. */
  fields?: ReadonlyArray<SingleFieldKey>;
  /** Presence enables a small below-the-fold gallery editor ("hybrid" sections) — only "image" is meaningful here today. */
  itemFields?: ReadonlyArray<ItemFieldKey>;
  /** Cap on gallery cards, when itemFields is set. */
  maxItems?: number;
}

function toGalleryItems(items: PropertyContentItem[] | null): EditableGalleryItem[] {
  return (items ?? []).map((item) => ({ key: crypto.randomUUID(), imageUrl: item.imageUrl ?? "" }));
}

// Editor for a single-block section (heading, body, image, one CTA) —
// every section configured as kind:"single" in
// src/constants/admin/property-page-sections.ts uses this same form,
// parameterized by sectionKey/label/fields (only the fields the public page
// actually reads are shown). kind:"hybrid" sections (a heading/body pair
// plus a small photo gallery, e.g. Club Spotlight) also use this form, with
// itemFields/maxItems turning on the gallery block below — both halves save
// together in one upsert, since the underlying row is a single record.
// The public page falls back to its own hardcoded copy whenever a field
// here is left blank, so there's no "required" validation blocking save.
export function PropertyPageContentForm({
  propertyId,
  pageKey,
  sectionKey,
  sectionLabel,
  helpText,
  section,
  fields = ALL_SINGLE_FIELDS,
  itemFields,
  maxItems,
}: PropertyPageContentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [heading, setHeading] = useState(section?.heading ?? "");
  const [body, setBody] = useState(section?.body ?? "");
  const [imageUrl, setImageUrl] = useState(section?.imageUrl ?? "");
  const [ctaLabel, setCtaLabel] = useState(section?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(section?.ctaHref ?? "");
  const [galleryItems, setGalleryItems] = useState<EditableGalleryItem[]>(() =>
    toGalleryItems(section?.items ?? null),
  );

  const showGallery = itemFields !== undefined && itemFields.includes("image");
  const galleryFull = maxItems !== undefined && galleryItems.length >= maxItems;

  function addGalleryItem() {
    setGalleryItems([...galleryItems, { key: crypto.randomUUID(), imageUrl: "" }]);
  }

  function removeGalleryItem(key: string) {
    setGalleryItems(galleryItems.filter((item) => item.key !== key));
  }

  function updateGalleryItem(key: string, url: string) {
    setGalleryItems(galleryItems.map((item) => (item.key === key ? { ...item, imageUrl: url } : item)));
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await savePropertyPageContentAction({
        propertyId,
        pageKey,
        sectionKey,
        heading: heading.trim() || null,
        body: body.trim() || null,
        imageUrl: imageUrl.trim() || null,
        ctaLabel: ctaLabel.trim() || null,
        ctaHref: ctaHref.trim() || null,
        items: showGallery
          ? galleryItems.map(({ imageUrl: url }) => ({ imageUrl: url.trim() || undefined }))
          : undefined,
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
    <Card padding="default" elevation="soft">
      <div className={h.formHead}>
        <h2 className={h.formTitle}>{sectionLabel}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="error" title="Couldn't save">
            {error}
          </Alert>
        )}
        {savedAt && !error && (
          <Alert variant="success" title="Saved">
            Leave any field blank to keep the page's default copy.
          </Alert>
        )}

        <Group desc={helpText}>
          {fields.includes("heading") && (
            <label className={s.field}>
              <span className={s.label}>Heading</span>
              <input
                type="text"
                value={heading}
                onChange={(event) => setHeading(event.target.value)}
                className={s.input}
              />
            </label>
          )}
          {fields.includes("body") && (
            <label className={s.field}>
              <span className={s.label}>Body</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className={s.textarea}
                rows={5}
              />
            </label>
          )}
          {fields.includes("cta") && (
            <div className={h.grid2}>
              <label className={s.field}>
                <span className={s.label}>Button label</span>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  className={s.input}
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Button link</span>
                <input
                  type="text"
                  value={ctaHref}
                  onChange={(event) => setCtaHref(event.target.value)}
                  className={s.input}
                  placeholder="#inquiry"
                />
              </label>
            </div>
          )}
          {fields.includes("image") && (
            <PropertyContentImageInput label="Image" value={imageUrl} onChange={setImageUrl} />
          )}
        </Group>

        {showGallery && (
          <Group desc={`Up to ${maxItems ?? "a few"} photos, shown alongside the heading and body above.`}>
            <div className="flex flex-col gap-4">
              {galleryItems.map((item, index) => (
                <div key={item.key} className="rounded-card border border-rule p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-micro uppercase tracking-label text-gray">Photo {index + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeGalleryItem(item.key)}>
                      Remove
                    </Button>
                  </div>
                  <PropertyContentImageInput
                    value={item.imageUrl}
                    onChange={(url) => updateGalleryItem(item.key, url)}
                  />
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" disabled={galleryFull} onClick={addGalleryItem}>
                Add photo
              </Button>
            </div>
          </Group>
        )}

        <div className={h.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Group({ desc, children }: { desc?: string; children: ReactNode }) {
  return (
    <section className={h.group}>
      {desc && <p className={h.groupDesc}>{desc}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

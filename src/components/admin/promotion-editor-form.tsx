"use client";

import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  savePromotionAction,
  deletePromotionAction,
  uploadPromotionImageAction,
} from "@/app/admin/promotions/actions";
import type { AdminPromotionDetail } from "@/src/services/admin/promotions";
import type { PromotionPlacement } from "@/src/services/public/promotions";
import { MarkdownField } from "./markdown-field";
import { downscaleImage } from "./downscale-image";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

const IMAGE_MAX_EDGE = 2000;

const PLACEMENTS: ReadonlyArray<{ value: PromotionPlacement; label: string; hint: string }> = [
  { value: "homepage_band", label: "Homepage", hint: "The band on the main landing page" },
  { value: "property_page", label: "Property pages", hint: "Shown on a club's booking page" },
  { value: "adventures_page", label: "Adventures", hint: "The public adventures index" },
];

interface PropertyOption {
  id: string;
  name: string;
}

interface PromotionEditorFormProps {
  promotion: AdminPromotionDetail | null;
  properties: ReadonlyArray<PropertyOption>;
}

// Full editor for one promotion (create or edit). Client component: local
// field state, thin Server Actions for save / delete / image upload. Mirrors
// the homepage-hero form's structure and styling.
export function PromotionEditorForm({
  promotion,
  properties,
}: PromotionEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [title, setTitle] = useState(promotion?.title ?? "");
  const [eyebrow, setEyebrow] = useState(promotion?.eyebrow ?? "");
  const [body, setBody] = useState(promotion?.body ?? "");
  const [imageUrl, setImageUrl] = useState(promotion?.imageUrl ?? "");
  const [ctaLabel, setCtaLabel] = useState(promotion?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(promotion?.ctaHref ?? "");
  const [placements, setPlacements] = useState<Set<PromotionPlacement>>(
    new Set(promotion?.placements ?? []),
  );
  const [propertyIds, setPropertyIds] = useState<Set<string>>(
    new Set(promotion?.propertyIds ?? []),
  );
  const [status, setStatus] = useState<AdminPromotionDetail["status"]>(
    promotion?.status ?? "draft",
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(promotion?.endsAt));
  const [sortOrder, setSortOrder] = useState(String(promotion?.sortOrder ?? 0));

  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const allClubs = propertyIds.size === 0;

  function togglePlacement(value: PromotionPlacement) {
    setPlacements((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleProperty(id: string) {
    setPropertyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handlePickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    startUpload(async () => {
      const optimized = await downscaleImage(file, { maxEdge: IMAGE_MAX_EDGE });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadPromotionImageAction(formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setImageUrl(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await savePromotionAction({
        id: promotion?.id,
        title: title.trim(),
        eyebrow: eyebrow.trim() || null,
        body: body.trim() || null,
        imageUrl: imageUrl.trim() || null,
        ctaLabel: ctaLabel.trim() || null,
        ctaHref: ctaHref.trim() || null,
        placements: [...placements],
        propertyIds: [...propertyIds],
        status,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        sortOrder: Number(sortOrder) || 0,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }

      setSavedAt(Date.now());
      if (!promotion) {
        router.push(`/admin/promotions/${result.id}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!promotion) return;
    if (!confirm("Delete this promotion? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deletePromotionAction(promotion.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete.");
        return;
      }
      router.push("/admin/promotions");
    });
  };

  return (
    <Card padding="loose" elevation="soft">
      <div className={h.formHead}>
        <h2 className={h.formTitle}>
          {promotion ? "Edit promotion" : "New promotion"}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="error" title="Couldn't save">
            {error}
          </Alert>
        )}
        {savedAt && !error && (
          <Alert variant="success" title="Saved">
            The promotion has been saved.
          </Alert>
        )}

        <Group
          eyebrow="Content"
          desc="The words shown to guests. The title is required; the rest are optional. The body supports formatting (bold, links, lists)."
        >
          <label className={s.field}>
            <span className={s.label}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={s.input}
              required
              placeholder="Fall clays weekend"
            />
            <span className={s.help}>Used as the heading and in this list.</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>Eyebrow</span>
            <input
              type="text"
              value={eyebrow}
              onChange={(event) => setEyebrow(event.target.value)}
              className={s.input}
              placeholder="Limited time"
            />
            <span className={s.help}>Small label above the title.</span>
          </label>

          <div className={s.field}>
            <MarkdownField
              label="Body"
              value={body}
              onChange={setBody}
              height={180}
              hint="One or two short paragraphs. Keep it calm and confident — no urgency countdowns."
            />
          </div>
        </Group>

        <Group
          eyebrow="Button"
          desc="Optional call-to-action. Leave the label blank to hide the button. The link can be an in-app path like /adventures or a full web address."
        >
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Button label</span>
              <input
                type="text"
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
                className={s.input}
                placeholder="See the lineup"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Button link</span>
              <input
                type="text"
                value={ctaHref}
                onChange={(event) => setCtaHref(event.target.value)}
                className={s.input}
                placeholder="/adventures"
              />
            </label>
          </div>
        </Group>

        <Group
          eyebrow="Image"
          desc="Optional. Upload an image or paste a link; it shows beside the promotion text."
        >
          <div className={h.uploadRow}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={h.fileInputHidden}
              onChange={(event) => handlePickFile(event.target.files)}
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
                  ? "Replace image"
                  : "Upload image"}
            </Button>
            <span className={s.help}>JPEG, PNG, or WebP up to 10&nbsp;MB.</span>
          </div>
          {uploadError && <p className={h.uploadError}>{uploadError}</p>}
          <p className={h.orDivider}>or paste a link</p>
          <label className={s.field}>
            <span className={s.label}>Image link (URL)</span>
            <input
              type="text"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className={s.input}
              placeholder="https://…/promo.jpg"
            />
          </label>
          {imageUrl.trim() !== "" && (
            <div className={h.imagePreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl.trim()} alt="Promotion image preview" />
            </div>
          )}
        </Group>

        <Group
          eyebrow="Placement"
          desc="Which public pages this promotion appears on. Pick one or more."
        >
          <div className="flex flex-col gap-2">
            {PLACEMENTS.map((placement) => (
              <label key={placement.value} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={placements.has(placement.value)}
                  onChange={() => togglePlacement(placement.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-[14px] text-olive">
                    {placement.label}
                  </span>
                  <span className="block text-micro text-gray">
                    {placement.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Group>

        <Group
          eyebrow="Clubs"
          desc="Which clubs this promotion is for. Select none to show it for all three."
        >
          <div className="flex flex-col gap-2">
            <p className="text-micro text-gray">
              {allClubs
                ? "Showing for all clubs."
                : `Showing for ${propertyIds.size} selected ${
                    propertyIds.size === 1 ? "club" : "clubs"
                  }.`}
            </p>
            {properties.map((property) => (
              <label key={property.id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={propertyIds.has(property.id)}
                  onChange={() => toggleProperty(property.id)}
                />
                <span className="text-[14px] text-olive">{property.name}</span>
              </label>
            ))}
          </div>
        </Group>

        <Group
          eyebrow="Schedule & status"
          desc="Draft is hidden from the public. Published shows within the date window below (leave a date blank for open-ended). Archived retires it but keeps the content to run again."
        >
          <label className={s.field}>
            <span className={s.label}>Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AdminPromotionDetail["status"])
              }
              className={s.input}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className={s.input}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className={s.input}
              />
            </label>
          </div>
          <label className={s.field}>
            <span className={s.label}>Sort order</span>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className={s.input}
            />
            <span className={s.help}>
              Lower numbers show first when several are live in one place.
            </span>
          </label>
        </Group>

        <div className={h.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save promotion"}
          </Button>
          {promotion && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Group({
  eyebrow,
  desc,
  children,
}: {
  eyebrow: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className={h.group}>
      <p className={h.groupEyebrow}>{eyebrow}</p>
      <p className={h.groupDesc}>{desc}</p>
      {children}
    </section>
  );
}

// A stored timestamptz (ISO, UTC) → the value a <input type="datetime-local">
// expects (local wall-clock "YYYY-MM-DDTHH:mm"). Empty stays empty.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

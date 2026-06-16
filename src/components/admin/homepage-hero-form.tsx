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
  updateHomepageHeroAction,
  uploadHomepageHeroImageAction,
} from "@/app/admin/homepage/actions";
import type { HomepageHero } from "@/src/services/public/homepage-hero";
import { downscaleImage } from "./downscale-image";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

// The hero spans full-bleed, so it gets the most pixels. Uploads are
// downscaled + re-encoded to WebP in the browser before they leave the
// machine, so a straight-from-phone photo arrives web-ready at a predictable
// size. Tune in one place.
const HERO_MAX_EDGE = 2400;

interface HomepageHeroFormProps {
  hero: HomepageHero;
}

export function HomepageHeroForm({ hero }: HomepageHeroFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [eyebrow, setEyebrow] = useState(hero.eyebrow ?? "");
  const [title, setTitle] = useState(hero.title);
  const [lead, setLead] = useState(hero.lead ?? "");
  const [imageUrl, setImageUrl] = useState(hero.imageUrl ?? "");
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState(
    hero.primaryCtaLabel ?? "",
  );
  const [primaryCtaHref, setPrimaryCtaHref] = useState(
    hero.primaryCtaHref ?? "",
  );
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState(
    hero.secondaryCtaLabel ?? "",
  );
  const [secondaryCtaHref, setSecondaryCtaHref] = useState(
    hero.secondaryCtaHref ?? "",
  );

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
      const optimized = await downscaleImage(file, { maxEdge: HERO_MAX_EDGE });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadHomepageHeroImageAction(formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setImageUrl(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await updateHomepageHeroAction({
        eyebrow: eyebrow.trim() || null,
        title: title.trim(),
        lead: lead.trim() || null,
        imageUrl: imageUrl.trim() || null,
        primaryCtaLabel: primaryCtaLabel.trim() || null,
        primaryCtaHref: primaryCtaHref.trim() || null,
        secondaryCtaLabel: secondaryCtaLabel.trim() || null,
        secondaryCtaHref: secondaryCtaHref.trim() || null,
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
        <h2 className={h.formTitle}>Banner content</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="error" title="Couldn't save">
            {error}
          </Alert>
        )}
        {savedAt && !error && (
          <Alert variant="success" title="Saved">
            The homepage hero has been updated.
          </Alert>
        )}

        <Group
          eyebrow="Text"
          desc="The words at the top of the homepage. The headline is required; the rest are optional."
        >
          <label className={s.field}>
            <span className={s.label}>Eyebrow</span>
            <input
              type="text"
              value={eyebrow}
              onChange={(event) => setEyebrow(event.target.value)}
              className={s.input}
              placeholder="Est. 2026"
            />
            <span className={s.help}>Small label shown above the headline.</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>Headline</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={s.input}
              required
            />
            <span className={s.help}>The big title. Required.</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>Supporting text</span>
            <textarea
              value={lead}
              onChange={(event) => setLead(event.target.value)}
              className={s.textarea}
              rows={3}
            />
            <span className={s.help}>One or two sentences under the headline.</span>
          </label>
        </Group>

        <Group
          eyebrow="Buttons"
          desc="The two buttons under the text. Leave a label blank to hide that button. Links can be an in-app path like /book or a full web address."
        >
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Primary button label</span>
              <input
                type="text"
                value={primaryCtaLabel}
                onChange={(event) => setPrimaryCtaLabel(event.target.value)}
                className={s.input}
                placeholder="Plan your visit"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Primary button link</span>
              <input
                type="text"
                value={primaryCtaHref}
                onChange={(event) => setPrimaryCtaHref(event.target.value)}
                className={s.input}
                placeholder="/book"
              />
            </label>
          </div>
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Secondary button label</span>
              <input
                type="text"
                value={secondaryCtaLabel}
                onChange={(event) => setSecondaryCtaLabel(event.target.value)}
                className={s.input}
                placeholder="Members’ Entrance"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Secondary button link</span>
              <input
                type="text"
                value={secondaryCtaHref}
                onChange={(event) => setSecondaryCtaHref(event.target.value)}
                className={s.input}
                placeholder="/login"
              />
            </label>
          </div>
        </Group>

        <Group
          eyebrow="Background image"
          desc="Optional. Upload an image from your computer or paste a link to one, and it shows behind the hero text. Leave blank to keep the plain background."
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
            <span className={s.help}>
              JPEG, PNG, or WebP up to 10&nbsp;MB. Landscape works best (around
              2400&nbsp;×&nbsp;1400&nbsp;px); larger images are resized
              automatically.
            </span>
          </div>

          {uploadError && (
            <p className={h.uploadError}>{uploadError}</p>
          )}

          <p className={h.orDivider}>or paste a link</p>

          <label className={s.field}>
            <span className={s.label}>Image link (URL)</span>
            <input
              type="text"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className={s.input}
              placeholder="https://…/hero.jpg"
            />
            <span className={s.help}>Must start with http:// or https://</span>
          </label>
          {imageUrl.trim() !== "" && (
            <div className={h.imagePreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl.trim()} alt="Hero background preview" />
            </div>
          )}
        </Group>

        <div className={h.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
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

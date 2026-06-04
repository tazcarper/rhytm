"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAdventureImageAction } from "@/app/admin/adventures/actions";
import { downscaleImage } from "./downscale-image";

// Image upload widgets for the adventure editor. They downscale + re-encode
// the file to web-ready WebP in the browser (downscale-image.ts), upload it
// to the public `adventure-images` bucket via uploadAdventureImageAction,
// and hand the resulting public URL back to the form (which stores URLs in
// the `details` jsonb, unchanged downstream). A paste-URL fallback is kept
// so placeholder/stock URLs still work.

// Longest-edge caps by role. Hero spans full-bleed so it gets the most
// pixels; gallery/chapter render smaller. Tune here in one place.
const HERO_MAX_EDGE = 2400;
const GALLERY_MAX_EDGE = 2000;

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const uploadBtnCls =
  "self-start font-sans text-[12px] uppercase tracking-[0.5px] text-olive border border-rule rounded-pill px-4 py-1.5 hover:bg-cream disabled:opacity-40";
const removeBtnCls =
  "absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-olive text-cream text-[14px] leading-none shadow";

async function uploadOne(
  file: File,
  maxEdge: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const optimized = await downscaleImage(file, { maxEdge });
  const fd = new FormData();
  fd.append("file", optimized);
  return uploadAdventureImageAction(fd);
}

// ── Single image (hero / chapter) ───────────────────────────────────────
export function AdventureImageInput({
  label,
  value,
  onChange,
  hint,
  maxEdge = GALLERY_MAX_EDGE,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  maxEdge?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadOne(file, maxEdge);
      if (!result.ok) setError(result.error);
      else onChange(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelCls}>{label}</span>}
      <div className="flex gap-3 items-start">
        {value ? (
          <div className="relative shrink-0">
            {/* Editor preview; plain <img> by design. */}
            <img src={value} alt="" className="h-20 w-28 object-cover rounded border border-rule" />
            <button
              type="button"
              aria-label="Remove image"
              className={removeBtnCls}
              onClick={() => onChange("")}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="h-20 w-28 shrink-0 rounded border border-dashed border-rule grid place-items-center text-gray font-sans text-[11px]">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
          <button type="button" className={uploadBtnCls} disabled={isPending} onClick={() => fileRef.current?.click()}>
            {isPending ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          <input
            className={inputCls}
            value={value}
            placeholder="…or paste an image URL"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      {hint && <p className="font-serif italic text-[13px] text-gray m-0">{hint}</p>}
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
    </div>
  );
}

// ── Gallery (multiple images) ───────────────────────────────────────────
export function AdventureGalleryInput({
  label,
  items,
  setItems,
  hint,
}: {
  label: string;
  items: string[];
  setItems: (next: string[]) => void;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const chosen = Array.from(files);
    startTransition(async () => {
      const urls: string[] = [];
      let failure: string | null = null;
      for (const file of chosen) {
        const result = await uploadOne(file, GALLERY_MAX_EDGE);
        if (result.ok) urls.push(result.url);
        else failure = result.error;
      }
      if (urls.length) setItems([...items, ...urls]);
      if (failure) setError(failure);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelCls}>{label}</span>}
      {hint && <p className="font-serif italic text-[13px] text-gray m-0">{hint}</p>}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((url, i) => (
            <div key={i} className="relative">
              {/* Editor preview; plain <img> by design. */}
              <img src={url} alt="" className="h-24 w-full object-cover rounded border border-rule" />
              <button
                type="button"
                aria-label="Remove image"
                className={removeBtnCls}
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <button type="button" className={uploadBtnCls} disabled={isPending} onClick={() => fileRef.current?.click()}>
        {isPending ? "Uploading…" : "Upload images"}
      </button>
      <UrlAdder onAdd={(url) => setItems([...items, url])} />
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
    </div>
  );
}

// Small paste-a-URL row for the gallery (placeholder/stock URLs).
function UrlAdder({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const commit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setUrl("");
  };
  return (
    <div className="flex gap-2">
      <input
        className={inputCls}
        value={url}
        placeholder="…or paste an image URL"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        className="font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep whitespace-nowrap"
        onClick={commit}
      >
        Add
      </button>
    </div>
  );
}

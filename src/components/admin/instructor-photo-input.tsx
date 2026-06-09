"use client";

import { useRef, useState, useTransition } from "react";
import type { UploadPublicImageResult } from "@/src/services/admin/upload-public-image";
import { downscaleImage } from "./downscale-image";

// Single-photo upload for the instructor profile editor. Downscales +
// re-encodes the file to web-ready WebP in the browser (downscale-image.ts),
// uploads it to the public instructor-photos bucket via
// uploadInstructorPhotoAction, and hands the resulting public URL back to the
// form (stored on instructors.photo_url). A paste-URL fallback is kept so
// placeholder/stock URLs still work. Mirrors AdventureImageInput's single-image
// variant, scoped to the instructor upload target.

// Headshots render at modest sizes (cards + small detail); 1600px on the
// longest edge is plenty and keeps objects light.
const PHOTO_MAX_EDGE = 1600;

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const uploadBtnCls =
  "self-start font-sans text-[12px] uppercase tracking-[0.5px] text-olive border border-rule rounded-pill px-4 py-1.5 hover:bg-cream disabled:opacity-40";
const removeBtnCls =
  "absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-olive text-cream text-[14px] leading-none shadow";

export function InstructorPhotoInput({
  label,
  value,
  onChange,
  hint,
  uploadAction,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  // Injected so the same input serves the admin editor and the instructor's own
  // profile — each passes its appropriately-gated upload Server Action.
  uploadAction: (formData: FormData) => Promise<UploadPublicImageResult>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const optimized = await downscaleImage(file, { maxEdge: PHOTO_MAX_EDGE });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadAction(formData);
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
            <img
              src={value}
              alt=""
              className="h-24 w-24 object-cover rounded-full border border-rule"
            />
            <button
              type="button"
              aria-label="Remove photo"
              className={removeBtnCls}
              onClick={() => onChange("")}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-full border border-dashed border-rule grid place-items-center text-gray font-sans text-[11px]">
            No photo
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => pick(event.target.files)}
          />
          <button
            type="button"
            className={uploadBtnCls}
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
          >
            {isPending ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </button>
          <input
            className={inputCls}
            value={value}
            placeholder="…or paste a photo URL"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      {hint && <p className="font-serif italic text-[13px] text-gray m-0">{hint}</p>}
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
    </div>
  );
}

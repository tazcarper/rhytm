"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEventImageAction } from "@/app/admin/events/actions";
import { cropImageToAspectRatio } from "./crop-image-to-aspect-ratio";
import { downscaleImage } from "./downscale-image";

// Event hero image upload. Crops to 16:9 (the calendar thumbnail and event
// hero both expect that ratio) then downscales/re-encodes, same two-step
// pipeline as crop-image-to-aspect-ratio.ts documents, uploads to the public
// `event-images` bucket via uploadEventImageAction, and hands the resulting
// public URL back to the form. A paste-URL fallback is kept, same precedent
// as AdventureImageInput / InstructorPhotoInput.

const EVENT_IMAGE_RATIO = 16 / 9;
const EVENT_IMAGE_MAX_EDGE = 1600;

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const uploadBtnCls =
  "self-start font-sans text-[12px] uppercase tracking-[0.5px] text-olive border border-rule rounded-pill px-4 py-1.5 hover:bg-cream disabled:opacity-40";
const removeBtnCls =
  "absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-olive text-cream text-[14px] leading-none shadow";

export function EventImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setStatus("Cropping to 16:9…");
    startTransition(async () => {
      const cropped = await cropImageToAspectRatio(file, EVENT_IMAGE_RATIO);
      setStatus("Uploading…");
      const optimized = await downscaleImage(cropped, { maxEdge: EVENT_IMAGE_MAX_EDGE });
      const formData = new FormData();
      formData.append("file", optimized);
      const result = await uploadEventImageAction(formData);
      if (!result.ok) {
        setError(result.error);
        setStatus(null);
        return;
      }
      onChange(result.url);
      setStatus(`Uploaded · ${file.name} · auto-cropped 16:9`);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>Event image (16:9)</span>
      <div className="flex gap-3 items-start">
        {value ? (
          <div className="relative shrink-0">
            {/* Editor preview; plain <img> by design. */}
            <img
              src={value}
              alt=""
              className="aspect-video h-24 w-auto object-cover rounded border border-rule"
            />
            <button
              type="button"
              aria-label="Remove image"
              className={removeBtnCls}
              onClick={() => {
                onChange("");
                setStatus(null);
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="aspect-video h-24 w-auto shrink-0 rounded border border-dashed border-rule grid place-items-center text-gray font-sans text-[11px]">
            No image
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
            {isPending ? "Working…" : value ? "Replace image" : "Upload image"}
          </button>
          <input
            className={inputCls}
            value={value}
            placeholder="…or paste an image URL"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      <p className="font-serif italic text-[13px] text-gray m-0">
        Upload an image and it auto-crops to 16:9 — becomes both the calendar
        thumbnail and the event hero.
      </p>
      {status && !error && <p className="font-sans text-[13px] text-gray m-0">{status}</p>}
      {error && <p className="font-sans text-[13px] text-[color:var(--error)] m-0">{error}</p>}
    </div>
  );
}

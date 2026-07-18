"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPropertyContentImageAction } from "@/app/admin/properties/[id]/content/actions";
import { downscaleImage } from "./downscale-image";

// Single-image upload widget for property_page_content editors (marketing
// page cards, intro/hero images, gallery tiles). Same shape as
// AdventureImageInput: downscale + re-encode in the browser, upload via a
// Server Action to a public bucket, hand back the resulting URL. A
// paste-URL fallback is kept alongside the upload button.

const MAX_EDGE = 2200;

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const uploadBtnCls =
  "self-start font-sans text-[12px] uppercase tracking-[0.5px] text-olive border border-rule rounded-pill px-4 py-1.5 hover:bg-cream disabled:opacity-40";
const removeBtnCls =
  "absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-olive text-cream text-[14px] leading-none shadow";

export function PropertyContentImageInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const optimized = await downscaleImage(file, { maxEdge: MAX_EDGE });
      const fd = new FormData();
      fd.append("file", optimized);
      const result = await uploadPropertyContentImageAction(fd);
      if (!result.ok) setError(result.error);
      else onChange(result.url);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelCls}>{label}</span>}
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative shrink-0">
            {/* Editor preview; plain <img> by design. */}
            <img src={value} alt="" className="h-20 w-28 rounded border border-rule object-cover" />
            <button type="button" aria-label="Remove image" className={removeBtnCls} onClick={() => onChange("")}>
              ×
            </button>
          </div>
        ) : (
          <div className="grid h-20 w-28 shrink-0 place-items-center rounded border border-dashed border-rule font-sans text-[11px] text-gray">
            No image
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
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
      {error && <p className="m-0 font-sans text-[13px] text-[color:var(--error)]">{error}</p>}
    </div>
  );
}

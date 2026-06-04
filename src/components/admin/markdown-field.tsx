"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

// Markdown editor field for the admin (@uiw/react-md-editor). Toolbar
// (bold/italic/lists/links/…) over a markdown textarea — stores plain
// markdown, which the public surfaces render via MarkdownProse. Loaded
// client-only (ssr: false) since the editor touches browser APIs; allowed
// here because this is a Client Component.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";

export function MarkdownField({
  label,
  value,
  onChange,
  height = 200,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  height?: number;
  hint?: string;
}) {
  return (
    <div>
      {label && <span className={labelCls}>{label}</span>}
      <div data-color-mode="light">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={height}
          preview="edit"
        />
      </div>
      {hint && (
        <span className="block font-serif italic text-[13px] text-gray mt-1">{hint}</span>
      )}
    </div>
  );
}

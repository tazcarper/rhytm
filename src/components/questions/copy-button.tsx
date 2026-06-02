"use client";

import { useState } from "react";
import s from "./copy-button.module.css";

// Copies rendered question content to the clipboard as both rich HTML and
// plain text, so a paste into Word keeps headings, bold, and lists intact
// (with a graceful plain-text fallback for older browsers).
//
// The content lives in server-rendered DOM; this client component only
// reaches for it at click time — by element id (one question) or by CSS
// selector (every question on the page).

interface CopyButtonProps {
  /** Copy a single element with this id. */
  targetId?: string;
  /** Copy every element matching this selector (used for "copy all"). */
  selector?: string;
  label?: string;
  copiedLabel?: string;
}

const SEPARATOR_HTML = '\n<hr />\n';
const SEPARATOR_TEXT = "\n\n———\n\n";

export function CopyButton({
  targetId,
  selector,
  label = "Copy",
  copiedLabel = "Copied ✓",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const nodes: HTMLElement[] = [];
    if (targetId) {
      const found = document.getElementById(targetId);
      if (found) nodes.push(found);
    } else if (selector) {
      document
        .querySelectorAll<HTMLElement>(selector)
        .forEach((element) => nodes.push(element));
    }
    if (nodes.length === 0) return;

    const html = nodes.map((element) => element.innerHTML).join(SEPARATOR_HTML);
    const text = nodes
      .map((element) => element.innerText)
      .join(SEPARATOR_TEXT);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={s.button}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

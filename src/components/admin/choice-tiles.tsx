"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

// A set of cards that work like radio buttons: one choice per set, arrow
// keys move between them, and the browser handles focus. Used on the New
// event screen for the club, the kind of event and the optional starter.
//
// Card layout (Taz's reference, 2026-11-04): a media area on top, then the
// title, a short description, a
// divider and a full-width button. The media is the tile's image at full
// width when it has one (a club's logo), otherwise its icon, centred in a
// strong contrasting badge.

export interface ChoiceTile<T extends string> {
  value: T;
  label: string;
  // Full-width image for the top of the card (e.g. a club's logo).
  imageUrl?: string | null;
  // Shown centred when there's no image.
  icon?: ReactNode;
  // Small grey line under the label, after `examplePrefix`.
  example?: string;
  // Colour behind the icon (e.g. a club's brand colour). Defaults to the
  // event pages' green.
  accent?: string;
}

const DEFAULT_ACCENT = "#1f5b45";

export function ChoiceTiles<T extends string>({
  legend,
  description,
  tiles,
  value,
  onChange,
  columns = 3,
  allowClear = false,
  examplePrefix = "Like: ",
}: {
  legend: string;
  description?: string;
  tiles: ReadonlyArray<ChoiceTile<T>>;
  value: T | "";
  onChange: (value: T | "") => void;
  columns?: 2 | 3;
  // Clicking the chosen card again clears it (for optional choices).
  allowClear?: boolean;
  // Text before each example; "" shows the example on its own.
  examplePrefix?: string;
}) {
  const name = useId();
  const grid = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 text-[19px] font-bold text-[#1c2420]">{legend}</legend>
      {description && <p className="m-0 -mt-1 text-[17px] text-[#4a5650]">{description}</p>}
      <div className={`grid grid-cols-1 gap-4 ${grid}`}>
        {tiles.map((tile) => {
          const checked = tile.value === value;
          const accent = tile.accent ?? DEFAULT_ACCENT;
          return (
            <label
              key={tile.value}
              className={`flex cursor-pointer flex-col overflow-hidden rounded-[16px] border-2 bg-white transition-[border-color,box-shadow] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgba(31,91,69,0.35)] ${
                checked
                  ? "border-[#1f5b45] shadow-[0_4px_16px_rgba(31,91,69,0.16)]"
                  : "border-[#d6ddd5] hover:border-[#8f9c94] hover:shadow-[0_2px_10px_rgba(28,36,32,0.08)]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={tile.value}
                checked={checked}
                onChange={() => onChange(tile.value)}
                onClick={() => {
                  if (allowClear && checked) onChange("");
                }}
                className="sr-only"
              />

              {tile.imageUrl ? (
                <span className="flex aspect-[16/7] items-center justify-center border-b border-[#e6ebe5] bg-[#f6f8f5] px-6 py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logos of any size and type */}
                  <img src={tile.imageUrl} alt="" className="h-full w-full object-contain" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex aspect-[16/7] items-center justify-center border-b border-[#e6ebe5]"
                  style={{ background: `color-mix(in srgb, ${accent} 10%, white)` }}
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(28,36,32,0.18)]"
                    style={{ background: accent }}
                  >
                    {tile.icon}
                  </span>
                </span>
              )}

              <span className="flex flex-1 flex-col gap-1.5 px-5 pb-4 pt-4">
                <span className="text-[19px] font-bold leading-tight text-[#1c2420]">{tile.label}</span>
                {tile.example && (
                  <span className="text-[15px] leading-snug text-[#5d6963]">
                    {examplePrefix && <span className="font-semibold">{examplePrefix}</span>}
                    {tile.example}
                  </span>
                )}
              </span>

              <span className="border-t border-[#e6ebe5] px-4 py-3">
                <span
                  aria-hidden="true"
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] text-[17px] font-semibold ${
                    checked ? "bg-[#1f5b45] text-white" : "bg-[#eef1ec] text-[#1c2420]"
                  }`}
                >
                  {checked && <Check size={18} strokeWidth={3} />}
                  {checked ? "Selected" : "Choose"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

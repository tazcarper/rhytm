"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

// A set of cards that work like radio buttons: one choice per set, arrow
// keys move between them, and the browser handles focus. Used on the New
// event screen for the club, the kind of event and the optional starter.
//
// Two looks (Taz's references, 2026-11-04):
//   - with an image (a club's logo): a card with the image full width on
//     top, the title and example, and a full-width Choose button
//   - with an icon: a soft grey block with the icon in its own colour on a
//     white circle, and a centred title and example; the block is the button

export interface ChoiceTile<T extends string> {
  value: T;
  label: string;
  // Full-width image for the top of the card (e.g. a club's logo).
  imageUrl?: string | null;
  // Shown centred when there's no image.
  icon?: ReactNode;
  // Small grey line under the label, after `examplePrefix`.
  example?: string;
  // The icon's colour. Defaults to the event pages' green.
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
  // Two across on phones, three from tablet width up (Taz, 2026-11-04).
  const grid = columns === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3";

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 text-[19px] font-bold text-[#1c2420]">{legend}</legend>
      {description && <p className="m-0 -mt-1 text-[17px] text-[#4a5650]">{description}</p>}
      <div className={`grid gap-3 sm:gap-4 ${grid}`}>
        {tiles.map((tile) => {
          const checked = tile.value === value;
          const accent = tile.accent ?? DEFAULT_ACCENT;
          const example = tile.example && (
            <span className="text-[14px] leading-snug text-[#5d6963] sm:text-[15px]">
              {examplePrefix && <span className="font-semibold">{examplePrefix}</span>}
              {tile.example}
            </span>
          );

          if (tile.imageUrl) {
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
                <span className="flex aspect-[16/7] items-center justify-center border-b border-[#e6ebe5] bg-[#f6f8f5] px-3 py-3 sm:px-6 sm:py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logos of any size and type */}
                  <img src={tile.imageUrl} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
                  <span className="text-[17px] font-bold sm:text-[19px] leading-tight text-[#1c2420]">{tile.label}</span>
                  {example}
                </span>
                <span className="border-t border-[#e6ebe5] px-3 py-3 sm:px-4">
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
          }

          // Icon card: soft grey block, the icon in its own colour on a white
          // circle, centred title and example. The whole card is the button.
          return (
            <label
              key={tile.value}
              className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-[20px] border-2 px-3 pb-5 pt-6 text-center sm:px-6 sm:pb-7 sm:pt-8 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgba(31,91,69,0.35)] ${
                checked
                  ? "border-[#1f5b45] bg-[#eaf3ed]"
                  : "border-transparent bg-[#f3f4f2] hover:bg-[#ebedea]"
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
              {checked && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#1f5b45] text-white"
                >
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white sm:h-16 sm:w-16 shadow-[0_1px_4px_rgba(28,36,32,0.08)]"
                style={{ color: accent }}
              >
                {tile.icon}
              </span>
              <span className="mt-1 text-[17px] font-bold leading-tight text-[#1c2420] sm:mt-2 sm:text-[20px]">{tile.label}</span>
              {example}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

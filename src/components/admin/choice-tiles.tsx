"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

// A set of cards that work like radio buttons: one choice per set, arrow
// keys move between them, and the browser handles focus. Used on the New
// event screen for the club, the kind of event and the optional starter.
//
// Two looks (Taz's references, 2026-11-04):
//   - with an image (a club's logo): just the logo, filling the card; the
//     label is the image's alt text. Selected shows an olive border and check
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
  // The icon's colour (or, on a club card with no logo, the badge colour).
  // Defaults to the brand olive.
  accent?: string;
}

const DEFAULT_ACCENT = "var(--olive)";

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
      <legend className="mb-1 p-0 text-[19px] font-bold text-olive-darker">{legend}</legend>
      {description && <p className="m-0 -mt-1 text-[17px] text-gray">{description}</p>}
      <div className={`grid gap-3 sm:gap-4 ${grid}`}>
        {tiles.map((tile) => {
          const checked = tile.value === value;
          // Once something is picked, the others fade back a little (still
          // readable, and full strength again on hover or focus).
          const dim = value !== "" && !checked ? "opacity-55 scale-[0.98] hover:opacity-100 hover:scale-100 has-[:focus-visible]:opacity-100" : "";
          const accent = tile.accent ?? DEFAULT_ACCENT;
          const example = tile.example && (
            <span className="text-[14px] leading-snug text-gray sm:text-[15px]">
              {examplePrefix && <span className="font-semibold">{examplePrefix}</span>}
              {tile.example}
            </span>
          );

          if (tile.imageUrl) {
            return (
              <label
                key={tile.value}
                className={`relative flex aspect-[16/9] cursor-pointer items-center justify-center rounded-[16px] border-2 bg-white px-5 py-6 transition-[border-color,box-shadow,opacity,transform] duration-200 ${dim} sm:px-8 sm:py-8 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgba(63,74,33,0.35)] ${
                  checked
                    ? "border-olive shadow-[0_4px_16px_rgba(63,74,33,0.16)]"
                    : "border-rule-strong hover:border-tan hover:shadow-[0_2px_10px_rgba(31,38,17,0.08)]"
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
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-olive text-white"
                  >
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logos of any size and type */}
                <img src={tile.imageUrl} alt={tile.label} className="h-full w-full object-contain" />
              </label>
            );
          }

          // Icon card: soft grey block, the icon in its own colour on a white
          // circle, centred title and example. The whole card is the button.
          return (
            <label
              key={tile.value}
              className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-[20px] border-2 px-3 pb-5 pt-6 text-center sm:px-6 sm:pb-7 sm:pt-8 transition-[background-color,border-color,opacity,transform] duration-200 ${dim} has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgba(63,74,33,0.35)] ${
                checked
                  ? "border-olive bg-cream"
                  : "border-transparent bg-paper-warm hover:bg-cream"
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
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-olive text-white"
                >
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white sm:h-16 sm:w-16 shadow-[0_1px_4px_rgba(31,38,17,0.08)]"
                style={{ color: accent }}
              >
                {tile.icon}
              </span>
              <span className="mt-1 text-[17px] font-bold leading-tight text-olive-darker sm:mt-2 sm:text-[20px]">{tile.label}</span>
              {example}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

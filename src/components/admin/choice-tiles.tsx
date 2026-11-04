"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

// A set of large square tiles that work like radio buttons: one choice per
// set, keyboard arrows move between them, and the browser handles focus.
// Used on the New event screen for the club, the kind of event and the
// optional starter. Each tile can carry an icon and an example line.

export interface ChoiceTile<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
  // Small grey line under the label, after `examplePrefix`.
  example?: string;
  // Optional colour for the icon badge (e.g. a club's brand colour).
  accent?: string;
}

export function ChoiceTiles<T extends string>({
  legend,
  description,
  tiles,
  value,
  onChange,
  columns = 3,
  allowClear = false,
  required = false,
  examplePrefix = "Like: ",
}: {
  legend: string;
  description?: string;
  tiles: ReadonlyArray<ChoiceTile<T>>;
  value: T | "";
  onChange: (value: T | "") => void;
  columns?: 2 | 3;
  // Clicking the chosen tile again clears it (for optional choices).
  allowClear?: boolean;
  required?: boolean;
  // Text before each example; "" shows the example on its own (a club's tagline).
  examplePrefix?: string;
}) {
  const name = useId();
  const grid = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 text-[19px] font-bold text-[#1c2420]">{legend}</legend>
      {description && <p className="m-0 -mt-1 text-[17px] text-[#4a5650]">{description}</p>}
      <div className={`grid grid-cols-1 gap-3 ${grid}`}>
        {tiles.map((tile) => {
          const checked = tile.value === value;
          return (
            <label
              key={tile.value}
              className={`relative flex min-h-[132px] cursor-pointer flex-col gap-3 rounded-[14px] border-2 p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgba(31,91,69,0.35)] ${
                checked
                  ? "border-[#1f5b45] bg-[#f1f7f3] shadow-[0_2px_10px_rgba(31,91,69,0.12)]"
                  : "border-[#d6ddd5] bg-white hover:border-[#8f9c94]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={tile.value}
                checked={checked}
                required={required}
                onChange={() => onChange(tile.value)}
                onClick={() => {
                  if (allowClear && checked) onChange("");
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-[12px] text-white"
                style={{ background: tile.accent ?? (checked ? "#1f5b45" : "#4a5650") }}
              >
                {tile.icon}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[19px] font-bold leading-tight text-[#1c2420]">{tile.label}</span>
                {tile.example && (
                  <span className="text-[15px] leading-snug text-[#5d6963]">
                    {examplePrefix && <span className="font-semibold">{examplePrefix}</span>}
                    {tile.example}
                  </span>
                )}
              </span>
              {checked && (
                <span
                  aria-hidden="true"
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#1f5b45] text-white"
                >
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

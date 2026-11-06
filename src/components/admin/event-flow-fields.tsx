"use client";

import type { ReactNode } from "react";
import s from "./event-flow.module.css";

// Sized fields for the event builder. Each box is as wide as the answer it
// expects, so short numbers sit side by side instead of filling the card.

interface SizedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SizedField({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return (
    <label className={`${s.field} ${s.fit}`}>
      <span className={s.label}>{label}</span>
      <span className={width}>{children}</span>
    </label>
  );
}

export function CountField({ label, value, onChange, min = 1 }: SizedFieldProps & { min?: number }) {
  return (
    <SizedField label={label} width={s.wCount}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(evt) => onChange(evt.target.value)}
        className={s.input}
      />
    </SizedField>
  );
}

export function MoneyField({ label, value, onChange, placeholder }: SizedFieldProps) {
  return (
    <SizedField label={label} width={`${s.wMoney} ${s.money}`}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={(evt) => onChange(evt.target.value)}
        className={s.input}
        placeholder={placeholder}
      />
    </SizedField>
  );
}

export function DateField({ label, value, onChange }: SizedFieldProps) {
  return (
    <SizedField label={label} width={s.wDate}>
      <input type="date" value={value} onChange={(evt) => onChange(evt.target.value)} className={s.input} />
    </SizedField>
  );
}

// A small set of choices shown side by side, so staff see them all at once.
export function SegmentedChoice<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={`${s.field} m-0 border-0 p-0`}>
      <legend className={`${s.label} mb-2 p-0`}>{label}</legend>
      <div className={s.segmented}>
        {options.map((option) => (
          <label key={option.value} className={s.segment}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

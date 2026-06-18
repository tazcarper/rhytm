"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import s from "./qty-stepper.module.css";

interface QtyStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  /** Used to build aria-labels on the −/+ buttons (e.g. "Decrease guest count"). */
  label: string;
  /** "sm" is compact for inline list rows; "md" (default) ~= the original pill;
   *  "lg" is 25% larger for hero-row use. */
  size?: "sm" | "md" | "lg";
}

export function QtyStepper({
  value,
  min = 1,
  max = 20,
  onChange,
  label,
  size = "md",
}: QtyStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    const parsed = parseInt(draft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      if (clamped !== value) onChange(clamped);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(String(value));
    setEditing(false);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/[^0-9]/g, "");
    setDraft(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <div
      className={`${s.qty} ${
        size === "lg" ? s.qtyLg : size === "sm" ? s.qtySm : ""
      }`.trim()}
    >
      <button
        type="button"
        className={s.qtyBtn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min || editing}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={s.qtyInput}
          value={draft}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label={`${label} (editable)`}
        />
      ) : (
        <button
          type="button"
          className={s.qtyValue}
          onClick={startEditing}
          aria-label={`Edit ${label}, currently ${value}`}
        >
          {value}
        </button>
      )}
      <button
        type="button"
        className={s.qtyBtn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max || editing}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

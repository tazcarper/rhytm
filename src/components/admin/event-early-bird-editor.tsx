"use client";

import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

// The early-bird tier of an event's pricing: a cut-off date/time and the
// cheaper price(s) that apply to sign-ups before it. The regular member /
// non-member prices above it in the editor are what applies afterwards.
// Purely presentational — the parent form owns the state and the save.

export interface EarlyBirdFields {
  enabled: boolean;
  // datetime-local wall clock ("2026-11-01T00:00"), club time
  endsAt: string;
  memberPrice: string;
  nonMemberPrice: string;
}

interface EventEarlyBirdEditorProps {
  value: EarlyBirdFields;
  onChange: (next: EarlyBirdFields) => void;
}

export function EventEarlyBirdEditor({ value, onChange }: EventEarlyBirdEditorProps) {
  const update = (patch: Partial<EarlyBirdFields>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={value.enabled} onChange={(evt) => update({ enabled: evt.target.checked })} />
        <span className="text-[14px] text-olive">
          Early-bird price (a lower price for guests who sign up before a date)
        </span>
      </label>
      {value.enabled && (
        <>
          <label className={s.field}>
            <span className={s.label}>Early-bird price ends</span>
            <input
              type="datetime-local"
              value={value.endsAt}
              onChange={(evt) => update({ endsAt: evt.target.value })}
              className={s.input}
              required
            />
            <span className="text-[13px] text-olive">
              Sign-ups before this moment get the early-bird price. For &ldquo;before Nov 1&rdquo;, pick Nov 1 at
              12:00 AM. After it, the regular prices above apply.
            </span>
          </label>
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Early-bird member price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={value.memberPrice}
                onChange={(evt) => update({ memberPrice: evt.target.value })}
                className={s.input}
                placeholder="Blank = regular member price"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Early-bird non-member price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={value.nonMemberPrice}
                onChange={(evt) => update({ nonMemberPrice: evt.target.value })}
                className={s.input}
                placeholder="Blank = regular non-member price"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

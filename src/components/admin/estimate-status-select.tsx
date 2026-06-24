"use client";

import { useState, useTransition } from "react";
import { updateEstimateStatusAction } from "@/app/admin/estimates/actions";
import {
  ESTIMATE_STATUSES,
  ESTIMATE_STATUS_LABELS,
  type EstimateStatus,
} from "@/src/services/estimates/admin-estimates";
import s from "@/src/components/admin/queue-list.module.css";

interface EstimateStatusSelectProps {
  id: string;
  status: EstimateStatus;
}

// Inline status dropdown on the estimate detail page. v1 of the queue is
// read + this single mutation; "convert to bid" lands in a later PR.
export function EstimateStatusSelect({ id, status }: EstimateStatusSelectProps) {
  const [current, setCurrent] = useState<EstimateStatus>(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: EstimateStatus) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const res = await updateEstimateStatusAction(id, next);
      if (!res.ok) {
        setCurrent(previous);
        setError(res.error);
      }
    });
  }

  return (
    <div className={s.field}>
      <label className={s.fieldLabel} htmlFor="estimate-status">
        Status
      </label>
      <select
        id="estimate-status"
        className={s.select}
        value={current}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as EstimateStatus)}
      >
        {ESTIMATE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {ESTIMATE_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ color: "var(--accent-error)", fontSize: "var(--text-micro)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

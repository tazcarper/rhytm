"use client";

import { useState } from "react";
import { FormField, Input } from "@/lib/ui";
import s from "./dev.module.css";

type Property = { name: string };

type Membership = {
  id: string;
  member_number: string;
  property_id: string;
  properties: Property | Property[] | null;
};

// Filters by case-insensitive substring on member_number. Typing the
// full number (e.g. "HH-100") narrows to the 1–3 memberships sharing
// that number across properties. Typing nothing shows nothing — keeps
// the form short and forces the dev to know what they're targeting.
export function MembershipPicker({
  memberships,
}: {
  memberships: Membership[];
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? memberships.filter((m) =>
        m.member_number.toLowerCase().includes(trimmed),
      )
    : [];

  return (
    <>
      <FormField
        label="Member number"
        error={
          trimmed && matches.length === 0
            ? "No memberships match. Check the Recent table below for what exists."
            : undefined
        }
      >
        {(p) => (
          <Input
            {...p}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. HH-100"
            autoComplete="off"
          />
        )}
      </FormField>

      {matches.length > 0 && (
        <fieldset className={s.fieldset}>
          <legend>Add to membership</legend>
          {matches.map((m) => {
            const property = Array.isArray(m.properties)
              ? m.properties[0]
              : m.properties;
            return (
              <label key={m.id} className={s.checkRow}>
                <input
                  type="radio"
                  name="membership_id"
                  value={m.id}
                  required
                />
                {property?.name ?? "—"} ·{" "}
                <code className={s.code}>#{m.member_number}</code>
              </label>
            );
          })}
        </fieldset>
      )}
    </>
  );
}

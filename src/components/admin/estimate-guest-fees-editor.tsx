"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { saveEstimateGuestFeesAction } from "@/app/admin/properties/[id]/catalog/actions";
import type { EstimateGuestFeeBand } from "@/src/services/admin/estimate-guest-fees";
import s from "./catalog.module.css";

interface BandDraft {
  minGuests: string;
  maxGuests: string;
  adult: string;
  junior: string;
}

interface EstimateGuestFeesEditorProps {
  propertyId: string;
  propertySlug: string;
  bands: ReadonlyArray<EstimateGuestFeeBand>;
}

function toDraft(band: EstimateGuestFeeBand): BandDraft {
  return {
    minGuests: String(band.minGuests),
    maxGuests: String(band.maxGuests),
    adult: String(band.adult),
    junior: band.junior === null ? "" : String(band.junior),
  };
}

export function EstimateGuestFeesEditor({
  propertyId,
  propertySlug,
  bands,
}: EstimateGuestFeesEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<BandDraft[]>(() =>
    bands.length > 0 ? bands.map(toDraft) : [],
  );

  const update = (index: number, patch: Partial<BandDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const addBand = () => {
    const last = drafts[drafts.length - 1];
    const nextMin = last ? String((Number(last.maxGuests) || 0) + 1) : "1";
    setDrafts((prev) => [
      ...prev,
      { minGuests: nextMin, maxGuests: "", adult: "", junior: "" },
    ]);
  };
  const removeBand = (index: number) =>
    setDrafts((prev) => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    setError(null);
    setSavedAt(null);
    const payload = drafts.map((d) => ({
      minGuests: d.minGuests,
      maxGuests: d.maxGuests,
      adult: d.adult,
      junior: d.junior.trim() === "" ? null : d.junior,
    }));
    startTransition(async () => {
      const result = await saveEstimateGuestFeesAction(
        { propertyId, propertySlug },
        { propertyId, bands: payload },
      );
      if (!result.ok) {
        setError(result.error ?? "Couldn't save.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <Card padding="loose" elevation="soft" className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <h2 className={s.panelTitle}>Guest-fee schedule</h2>
          <p className={s.panelSubtitle}>
            Tiered per-guest fee for guest-fee experiences on the estimate.
            Bands by guest count (members excluded).
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={addBand} type="button">
          + Add band
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {savedAt && !error && (
        <Alert variant="success" title="Saved">
          Guest-fee schedule updated.
        </Alert>
      )}

      <div className={s.list}>
        {drafts.length === 0 && (
          <p className={s.empty}>
            No guest-fee schedule yet. Add a band — e.g. 1–4 guests at $85 adult
            / $55 junior.
          </p>
        )}
        {drafts.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
              gap: "var(--space-2)",
              alignItems: "end",
            }}
          >
            <span className={s.fieldLabel}>Min guests</span>
            <span className={s.fieldLabel}>Max guests</span>
            <span className={s.fieldLabel}>Adult $</span>
            <span className={s.fieldLabel}>Junior $</span>
            <span />
            {drafts.map((d, i) => (
              <BandFields
                key={i}
                draft={d}
                onChange={(patch) => update(i, patch)}
                onRemove={() => removeBand(i)}
              />
            ))}
          </div>
        )}
      </div>

      <p className={s.help} style={{ marginTop: "var(--space-2)" }}>
        Leave Junior blank to charge juniors the adult rate. Bands should cover
        contiguous guest counts; the top band catches anything larger.
      </p>

      <div className={s.addFormActions} style={{ marginTop: "var(--space-3)" }}>
        <Button variant="primary" onClick={handleSave} loading={isPending} disabled={isPending}>
          {isPending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </Card>
  );
}

interface BandFieldsProps {
  draft: BandDraft;
  onChange: (patch: Partial<BandDraft>) => void;
  onRemove: () => void;
}

function BandFields({ draft, onChange, onRemove }: BandFieldsProps) {
  return (
    <>
      <input
        className={s.input}
        type="number"
        min="1"
        step="1"
        value={draft.minGuests}
        onChange={(e) => onChange({ minGuests: e.target.value })}
      />
      <input
        className={s.input}
        type="number"
        min="1"
        step="1"
        value={draft.maxGuests}
        onChange={(e) => onChange({ maxGuests: e.target.value })}
      />
      <input
        className={s.input}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={draft.adult}
        onChange={(e) => onChange({ adult: e.target.value })}
      />
      <input
        className={s.input}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={draft.junior}
        onChange={(e) => onChange({ junior: e.target.value })}
        placeholder="(adult)"
      />
      <Button variant="secondary" size="sm" type="button" onClick={onRemove}>
        Remove
      </Button>
    </>
  );
}

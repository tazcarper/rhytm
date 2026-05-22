"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/lib/ui";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { ActiveBookingRef } from "@/src/services/admin/catalog";
import { BookingStatusBadge } from "./booking-status-badge";
import s from "./catalog.module.css";

interface DeleteCatalogItemConfirmProps {
  /** Friendly singular noun ("service" / "add-on") used in copy. */
  noun: string;
  itemName: string;
  /** Fetches every booking that ever referenced the item, regardless of status. */
  loadRefs: () => Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }>;
  /** Called when admin confirms hard delete (only enabled when refs is empty). */
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  /** Optional fallback action when delete is blocked by historical refs. */
  onDeactivateInstead?: () => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; refs: ActiveBookingRef[] }
  | { kind: "error"; error: string };

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; error: string };

export function DeleteCatalogItemConfirm({
  noun,
  itemName,
  loadRefs,
  onDelete,
  onDeactivateInstead,
  onCancel,
}: DeleteCatalogItemConfirmProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [confirmCheck, setConfirmCheck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRefs().then((result) => {
      if (cancelled) return;
      if (result.ok) setLoad({ kind: "loaded", refs: result.refs });
      else setLoad({ kind: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [loadRefs]);

  const refCount = load.kind === "loaded" ? load.refs.length : 0;
  const blockedByRefs = load.kind === "loaded" && refCount > 0;
  const canDelete =
    load.kind === "loaded" && refCount === 0 && confirmCheck && submit.kind !== "submitting";

  const handleDelete = async () => {
    setSubmit({ kind: "submitting" });
    const result = await onDelete();
    if (result.ok) return;
    setSubmit({ kind: "error", error: result.error ?? "Could not delete." });
  };

  const handleDeactivate = async () => {
    if (!onDeactivateInstead) return;
    setSubmit({ kind: "submitting" });
    const result = await onDeactivateInstead();
    if (result.ok) return;
    setSubmit({ kind: "error", error: result.error ?? "Could not deactivate." });
  };

  const linkNounPlural = noun === "service" ? "add-ons" : "services";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && submit.kind !== "submitting") {
          onCancel();
        }
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-6)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <h2
          id="delete-title"
          style={{
            fontFamily: "var(--serif)",
            margin: 0,
            marginBottom: "var(--space-3)",
            color: "var(--accent-error)",
          }}
        >
          Permanently delete {noun} “{itemName}”?
        </h2>

        {load.kind === "loading" && (
          <p style={{ color: "var(--charcoal-soft)" }}>
            Checking for bookings that reference this {noun}…
          </p>
        )}

        {load.kind === "error" && (
          <Alert variant="error" title="Couldn't check references">
            {load.error}
          </Alert>
        )}

        {load.kind === "loaded" && blockedByRefs && (
          <>
            <div className={s.warnBanner}>
              <span className={s.warnBannerTitle}>
                Can&rsquo;t delete — {refCount} booking
                {refCount === 1 ? "" : "s"} (active and historical) reference
                this {noun}.
              </span>
              <span className={s.warnBannerText}>
                Hard delete is blocked at the database level (foreign key
                constraint) so historical bookings keep an accurate record of
                what the guest paid for. <strong>Deactivate</strong> instead —
                it hides the {noun} from the public booking funnel while
                keeping the snapshot intact.
              </span>
            </div>

            <div className={s.modalRefList}>
              {load.refs.map((ref) => {
                const href = ref.bidId
                  ? `/admin/bids/${ref.bidId}`
                  : `/admin/bookings/${ref.bookingId}`;
                const date = formatDateLongTz(
                  ref.startTime,
                  ref.propertyTimezone,
                );
                const time = formatSlotLabelTz(
                  ref.startTime,
                  ref.propertyTimezone,
                );
                return (
                  <div key={ref.bookingId} className={s.modalRefRow}>
                    <span className={s.modalRefWhen}>
                      {date}
                      <br />
                      {time} CT
                    </span>
                    <div className={s.modalRefGuest}>
                      <span className={s.modalRefGuestName}>{ref.guestName}</span>
                      <span className={s.modalRefGuestEmail}>{ref.guestEmail}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-2)",
                        alignItems: "center",
                      }}
                    >
                      <BookingStatusBadge status={ref.status} />
                      <Link href={href} target="_blank" rel="noreferrer">
                        Open →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {load.kind === "loaded" && !blockedByRefs && (
          <>
            <div className={s.warnBanner}>
              <span className={s.warnBannerTitle}>
                This will permanently remove the {noun}.
              </span>
              <span className={s.warnBannerText}>
                No bookings reference it, so the row can be deleted cleanly.
                All links to {linkNounPlural} will be removed at the same time.
                This cannot be undone — if you might need it later, deactivate
                instead.
              </span>
            </div>

            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                marginTop: "var(--space-3)",
              }}
            >
              <input
                type="checkbox"
                checked={confirmCheck}
                onChange={(e) => setConfirmCheck(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent-error)" }}
              />
              <span>
                I understand this permanently deletes the {noun} and cannot be undone.
              </span>
            </label>
          </>
        )}

        {submit.kind === "error" && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Alert variant="error" title="Couldn't complete action">
              {submit.error}
            </Alert>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)",
            marginTop: "var(--space-5)",
          }}
        >
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={submit.kind === "submitting"}
          >
            Cancel
          </Button>
          {blockedByRefs && onDeactivateInstead && (
            <Button
              variant="primary"
              onClick={handleDeactivate}
              loading={submit.kind === "submitting"}
            >
              {submit.kind === "submitting" ? "Deactivating…" : "Deactivate instead"}
            </Button>
          )}
          {!blockedByRefs && (
            <Button
              variant="primary"
              onClick={handleDelete}
              loading={submit.kind === "submitting"}
              disabled={!canDelete}
              style={{
                background: "var(--accent-error)",
                borderColor: "var(--accent-error)",
              }}
            >
              {submit.kind === "submitting" ? "Deleting…" : "Delete permanently"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

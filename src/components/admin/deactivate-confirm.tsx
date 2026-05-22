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

interface DeactivateConfirmProps {
  /** Friendly noun ("service" / "add-on") used in copy. */
  noun: string;
  /** The name of the item being deactivated. */
  itemName: string;
  /** Fetches the list of active bookings referencing this item. */
  loadRefs: () => Promise<{ ok: true; refs: ActiveBookingRef[] } | { ok: false; error: string }>;
  /** Called once the admin confirms the second step. */
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  /** Closes the modal without deactivating. */
  onCancel: () => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; refs: ActiveBookingRef[] }
  | { kind: "error"; error: string };

type ConfirmState =
  | { kind: "review" }
  | { kind: "submitting" }
  | { kind: "error"; error: string };

export function DeactivateConfirm({
  noun,
  itemName,
  loadRefs,
  onConfirm,
  onCancel,
}: DeactivateConfirmProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "review" });
  const [secondConfirm, setSecondConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRefs().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLoad({ kind: "loaded", refs: result.refs });
      } else {
        setLoad({ kind: "error", error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadRefs]);

  const refCount = load.kind === "loaded" ? load.refs.length : 0;
  const hasRefs = refCount > 0;

  const handleConfirm = async () => {
    setConfirm({ kind: "submitting" });
    const result = await onConfirm();
    if (result.ok) return;
    setConfirm({ kind: "error", error: result.error ?? "Could not deactivate." });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
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
        if (e.target === e.currentTarget && confirm.kind !== "submitting") {
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
          id="deactivate-title"
          style={{
            fontFamily: "var(--serif)",
            margin: 0,
            marginBottom: "var(--space-3)",
            color: "var(--olive)",
          }}
        >
          Deactivate {noun} “{itemName}”?
        </h2>

        {load.kind === "loading" && (
          <p style={{ color: "var(--charcoal-soft)" }}>
            Checking for active bookings referencing this {noun}…
          </p>
        )}

        {load.kind === "error" && (
          <Alert variant="error" title="Couldn't check active bookings">
            {load.error}
          </Alert>
        )}

        {load.kind === "loaded" && !hasRefs && (
          <p>
            No active bookings reference this {noun}. Deactivating will hide
            it from the public booking funnel. Historical bookings keep their
            snapshot of the name and price.
          </p>
        )}

        {load.kind === "loaded" && hasRefs && (
          <>
            <div className={s.warnBanner}>
              <span className={s.warnBannerTitle}>
                {refCount} active booking{refCount === 1 ? "" : "s"} reference{" "}
                this {noun}.
              </span>
              <span className={s.warnBannerText}>
                Deactivating hides the {noun} from the booking funnel.
                Existing bookings will keep their snapshot and continue to
                show the {noun} on the guest&rsquo;s bid page. Confirm twice
                below to proceed.
              </span>
            </div>

            <div className={s.modalRefList}>
              {load.refs.map((ref) => {
                const href = ref.bidId
                  ? `/admin/bids/${ref.bidId}`
                  : `/admin/bookings/${ref.bookingId}`;
                const date = formatDateLongTz(ref.startTime, ref.propertyTimezone);
                const time = formatSlotLabelTz(ref.startTime, ref.propertyTimezone);
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

            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                marginTop: "var(--space-4)",
              }}
            >
              <input
                type="checkbox"
                checked={secondConfirm}
                onChange={(e) => setSecondConfirm(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--olive)" }}
              />
              <span>
                I understand that {refCount} active booking
                {refCount === 1 ? "" : "s"} still reference this {noun}.
              </span>
            </label>
          </>
        )}

        {confirm.kind === "error" && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Alert variant="error" title="Couldn't deactivate">
              {confirm.error}
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
            disabled={confirm.kind === "submitting"}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={confirm.kind === "submitting"}
            disabled={
              load.kind === "loading" ||
              load.kind === "error" ||
              (hasRefs && !secondConfirm) ||
              confirm.kind === "submitting"
            }
          >
            {confirm.kind === "submitting" ? "Deactivating…" : "Deactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

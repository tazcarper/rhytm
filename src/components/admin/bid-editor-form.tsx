"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { updateAdminBidAction } from "@/app/admin/bids/[id]/edit/actions";
import type { AdminBidDetail } from "@/src/services/admin/get-bid-detail";
import s from "./bid-editor-form.module.css";

interface BidEditorFormProps {
  detail: AdminBidDetail;
}

interface GearDraft {
  name: string;
  description: string;
}

interface FaqDraft {
  question: string;
  answer: string;
}

function moneyToString(amount: number | null): string {
  return amount === null ? "" : String(amount);
}

export function BidEditorForm({ detail }: BidEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [confirmedPrice, setConfirmedPrice] = useState(
    moneyToString(detail.booking.confirmedPrice),
  );
  const [depositAmount, setDepositAmount] = useState(
    moneyToString(detail.booking.depositAmount),
  );
  const [quoteNote, setQuoteNote] = useState(detail.bid.quoteNote ?? "");
  const [scheduleNotes, setScheduleNotes] = useState(
    detail.bid.scheduleNotes ?? "",
  );
  const [staffNotes, setStaffNotes] = useState(detail.bid.staffNotes ?? "");

  const [gearList, setGearList] = useState<GearDraft[]>(
    detail.bid.gearList.map((gearItem) => ({
      name: gearItem.name,
      description: gearItem.description ?? "",
    })),
  );
  const [faq, setFaq] = useState<FaqDraft[]>(
    detail.bid.faq.map((faqItem) => ({
      question: faqItem.question,
      answer: faqItem.answer,
    })),
  );

  const updateGear = (index: number, patch: Partial<GearDraft>) =>
    setGearList((prev) =>
      prev.map((gear, idx) => (idx === index ? { ...gear, ...patch } : gear)),
    );
  const removeGear = (index: number) =>
    setGearList((prev) => prev.filter((_, idx) => idx !== index));
  const addGear = () =>
    setGearList((prev) => [...prev, { name: "", description: "" }]);

  const updateFaq = (index: number, patch: Partial<FaqDraft>) =>
    setFaq((prev) =>
      prev.map((faqItem, idx) =>
        idx === index ? { ...faqItem, ...patch } : faqItem,
      ),
    );
  const removeFaq = (index: number) =>
    setFaq((prev) => prev.filter((_, idx) => idx !== index));
  const addFaq = () =>
    setFaq((prev) => [...prev, { question: "", answer: "" }]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateAdminBidAction({
        bidId: detail.bid.id,
        bookingId: detail.booking.id,
        confirmedPrice: confirmedPrice,
        depositAmount: depositAmount,
        quoteNote: quoteNote.trim() || null,
        scheduleNotes: scheduleNotes.trim() || null,
        staffNotes: staffNotes.trim() || null,
        gearList: gearList
          .filter((gearItem) => gearItem.name.trim())
          .map((gearItem) => ({
            name: gearItem.name.trim(),
            description: gearItem.description.trim() || undefined,
          })),
        faq: faq
          .filter((faqItem) => faqItem.question.trim() && faqItem.answer.trim())
          .map((faqItem) => ({
            question: faqItem.question.trim(),
            answer: faqItem.answer.trim(),
          })),
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }

      router.push(`/admin/bids/${detail.bid.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={s.form}>
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}

      <Card padding="loose" elevation="soft" className={s.section}>
        <h2 className={s.sectionTitle}>Pricing</h2>
        <div className={s.row}>
          <label className={s.field}>
            <span className={s.label}>Confirmed quote (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={confirmedPrice}
              onChange={(e) => setConfirmedPrice(e.target.value)}
              className={s.input}
              placeholder="0.00"
            />
            <span className={s.help}>
              Shown to the guest on the bid page. Leave blank to keep the
              auto-estimate.
            </span>
          </label>

          <label className={s.field}>
            <span className={s.label}>Deposit (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className={s.input}
              placeholder="0.00"
            />
            <span className={s.help}>
              Stripe will charge this when the guest clicks pay (App 6).
            </span>
          </label>
        </div>

        <label className={s.field}>
          <span className={s.label}>Quote note (optional)</span>
          <textarea
            value={quoteNote}
            onChange={(e) => setQuoteNote(e.target.value)}
            className={s.textarea}
            placeholder="e.g. Holiday weekend rate · Group of 10+ surcharge · Returning-guest discount"
            maxLength={500}
            rows={2}
          />
          <span className={s.help}>
            Shown to the guest next to the confirmed quote — use this to
            explain a price adjustment from the estimate. Markdown supported.
          </span>
        </label>
      </Card>

      <Card padding="loose" elevation="soft" className={s.section}>
        <h2 className={s.sectionTitle}>Schedule notes</h2>
        <label className={s.field}>
          <textarea
            value={scheduleNotes}
            onChange={(e) => setScheduleNotes(e.target.value)}
            className={s.textarea}
            placeholder="Arrival, briefing, lunch, range time, departure…"
            maxLength={5000}
          />
          <span className={s.help}>
            Shown to the guest on the bid page. Markdown supported —
            <code>**bold**</code>, <code>[text](https://…)</code>, lists.
          </span>
        </label>
      </Card>

      <Card padding="loose" elevation="soft" className={s.section}>
        <h2 className={s.sectionTitle}>Gear list ({gearList.length})</h2>
        <div className={s.repeaterList}>
          {gearList.length === 0 && (
            <p className={s.emptyRepeater}>No gear items yet.</p>
          )}
          {gearList.map((gear, index) => (
            <div key={index} className={s.repeaterItem}>
              <div className={s.repeaterFields}>
                <input
                  type="text"
                  value={gear.name}
                  onChange={(e) => updateGear(index, { name: e.target.value })}
                  className={s.input}
                  placeholder="Item name (e.g. Eye + ear protection)"
                  maxLength={200}
                />
                <textarea
                  value={gear.description}
                  onChange={(e) =>
                    updateGear(index, { description: e.target.value })
                  }
                  className={s.textarea}
                  placeholder="Description (optional, markdown supported)"
                  maxLength={500}
                  rows={2}
                />
              </div>
              <button
                type="button"
                onClick={() => removeGear(index)}
                className={s.removeBtn}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {gearList.length < 20 && (
          <button type="button" onClick={addGear} className={s.addBtn}>
            + Add gear item
          </button>
        )}
      </Card>

      <Card padding="loose" elevation="soft" className={s.section}>
        <h2 className={s.sectionTitle}>FAQ ({faq.length})</h2>
        <div className={s.repeaterList}>
          {faq.length === 0 && (
            <p className={s.emptyRepeater}>No FAQ items yet.</p>
          )}
          {faq.map((faqItem, index) => (
            <div key={index} className={s.repeaterItem}>
              <div className={s.repeaterFields}>
                <input
                  type="text"
                  value={faqItem.question}
                  onChange={(e) =>
                    updateFaq(index, { question: e.target.value })
                  }
                  className={s.input}
                  placeholder="Question"
                  maxLength={500}
                />
                <textarea
                  value={faqItem.answer}
                  onChange={(e) => updateFaq(index, { answer: e.target.value })}
                  className={s.textarea}
                  placeholder="Answer (markdown supported)"
                  maxLength={2000}
                />
              </div>
              <button
                type="button"
                onClick={() => removeFaq(index)}
                className={s.removeBtn}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {faq.length < 20 && (
          <button type="button" onClick={addFaq} className={s.addBtn}>
            + Add FAQ item
          </button>
        )}
      </Card>

      <Card padding="loose" elevation="soft" className={s.section}>
        <h2 className={s.sectionTitle}>Staff notes</h2>
        <label className={s.field}>
          <textarea
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            className={s.textarea}
            placeholder="Internal notes — never shown to the guest."
            maxLength={5000}
          />
          <span className={s.help}>
            🔒 Internal only. Use for handoffs, special asks, or anything the
            team needs to remember. Markdown supported.
          </span>
        </label>
      </Card>

      <div className={s.actions}>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isPending}
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => router.push(`/admin/bids/${detail.bid.id}`)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { addInquiryNoteAction, resolveInquiryAction } from "@/app/admin/inquiries/actions";
import type {
  AdminInquiryDetail,
  AdminInquiryEvent,
  InquiryEventType,
} from "@/src/services/admin/inquiries";
import { humanizeEnum } from "./humanize";
import { InquiryAuditLog } from "./inquiry-audit-log";
import s from "./bid-editor-form.module.css";

interface InquiryDetailProps {
  inquiry: AdminInquiryDetail;
  events: AdminInquiryEvent[];
}

export function InquiryDetail({ inquiry, events }: InquiryDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<InquiryEventType>("contacted");

  const detailEntries = Object.entries(inquiry.details).filter(
    ([, value]) => value !== null && value !== "",
  );

  const handleAddNote = () => {
    setError(null);
    startTransition(async () => {
      const result = await addInquiryNoteAction({
        inquiryId: inquiry.id,
        eventType: noteType,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save the note.");
        return;
      }
      setNote("");
      router.refresh();
    });
  };

  const handleResolve = () => {
    setError(null);
    startTransition(async () => {
      const result = await resolveInquiryAction({
        inquiryId: inquiry.id,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't resolve the inquiry.");
        return;
      }
      setNote("");
      router.push("/admin/inquiries");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card padding="loose" elevation="soft">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-label text-tan-deep">
          Contact
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-micro text-gray">Name</dt>
            <dd className="text-[14px] text-olive">{inquiry.name}</dd>
          </div>
          <div>
            <dt className="text-micro text-gray">Email</dt>
            <dd className="text-[14px] text-olive">
              <a href={`mailto:${inquiry.email}`} className="text-tan-deep">
                {inquiry.email}
              </a>
            </dd>
          </div>
          {inquiry.phone && (
            <div>
              <dt className="text-micro text-gray">Phone</dt>
              <dd className="text-[14px] text-olive">{inquiry.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-micro text-gray">Property</dt>
            <dd className="text-[14px] text-olive">{inquiry.propertyName}</dd>
          </div>
          {inquiry.sourceLabel && (
            <div>
              <dt className="text-micro text-gray">Clicked</dt>
              <dd className="text-[14px] text-olive">{inquiry.sourceLabel}</dd>
            </div>
          )}
          {inquiry.sourcePage && (
            <div>
              <dt className="text-micro text-gray">Page</dt>
              <dd className="text-[14px] text-olive">{inquiry.sourcePage}</dd>
            </div>
          )}
          {detailEntries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-micro text-gray">{humanizeEnum(key)}</dt>
              <dd className="text-[14px] text-olive">{String(value)}</dd>
            </div>
          ))}
        </dl>

        {inquiry.message && (
          <div className="mt-4">
            <p className="text-micro text-gray mb-1">Message</p>
            <p className="text-[14px] text-olive whitespace-pre-wrap m-0">{inquiry.message}</p>
          </div>
        )}
      </Card>

      <Card padding="loose" elevation="soft">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-label text-tan-deep">
          History
        </p>
        <InquiryAuditLog events={events} />
      </Card>

      {inquiry.status === "new" && (
        <Card padding="loose" elevation="soft">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-label text-tan-deep">
            Add an update
          </p>
          {error && (
            <Alert variant="error" title="Couldn't save">
              {error}
            </Alert>
          )}
          <div className="flex flex-col gap-3">
            <label className={s.field}>
              <span className={s.label}>Type</span>
              <select
                value={noteType}
                onChange={(event) => setNoteType(event.target.value as InquiryEventType)}
                className={s.input}
              >
                <option value="contacted">Contacted</option>
                <option value="denied">Denied</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>Note (optional)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={s.input}
                rows={3}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={isPending} onClick={handleAddNote}>
                {isPending ? "Saving…" : "Add update"}
              </Button>
              <Button type="button" variant="primary" disabled={isPending} onClick={handleResolve}>
                {isPending ? "Saving…" : "Mark resolved"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

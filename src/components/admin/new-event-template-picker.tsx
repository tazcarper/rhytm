"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { duplicateEventFromTemplateAction } from "@/app/admin/events/actions";
import type { AdminEventTemplateOption } from "@/src/services/admin/events";

// Offers a shortcut into a fresh draft pre-filled from a saved template —
// a snapshot clone (new id, status reset to draft), not a live link back
// to the template. Sits above the blank editor form; skip it to start
// from scratch.
export function NewEventTemplatePicker({
  templates,
}: {
  templates: ReadonlyArray<AdminEventTemplateOption>;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (templates.length === 0) return null;

  const handleUseTemplate = () => {
    if (!templateId) return;
    setError(null);
    startTransition(async () => {
      const result = await duplicateEventFromTemplateAction(templateId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't create from template.");
        return;
      }
      router.push(`/admin/events/${result.id}`);
    });
  };

  return (
    <Card padding="default" elevation="soft" className="mb-6">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-label text-tan-deep">
        Start from a template
      </p>
      {error && (
        <Alert variant="error" title="Couldn't create from template">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="min-w-[240px] rounded-sharp border border-rule px-3 py-2 text-[14px] text-olive"
        >
          <option value="">Choose a template…</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title} — {template.propertyName}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" disabled={!templateId || isPending} onClick={handleUseTemplate}>
          {isPending ? "Creating…" : "Use template"}
        </Button>
      </div>
      <p className="mt-2 text-micro text-gray">
        Or skip this and fill out a blank event below.
      </p>
    </Card>
  );
}

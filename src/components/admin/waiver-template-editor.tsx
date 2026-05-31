"use client";

import { useState } from "react";
import { Alert, Button, Card, FormField, Input, Textarea } from "@/lib/ui";
import { saveWaiverTemplateAction } from "@/app/admin/settings/waivers/actions";
import type { WaiverTemplate } from "@/src/services/waiver/get-active-waiver-template";
import s from "./waiver-template-editor.module.css";

interface WaiverTemplateEditorProps {
  propertyId: string;
  propertyName: string;
  template: WaiverTemplate | null;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function WaiverTemplateEditor({
  propertyId,
  propertyName,
  template,
}: WaiverTemplateEditorProps) {
  const [title, setTitle] = useState(
    template?.title ?? `Liability Waiver & Release — ${propertyName}`,
  );
  const [body, setBody] = useState(template?.body ?? "");
  const [consentText, setConsentText] = useState(template?.consentText ?? "");
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  const saving = state.kind === "saving";
  const incomplete = !title.trim() || !body.trim() || !consentText.trim();

  // Any edit clears a prior saved/error banner.
  const markDirty = () => {
    if (state.kind !== "idle" && state.kind !== "saving") {
      setState({ kind: "idle" });
    }
  };

  const handleSave = async () => {
    setState({ kind: "saving" });
    const result = await saveWaiverTemplateAction(propertyId, {
      title,
      body,
      consentText,
    });
    setState(
      result.ok
        ? { kind: "saved" }
        : { kind: "error", message: result.message },
    );
  };

  return (
    <Card padding="loose" elevation="soft" className={s.card}>
      <div className={s.head}>
        <h2 className={s.propertyName}>{propertyName}</h2>
        <span className={s.version}>
          {template ? `Active version ${template.version}` : "No template yet"}
        </span>
      </div>

      <div className={s.fields}>
        <FormField label="Title">
          {(controlProps) => (
            <Input
              {...controlProps}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                markDirty();
              }}
              maxLength={200}
              disabled={saving}
            />
          )}
        </FormField>

        <FormField
          label="Waiver body"
          helper="The legal text guests read and sign. Markdown supported."
        >
          {(controlProps) => (
            <Textarea
              {...controlProps}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                markDirty();
              }}
              rows={12}
              disabled={saving}
            />
          )}
        </FormField>

        <FormField
          label="Consent disclosure"
          helper="Shown next to the consent checkbox in the signing modal."
        >
          {(controlProps) => (
            <Textarea
              {...controlProps}
              value={consentText}
              onChange={(event) => {
                setConsentText(event.target.value);
                markDirty();
              }}
              rows={3}
              disabled={saving}
            />
          )}
        </FormField>
      </div>

      {state.kind === "error" && (
        <Alert variant="warn" title="Couldn't save">
          {state.message}
        </Alert>
      )}
      {state.kind === "saved" && (
        <Alert variant="success" title="Saved">
          A new version is now active. Previously signed waivers keep the
          version their guest agreed to.
        </Alert>
      )}

      <div className={s.actions}>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          disabled={saving || incomplete}
        >
          {saving ? "Saving…" : "Save new version"}
        </Button>
      </div>
    </Card>
  );
}

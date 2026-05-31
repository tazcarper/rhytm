"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, FormField, Input } from "@/lib/ui";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { submitWaiverSignatureAction } from "@/app/(public)/bids/[slug]/[code]/signature-actions";
import s from "./waiver-sign-modal.module.css";

// Homegrown waiver signing surface (App 7 native path). A native <dialog>
// gives us focus-trap, Esc-to-close, and an inert background for free; the
// CSS module makes it a full-screen sheet on phones and a centered dialog
// on desktop. The guest types their legal name, checks consent, and
// confirms — the Server Action renders + stores the PDF and stamps
// signed_at synchronously, so success is immediate (no polling, unlike the
// Dropbox Sign path it replaces).

interface WaiverSignModalProps {
  bidSlug: string;
  bidAccessCode: string;
  defaultName: string;
  waiverTitle: string;
  waiverBody: string;
  consentText: string;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function WaiverSignModal({
  bidSlug,
  bidAccessCode,
  defaultName,
  waiverTitle,
  waiverBody,
  consentText,
}: WaiverSignModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [signedName, setSignedName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submitting = state.kind === "submitting";

  // Always release the page scroll-lock whenever the dialog closes, no
  // matter how (button, Esc, backdrop, or a successful submit).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const releaseScroll = () => {
      document.body.style.overflow = "";
    };
    dialog.addEventListener("close", releaseScroll);
    return () => dialog.removeEventListener("close", releaseScroll);
  }, []);

  const open = () => {
    setState({ kind: "idle" });
    setAgreed(false);
    setSignedName(defaultName);
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = signedName.trim();
    if (!trimmedName) {
      setState({ kind: "error", message: "Please type your full legal name to sign." });
      return;
    }
    if (!agreed) {
      setState({ kind: "error", message: "Please check the consent box before signing." });
      return;
    }

    setState({ kind: "submitting" });
    const result = await submitWaiverSignatureAction(bidSlug, bidAccessCode, {
      signedName: trimmedName,
      agreedConsent: agreed,
    });

    if (result.ok) {
      // Synchronous success — close and refresh so the bid page renders the
      // signed state immediately. No polling.
      close();
      router.refresh();
      return;
    }
    setState({ kind: "error", message: result.message });
  };

  return (
    <>
      <Button type="button" variant="primary" onClick={open}>
        Sign your waiver →
      </Button>

      <dialog
        ref={dialogRef}
        className={s.dialog}
        // Backdrop click (target is the dialog itself) closes — unless a
        // submission is in flight.
        onClick={(event) => {
          if (event.target === dialogRef.current && !submitting) close();
        }}
        // Esc fires 'cancel' then closes; block it mid-submit.
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
      >
        <form className={s.sheet} onSubmit={handleSubmit}>
          <header className={s.header}>
            <h2 className={s.title}>{waiverTitle}</h2>
            <button
              type="button"
              className={s.closeButton}
              onClick={close}
              aria-label="Close without signing"
              disabled={submitting}
            >
              ×
            </button>
          </header>

          <div className={s.body}>
            <MarkdownProse>{waiverBody}</MarkdownProse>
          </div>

          <div className={s.controls}>
            <FormField
              label="Type your full legal name"
              required
              error={
                state.kind === "error" && !signedName.trim()
                  ? state.message
                  : undefined
              }
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={signedName}
                  onChange={(event) => setSignedName(event.target.value)}
                  placeholder="Full legal name"
                  autoComplete="name"
                  autoCapitalize="words"
                  maxLength={120}
                  disabled={submitting}
                />
              )}
            </FormField>

            <label className={s.consent}>
              <input
                type="checkbox"
                className={s.checkbox}
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={submitting}
              />
              <span className={s.consentText}>{consentText}</span>
            </label>

            {state.kind === "error" && (
              <Alert variant="warn" title="Couldn't sign your waiver">
                {state.message}
              </Alert>
            )}
          </div>

          <footer className={s.footer}>
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? "Signing…" : "Confirm & sign"}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

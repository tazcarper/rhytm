"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
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
//
// The name + consent + sign controls stay hidden until the guest has
// scrolled the waiver text to the end (or used "Skip to bottom"), so they
// can't sign without the document having been fully presented to them.

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

// Slack (px) when deciding "scrolled to the end" — covers sub-pixel
// rounding and trailing margins.
const BOTTOM_SLACK = 8;

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
  const bodyRef = useRef<HTMLDivElement>(null);
  const [signedName, setSignedName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [isOpen, setIsOpen] = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);

  const submitting = state.kind === "submitting";

  // Release the page scroll-lock + clear open state whenever the dialog
  // closes (button, Esc, backdrop, or a successful submit).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      document.body.style.overflow = "";
      setIsOpen(false);
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // While open, watch the waiver body's scroll position. Latches
  // hasReadToBottom once the end is reached. The immediate check also
  // covers a waiver short enough that the body never scrolls.
  useEffect(() => {
    if (!isOpen) return;
    const el = bodyRef.current;
    if (!el) return;
    const checkAtBottom = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_SLACK) {
        setHasReadToBottom(true);
      }
    };
    checkAtBottom();
    el.addEventListener("scroll", checkAtBottom, { passive: true });
    return () => el.removeEventListener("scroll", checkAtBottom);
  }, [isOpen]);

  const open = () => {
    setState({ kind: "idle" });
    setAgreed(false);
    setSignedName(defaultName);
    setHasReadToBottom(false);
    setIsOpen(true);
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
  };

  const skipToBottom = (event: MouseEvent<HTMLButtonElement>) => {
    // Block this click's default action. Revealing the controls swaps this
    // same button slot into the type="submit" "Confirm & sign" on the next
    // render, and React commits that within the discrete click event —
    // before the browser evaluates the default action — which would
    // otherwise submit the still-empty form. preventDefault stops that.
    event.preventDefault();
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setHasReadToBottom(true);
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

          <div className={s.body} ref={bodyRef}>
            <MarkdownProse>{waiverBody}</MarkdownProse>
          </div>

          {hasReadToBottom && (
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
                    autoFocus
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
          )}

          <footer className={s.footer}>
            {!hasReadToBottom && (
              <span className={s.readHint}>
                Scroll through the full waiver to sign.
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={submitting}
            >
              Cancel
            </Button>
            {hasReadToBottom ? (
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={submitting}
              >
                {submitting ? "Signing…" : "Confirm & sign"}
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={skipToBottom}>
                Skip to bottom ↓
              </Button>
            )}
          </footer>
        </form>
      </dialog>
    </>
  );
}

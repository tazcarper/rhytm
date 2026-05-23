"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type HelloSignType from "hellosign-embedded";
import { Alert, Button } from "@/lib/ui";
import { getSignUrlAction } from "@/app/(public)/bids/[slug]/[code]/signature-actions";
import s from "./signature-form.module.css";

// hellosign-embedded has import-time side effects that touch `window`
// (loads its stylesheet via SCSS, which expects a browser). Importing
// it at module top crashes the bid page's SSR render with
// "ReferenceError: window is not defined". Workaround: dynamic-import
// it inside the effect (browser-only) and keep just the type at the
// top for typecheck purposes.

// Inline waiver signing surface: Dropbox Sign's embedded JS SDK
// mounts an iframe inside the existing SignatureSlot card. The flow:
//
//   1. Mount → Server Action returns a fresh sign URL (expires ~30
//      min; we re-fetch on every full mount, not on every render).
//   2. Instantiate HelloSign with our NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID
//      and open the URL inside a container div.
//   3. Listen for 'sign' (user submitted) → optimistic success,
//      kick the bid-page revalidation poll (mirrors App 6's pattern).
//   4. Listen for 'error' / 'decline' → display inline + log.
//
// Webhook → DB write is the authority. We optimistically update the
// UI on the 'sign' event so the customer immediately sees progress;
// the bid page's `bid.signed_at` won't actually update until the
// webhook fires + we revalidate. Same trade-off as the deposit form.

const CLIENT_ID = process.env.NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID;

type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; signUrl: string }
  | { kind: "signed" }
  | { kind: "declined" }
  | { kind: "error"; message: string };

interface SignatureFormProps {
  bidSlug: string;
  bidAccessCode: string;
}

export function SignatureForm({
  bidSlug,
  bidAccessCode,
}: SignatureFormProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<HelloSignType | null>(null);
  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [fetchToken, setFetchToken] = useState(0);

  // Step 1: fetch sign URL. Re-fetch on retry only.
  useEffect(() => {
    let cancelled = false;
    setSession({ kind: "loading" });
    (async () => {
      const result = await getSignUrlAction(bidSlug, bidAccessCode);
      if (cancelled) return;
      if (result.ok) {
        setSession({ kind: "ready", signUrl: result.signUrl });
      } else {
        setSession({ kind: "error", message: result.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bidSlug, bidAccessCode, fetchToken]);

  // Step 2: mount HelloSign once we have a URL + container ref. Re-run
  // when the signUrl changes (rare: retry path). Dynamic import keeps
  // the hellosign-embedded module out of the SSR bundle (it touches
  // `window` at import time).
  useEffect(() => {
    if (session.kind !== "ready") return;
    if (!containerRef.current) return;
    if (!CLIENT_ID) {
      setSession({
        kind: "error",
        message: "Signing isn't configured. Contact us to finalize.",
      });
      return;
    }

    let cancelled = false;
    let cleanupClient: HelloSignType | null = null;

    (async () => {
      const HelloSignMod = await import("hellosign-embedded");
      if (cancelled) return;
      if (!containerRef.current) return;

      const HelloSign = HelloSignMod.default;
      const client = new HelloSign({
        clientId: CLIENT_ID,
        // skipDomainVerification: true is required when the app's URL
        // isn't whitelisted in Dropbox Sign's API app settings. Safe to
        // leave on during dev; tighten in prod by adding the deploy
        // domain to the API app's allowed domains.
        skipDomainVerification:
          process.env.NODE_ENV !== "production",
      });
      clientRef.current = client;
      cleanupClient = client;

      client.on("sign", () => {
        setSession({ kind: "signed" });
      });
      client.on("decline", () => {
        setSession({ kind: "declined" });
      });
      client.on("error", (data) => {
        console.error("[signature-form] HelloSign error", data);
        setSession({
          kind: "error",
          message: "Something went wrong. Please refresh and try again.",
        });
      });

      // `session` here is captured at effect time — TS narrowed it to
      // `ready` via the early return above. Re-check before opening
      // in case React's strict-mode double-fire happened to flip it.
      if (session.kind === "ready") {
        client.open(session.signUrl, {
          container: containerRef.current,
          // Customer is opting into signing; cancel returns them to
          // the bid page (form unmounts when they refresh).
          allowCancel: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      // Clean up the iframe + listeners on unmount or before the
      // next mount (avoids leaked event handlers).
      try {
        cleanupClient?.close();
      } catch {
        // ignore: close() throws if already closed
      }
      clientRef.current = null;
    };
  }, [session]);

  // Step 3: post-sign polling — same shape as deposit-payment-form's
  // success-then-refresh loop. Webhook stamps signed_at; we wait for
  // the page revalidation to pick it up.
  useEffect(() => {
    if (session.kind !== "signed") return;
    router.refresh();
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 15) {
        window.clearInterval(interval);
        setPollingExhausted(true);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [session, router]);

  const retry = () => setFetchToken((n) => n + 1);

  if (session.kind === "loading") {
    return (
      <div className={s.skeleton} aria-busy="true" aria-live="polite" />
    );
  }

  if (session.kind === "error") {
    return (
      <div className={s.errorBlock}>
        <Alert variant="warn" title="We couldn't open the waiver">
          {session.message}
        </Alert>
        <div className={s.actionRow}>
          <Button type="button" variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (session.kind === "declined") {
    return (
      <div className={s.errorBlock}>
        <Alert variant="warn" title="Waiver declined">
          You can&rsquo;t finalize your booking without signing the waiver.
          Refresh the page to try again, or contact us.
        </Alert>
      </div>
    );
  }

  if (session.kind === "signed") {
    return (
      <div className={s.successWrap}>
        <p className={s.successTitle}>Waiver signed</p>
        <p className={s.successCopy}>
          {pollingExhausted
            ? "Your signature is in. Refresh in a moment to see your bid update."
            : "Finalizing your booking — this only takes a moment."}
        </p>
        {!pollingExhausted && (
          <div className={s.spinner} aria-hidden="true" />
        )}
      </div>
    );
  }

  // session.kind === 'ready' — render the container. The actual
  // iframe is mounted into it by HelloSign.open() in the effect above.
  return <div ref={containerRef} className={s.signerMount} />;
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ui";
import { previewSignInAction } from "./preview-actions";
import styles from "./login.module.css";

// Shown on Vercel preview sites only: skip the magic link and go straight
// in as the preview's test account. Until PREVIEW_LOGIN_EMAIL is set it
// says so, so it's clear what's missing.
export function PreviewSignIn({
  next,
  ready,
}: {
  next: string | null;
  ready: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.previewSignIn}>
      <p className={styles.previewNote}>Preview site</p>
      {!ready ? (
        <p className={styles.previewHelp}>
          Quick sign-in is off. Add PREVIEW_LOGIN_EMAIL (Preview only) in
          Vercel&rsquo;s environment variables, then redeploy this preview.
        </p>
      ) : (
        <Button
          type="button"
          variant="primary"
          fullWidth
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await previewSignInAction(next);
              setError(result.error);
            })
          }
        >
          Sign in as test admin
        </Button>
      )}
      {error && (
        <p className={styles.loginError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

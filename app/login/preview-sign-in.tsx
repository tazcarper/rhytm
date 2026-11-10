"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ui";
import { previewSignInAction } from "./preview-actions";
import styles from "./login.module.css";

// Shown on Vercel preview sites only: skip the magic link and go straight
// in as the preview's test account.
export function PreviewSignIn({ next }: { next: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.previewSignIn}>
      <p className={styles.previewNote}>Preview site</p>
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
      {error && (
        <p className={styles.loginError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

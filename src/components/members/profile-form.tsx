"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/lib/auth/actions";
import { Alert, Button } from "@/lib/ui";

// Display-name editor for the member portal. Owns the input value plus
// the pending/error/success feedback (hence a client component); the
// actual write is the updateDisplayName server action, which persists
// to the Supabase Auth user's user_metadata.display_name. On success we
// router.refresh() so the server-rendered identity strip picks up the
// new name.
export function ProfileForm({
  initialDisplayName,
  email,
}: {
  initialDisplayName: string;
  email: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateDisplayName(displayName);
      if (!result.ok) {
        setError(result.error ?? "Could not save your display name.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2 max-w-md">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {saved && !error && (
        <Alert variant="success" title="Saved">
          Your display name has been updated.
        </Alert>
      )}

      <label htmlFor="display-name" className="flex flex-col gap-1">
        <span className="font-serif text-[15px] tracking-[0.3px] text-olive">
          Display name
        </span>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDisplayName(event.target.value)
          }
          required
          maxLength={80}
          placeholder="e.g. Jane Carper"
          className="border border-rule rounded px-3 py-2 font-serif text-[16px] focus:border-olive focus:outline-none"
        />
        <span className="text-gray font-serif italic text-[14px]">
          Shown in the member portal and on the bookings you make.
        </span>
      </label>

      <p className="text-gray m-0 font-serif italic text-[14px]">
        Signed in as <strong className="text-olive not-italic">{email}</strong>
      </p>

      <div>
        <Button type="submit" variant="primary" loading={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

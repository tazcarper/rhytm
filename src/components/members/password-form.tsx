"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { updatePassword } from "@/lib/auth/actions";
import { Alert, Button } from "@/lib/ui";

// Lets a signed-in member set (or change) a password so they can sign in
// directly next time instead of waiting for a magic link. Owns the two
// inputs + pending/error/success feedback (hence a client component); the
// write is the updatePassword server action (supabase.auth.updateUser).
// Neutral copy — works whether or not a password already exists, since
// there's no reliable client signal for "has a password set".
const MIN_PASSWORD_LENGTH = 8;

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(password);
      if (!result.ok) {
        setError(result.error ?? "Could not set your password.");
        return;
      }
      setSaved(true);
      setPassword("");
      setConfirm("");
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
        <Alert variant="success" title="Password set">
          You can now sign in with your email and password next time.
        </Alert>
      )}

      <label htmlFor="new-password" className="flex flex-col gap-1">
        <span className="font-serif text-[15px] tracking-[0.3px] text-olive">
          New password
        </span>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          className="border border-rule rounded px-3 py-2 font-serif text-[16px] focus:border-olive focus:outline-none"
        />
        <span className="text-gray font-serif italic text-[14px]">
          At least {MIN_PASSWORD_LENGTH} characters. Optional — you can always
          sign in with an emailed link instead.
        </span>
      </label>

      <label htmlFor="confirm-password" className="flex flex-col gap-1">
        <span className="font-serif text-[15px] tracking-[0.3px] text-olive">
          Confirm password
        </span>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setConfirm(event.target.value)
          }
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          className="border border-rule rounded px-3 py-2 font-serif text-[16px] focus:border-olive focus:outline-none"
        />
      </label>

      <div>
        <Button
          type="submit"
          variant="primary"
          loading={isPending}
          disabled={isPending || !password || !confirm}
        >
          {isPending ? "Saving…" : "Set password"}
        </Button>
      </div>
    </form>
  );
}

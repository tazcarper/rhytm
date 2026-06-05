"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { completeStaffProfile } from "@/app/admin/welcome/actions";

// First-sign-in onboarding: a staff member enters their full name. On success
// the admin layout's onboarding gate clears and they continue into the portal.
export function StaffWelcomeForm({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStaffProfile(name);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save your name.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      <p className="font-serif text-[16px] text-gray m-0">
        You&rsquo;re signing in as <strong>{email}</strong>. Add your name so your colleagues and
        the booking records know who&rsquo;s who.
      </p>
      <label className="block">
        <span className="block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1">
          Full name
        </span>
        <input
          className="w-full border border-rule rounded px-3 py-2 font-serif text-[16px] text-olive focus:border-olive focus:outline-none bg-paper"
          value={name}
          placeholder="Jane Doe"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>
      <div>
        <Button type="button" variant="primary" loading={isPending} onClick={submit}>
          {isPending ? "Saving…" : "Continue to the portal"}
        </Button>
      </div>
    </div>
  );
}

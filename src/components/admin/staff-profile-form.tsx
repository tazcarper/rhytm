"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { completeStaffProfile } from "@/app/admin/welcome/actions";

// Lets a staff member update their own display name from /admin/profile.
// Reuses the onboarding action (an upsert), so it works whether or not a
// profile row exists yet.
export function StaffProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await completeStaffProfile(name);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save your name.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 mt-2 max-w-md">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      <label className="block">
        <span className="block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1">
          Full name
        </span>
        <input
          className="w-full border border-rule rounded px-3 py-2 font-serif text-[16px] text-olive focus:border-olive focus:outline-none bg-paper"
          value={name}
          placeholder="Jane Doe"
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="button" variant="primary" size="sm" loading={isPending} onClick={submit}>
          {isPending ? "Saving…" : "Save name"}
        </Button>
        {saved && !isPending && (
          <span className="font-serif italic text-[13px] text-olive">Saved.</span>
        )}
      </div>
    </div>
  );
}

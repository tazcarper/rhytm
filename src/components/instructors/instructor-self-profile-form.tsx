"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { InstructorPhotoInput } from "@/src/components/admin/instructor-photo-input";
import {
  saveInstructorSelfProfileAction,
  uploadInstructorSelfPhotoAction,
} from "@/app/instructor/profile/actions";
import type { InstructorSelfProfile } from "@/src/services/instructors/self-profile";

// The instructor's own editable presentation: name, bio, photo, phone. Submits
// to saveInstructorSelfProfileAction, which resolves the current instructor and
// updates only these fields (roster controls stay admin-only).

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";

export function InstructorSelfProfileForm({
  initial,
}: {
  initial: InstructorSelfProfile;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveInstructorSelfProfileAction({
        name: name.trim(),
        bio: bio.trim() || undefined,
        photoUrl: photoUrl.trim() || "",
        phone: phone.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert variant="success" title="Saved">
          Your profile is updated.
        </Alert>
      )}

      <label className="block">
        <span className={labelCls}>Name</span>
        <input
          className={inputCls}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Bio</span>
        <textarea
          className={`${inputCls} min-h-[140px] resize-y`}
          value={bio}
          placeholder="A short guest-facing background — your experience, your style, what a lesson with you is like."
          onChange={(event) => setBio(event.target.value)}
        />
      </label>

      <InstructorPhotoInput
        label="Photo"
        value={photoUrl}
        onChange={setPhotoUrl}
        uploadAction={uploadInstructorSelfPhotoAction}
        hint="A square headshot looks best. Upload any size — we resize & compress to web-ready WebP automatically."
      />

      <label className="block">
        <span className={labelCls}>Phone</span>
        <input
          className={inputCls}
          type="tel"
          value={phone}
          placeholder="(512) 555-0100"
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>

      <div className="mt-2">
        <Button type="button" variant="primary" loading={isPending} onClick={submit}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

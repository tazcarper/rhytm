"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  createInstructor,
  inviteInstructorToPortal,
} from "@/app/admin/instructors/actions";

const labelCls =
  "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";

// Create a new instructor record (name, required email, optional phone, and the
// properties they're available for). On success the instructor shows up in the
// list below where they can be invited to the gameplan portal.
export function CreateInstructorForm({
  properties,
}: {
  properties: ReadonlyArray<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [inviteWarning, setInviteWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleProperty = (id: string) =>
    setPropertyIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  // One click does both single-purpose actions in sequence: create the
  // instructor record, then send their portal invite. If the invite can't go
  // out (e.g. the email already has an account), the instructor is still
  // created — we surface a warning and the "Send invite" button in the list
  // below stays available to retry.
  const submit = () => {
    setError(null);
    setCreated(null);
    setInviteWarning(null);
    startTransition(async () => {
      const createResult = await createInstructor({
        name,
        email,
        phone: phone || undefined,
        propertyIds,
      });
      if (!createResult.ok || !createResult.instructorId) {
        setError(createResult.error ?? "Couldn't add the instructor.");
        return;
      }

      const addedName = name.trim();
      const inviteResult = await inviteInstructorToPortal({
        instructorId: createResult.instructorId,
        email: email.trim(),
      });

      setCreated(addedName);
      if (!inviteResult.ok) {
        setInviteWarning(
          inviteResult.error ?? "The invite email couldn't be sent.",
        );
      }
      setName("");
      setEmail("");
      setPhone("");
      setPropertyIds([]);
      router.refresh();
    });
  };

  return (
    <Card padding="loose">
      <div className="font-serif font-semibold text-[18px] text-olive mb-1">
        Add an instructor
      </div>
      <p className="font-serif italic text-[14px] text-gray mt-0 mb-4">
        Creates the instructor and sends their instructor invite email. If the
        email is already in use, you can retry the invite from the list below.
      </p>

      {error && (
        <Alert variant="error" title="Couldn't add" className="mb-3">
          {error}
        </Alert>
      )}
      {created && !inviteWarning && (
        <Alert variant="success" title="Instructor added" className="mb-3">
          Added <strong>{created}</strong> and sent their instructor invite
          email.
        </Alert>
      )}
      {created && inviteWarning && (
        <Alert variant="warn" title="Added — but the invite email didn't send" className="mb-3">
          <strong>{created}</strong> was added. {inviteWarning} Use{" "}
          <strong>Send invite</strong> in the list below to retry.
        </Alert>
      )}

      <div className="flex flex-col gap-3 max-w-md">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            className={inputCls}
            value={name}
            placeholder="Jane Doe"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Email</span>
          <input
            className={inputCls}
            type="email"
            value={email}
            placeholder="instructor@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Phone (optional)</span>
          <input
            className={inputCls}
            type="tel"
            value={phone}
            placeholder="(555) 555-5555"
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <fieldset className="block border-0 p-0 m-0">
          <legend className={labelCls}>Available at</legend>
          {properties.length === 0 ? (
            <p className="font-serif italic text-[14px] text-gray">
              No properties found.
            </p>
          ) : (
            <div className="flex flex-col gap-1 mt-1">
              {properties.map((property) => (
                <label
                  key={property.id}
                  className="flex items-center gap-2 font-serif text-[15px] text-olive"
                >
                  <input
                    type="checkbox"
                    checked={propertyIds.includes(property.id)}
                    onChange={() => toggleProperty(property.id)}
                  />
                  {property.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div>
          <Button
            type="button"
            variant="primary"
            loading={isPending}
            onClick={submit}
          >
            {isPending ? "Adding…" : "Add instructor"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

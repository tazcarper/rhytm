"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { InstructorPhotoInput } from "@/src/components/admin/instructor-photo-input";
import {
  deleteInstructorAction,
  saveInstructorProfileAction,
  uploadInstructorPhotoAction,
} from "@/app/admin/instructors/actions";
import type {
  AdminDisciplineOption,
  AdminInstructorEditable,
  SaveInstructorProfileInput,
} from "@/src/services/admin/instructors";

// Admin profile editor for one instructor: name, bio, photo, active toggle,
// display order, the availability property set, and the disciplines they can
// teach. Submits SaveInstructorProfileInput to saveInstructorProfileAction;
// zod re-validates + prunes disciplines server-side. Contact (email/phone) and
// portal access are shown read-only — those are managed from the roster invite
// flow, not here.

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const sectionTitleCls = "font-serif font-semibold text-[22px] text-olive mt-7 mb-3";

export function InstructorProfileEditorForm({
  properties,
  disciplines,
  initial,
  canDelete = false,
}: {
  properties: ReadonlyArray<{ id: string; name: string }>;
  disciplines: ReadonlyArray<AdminDisciplineOption>;
  initial: AdminInstructorEditable;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [displayOrder, setDisplayOrder] = useState(String(initial.displayOrder));
  const [propertyIds, setPropertyIds] = useState<string[]>(initial.propertyIds);
  const [disciplineIds, setDisciplineIds] = useState<string[]>(initial.disciplineIds);

  const toggleProperty = (id: string) =>
    setPropertyIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const toggleDiscipline = (id: string) =>
    setDisciplineIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  // Only offer disciplines for properties currently selected above; the server
  // prunes anything left over from a deselected property on save.
  const selectedProperties = properties.filter((property) =>
    propertyIds.includes(property.id),
  );

  const submit = () => {
    setError(null);
    setSaved(false);
    const input: SaveInstructorProfileInput = {
      id: initial.id,
      name: name.trim(),
      bio: bio.trim() || undefined,
      photoUrl: photoUrl.trim() || "",
      isActive,
      displayOrder: parseInt(displayOrder, 10) || 0,
      propertyIds,
      disciplineIds,
    };

    startTransition(async () => {
      const result = await saveInstructorProfileAction(input);
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
          Profile updated.
        </Alert>
      )}

      <div className={sectionTitleCls}>Profile</div>
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
        <span className={labelCls}>Bio</span>
        <textarea
          className={`${inputCls} min-h-[140px] resize-y`}
          value={bio}
          placeholder="A short guest-facing background — experience, disciplines, what a lesson is like."
          onChange={(event) => setBio(event.target.value)}
        />
      </label>

      <InstructorPhotoInput
        label="Photo"
        value={photoUrl}
        onChange={setPhotoUrl}
        uploadAction={uploadInstructorPhotoAction}
        hint="Recommended: a square headshot, at least 800×800 px. Shown as a circle on the public page and the booking picker. Upload any size — we resize & compress to web-ready WebP automatically."
      />

      <div className={sectionTitleCls}>Availability</div>
      <fieldset className="block border-0 p-0 m-0">
        <legend className={labelCls}>Available at</legend>
        {properties.length === 0 ? (
          <p className="font-serif italic text-[14px] text-gray">No properties found.</p>
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
      <p className="font-serif italic text-[13px] text-gray m-0">
        The properties this instructor teaches at. Guests booking a private lesson at a
        selected property can choose them; their slots reflect this instructor&rsquo;s real
        availability.
      </p>

      <div className={sectionTitleCls}>Disciplines</div>
      {selectedProperties.length === 0 ? (
        <p className="font-serif italic text-[14px] text-gray">
          Select a property above to choose disciplines.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {selectedProperties.map((property) => {
            const propertyDisciplines = disciplines.filter(
              (discipline) => discipline.propertyId === property.id,
            );
            return (
              <fieldset key={property.id} className="block border-0 p-0 m-0">
                <legend className={labelCls}>{property.name}</legend>
                {propertyDisciplines.length === 0 ? (
                  <p className="font-serif italic text-[14px] text-gray">
                    No disciplines defined for {property.name} yet — add them in the catalog.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 mt-1">
                    {propertyDisciplines.map((discipline) => (
                      <label
                        key={discipline.id}
                        className="flex items-center gap-2 font-serif text-[15px] text-olive"
                      >
                        <input
                          type="checkbox"
                          checked={disciplineIds.includes(discipline.id)}
                          onChange={() => toggleDiscipline(discipline.id)}
                        />
                        {discipline.name}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      <p className="font-serif italic text-[13px] text-gray m-0">
        The disciplines this instructor is qualified to teach. Guests booking a private
        lesson see only instructors qualified for the discipline they pick. Options follow
        the properties selected above.
      </p>

      <div className={sectionTitleCls}>Visibility &amp; order</div>
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span className="font-serif text-[14px] text-olive">Active</span>
        </label>
        <label className="block w-40">
          <span className={labelCls}>Display order</span>
          <input
            className={inputCls}
            type="number"
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
          />
        </label>
      </div>
      <p className="font-serif italic text-[13px] text-gray m-0">
        Inactive instructors are hidden from the public page and the booking picker, and
        are never auto-assigned. Lower display order sorts first.
      </p>

      <div className="flex gap-3 mt-6 sticky bottom-3 items-center flex-wrap bg-paper border border-rule rounded-card px-4 py-3 shadow-[0_4px_24px_rgba(40,47,21,0.15)]">
        <Button type="button" variant="primary" loading={isPending} onClick={submit}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/instructors")}
          disabled={isPending}
        >
          Back to instructors
        </Button>
        {canDelete && (
          <button
            type="button"
            className="ml-auto font-sans text-[12px] uppercase tracking-[0.5px] text-[color:var(--error)] disabled:opacity-40"
            disabled={isPending}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete ${initial.name}? This removes their profile and portal login and can't be undone. Instructors with bookings can't be deleted — deactivate instead.`,
                )
              ) {
                return;
              }
              setError(null);
              setSaved(false);
              startTransition(async () => {
                const result = await deleteInstructorAction({ instructorId: initial.id });
                if (!result.ok) {
                  setError(result.error ?? "Couldn't delete.");
                  return;
                }
                router.push("/admin/instructors");
                router.refresh();
              });
            }}
          >
            Delete instructor
          </button>
        )}
      </div>
    </div>
  );
}

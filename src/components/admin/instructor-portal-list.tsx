"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { InstructorStatusBadges } from "@/src/components/admin/instructor-status-badges";
import type { AdminInstructorRow } from "@/src/services/admin/instructors";
import {
  inviteInstructorToPortal,
  resendInstructorInvite,
  revokeInstructorPortalAccess,
} from "@/app/admin/instructors/actions";

type ActionResult = { ok: boolean; error?: string; link?: string };

const labelCls =
  "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";

// The roster + invite controls for the instructor gameplan portal. Each row is
// self-contained: uninvited instructors get an email field + Send invite;
// invited ones get Resend link + Revoke. Mirrors the team-list UX.
export function InstructorPortalList({
  instructors,
}: {
  instructors: ReadonlyArray<AdminInstructorRow>;
}) {
  if (instructors.length === 0) {
    return (
      <Alert variant="info" title="No instructors yet">
        Add instructor records first (in the database / properties setup), then
        invite them to the gameplan portal from here.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {instructors.map((instructor) => (
        <InstructorRow key={instructor.id} instructor={instructor} />
      ))}
    </div>
  );
}

function InstructorRow({ instructor }: { instructor: AdminInstructorRow }) {
  const router = useRouter();
  const [email, setEmail] = useState(instructor.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (
    fn: () => Promise<ActionResult>,
    onOk: (result: ActionResult) => void,
  ) => {
    setError(null);
    setNotice(null);
    setLink(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onOk(result);
      router.refresh();
    });
  };

  return (
    <Card padding="default">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-serif text-[18px] text-olive">
            {instructor.name}
          </span>
          {instructor.properties.length > 0 && (
            <span className="font-sans text-[12px] uppercase tracking-[0.5px] text-gray ml-2">
              {instructor.properties.map((property) => property.name).join(" · ")}
            </span>
          )}
          {instructor.phone && (
            <span className="font-sans text-[13px] text-gray ml-2">
              {instructor.phone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/instructors/${instructor.id}`}
            className="font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep no-underline hover:text-olive"
          >
            Edit profile &rarr;
          </Link>
          <InstructorStatusBadges
            isActive={instructor.isActive}
            hasPortalAccess={instructor.hasPortalAccess}
          />
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Couldn't complete that" className="mt-3">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" title="Done" className="mt-3">
          {notice}
        </Alert>
      )}
      {link && (
        <p className="mt-2 font-sans text-[13px] text-gray break-all">
          Sign-in link:{" "}
          <a className="text-olive" href={link}>
            {link}
          </a>
        </p>
      )}

      {instructor.hasPortalAccess ? (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="font-sans text-[13px] text-gray">
            {instructor.email}
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() =>
              run(
                () => resendInstructorInvite({ instructorId: instructor.id }),
                (result) => {
                  setLink(result.link ?? null);
                  setNotice("Generated a fresh sign-in link.");
                },
              )
            }
          >
            Resend link
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() =>
              run(
                () =>
                  revokeInstructorPortalAccess({ instructorId: instructor.id }),
                () => setNotice("Portal access revoked."),
              )
            }
          >
            Revoke
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2 mt-3">
          <label className="block grow max-w-md">
            <span className={labelCls}>Email</span>
            <input
              className={inputCls}
              type="email"
              value={email}
              placeholder="instructor@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            onClick={() =>
              run(
                () =>
                  inviteInstructorToPortal({
                    instructorId: instructor.id,
                    email,
                  }),
                () => setNotice("Invite sent."),
              )
            }
          >
            Send invite
          </Button>
        </div>
      )}
    </Card>
  );
}

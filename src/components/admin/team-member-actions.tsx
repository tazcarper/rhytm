"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAFF_ROLES } from "@/lib/auth/portal";
import type { TeamMember } from "@/src/services/admin/team";
import {
  removeTeamMember,
  resendTeamInvite,
  setTeamMemberActive,
  updateTeamMemberRole,
} from "@/app/admin/team/actions";
import { ROLE_LABELS } from "./invite-team-form";

const linkCls =
  "font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep hover:text-olive disabled:opacity-40";
const dangerCls =
  "font-sans text-[12px] uppercase tracking-[0.5px] text-[color:var(--error)] disabled:opacity-40";
const fieldCls =
  "border border-rule rounded px-2 py-1 font-sans text-[12px] text-olive bg-paper focus:border-olive focus:outline-none";

// Per-row team management: edit role, deactivate/reactivate, resend a sign-in
// link, or remove. Self-management is blocked (you can't lock yourself out).
export function TeamMemberActions({
  member,
  properties,
  currentUserId,
}: {
  member: TeamMember;
  properties: ReadonlyArray<{ id: string; name: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(member.role);
  const [propertyId, setPropertyId] = useState("");
  const [resendLink, setResendLink] = useState<string | null>(null);

  if (member.userId === currentUserId) {
    return <span className="font-serif italic text-[13px] text-gray">You</span>;
  }

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  const resend = () => {
    setError(null);
    setResendLink(null);
    startTransition(async () => {
      const result = await resendTeamInvite({ userId: member.userId });
      if (!result.ok) {
        setError(result.error ?? "Couldn't generate a link.");
        return;
      }
      setResendLink(result.link ?? null);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && <span className="font-sans text-[12px] text-[color:var(--error)]">{error}</span>}

      <div className="flex gap-3 flex-wrap justify-end">
        <button type="button" className={linkCls} disabled={isPending} onClick={() => setEditing((e) => !e)}>
          Edit role
        </button>
        {member.status === "disabled" ? (
          <button
            type="button"
            className={linkCls}
            disabled={isPending}
            onClick={() => run(() => setTeamMemberActive({ userId: member.userId, active: true }))}
          >
            Reactivate
          </button>
        ) : (
          <button
            type="button"
            className={linkCls}
            disabled={isPending}
            onClick={() => run(() => setTeamMemberActive({ userId: member.userId, active: false }))}
          >
            Deactivate
          </button>
        )}
        {member.status === "invited" && (
          <button type="button" className={linkCls} disabled={isPending} onClick={resend}>
            Resend link
          </button>
        )}
        <button
          type="button"
          className={dangerCls}
          disabled={isPending}
          onClick={() => {
            if (window.confirm(`Remove ${member.fullName ?? member.email}? This deletes their access.`)) {
              run(() => removeTeamMember({ userId: member.userId }));
            }
          }}
        >
          Remove
        </button>
      </div>

      {editing && (
        <div className="flex items-center gap-2 flex-wrap justify-end mt-1">
          <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
          <select className={fieldCls} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">— no property —</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={linkCls}
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  updateTeamMemberRole({
                    userId: member.userId,
                    role,
                    propertyId: propertyId || undefined,
                  }),
                () => setEditing(false),
              )
            }
          >
            Save
          </button>
          <button type="button" className={linkCls} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      {resendLink && (
        <div className="flex items-center gap-2 mt-1 w-full max-w-[320px]">
          <input
            readOnly
            value={resendLink}
            className="flex-1 border border-rule rounded px-2 py-1 font-mono text-[11px] text-olive bg-paper"
          />
          <button
            type="button"
            className={linkCls}
            onClick={() => navigator.clipboard?.writeText(resendLink)}
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

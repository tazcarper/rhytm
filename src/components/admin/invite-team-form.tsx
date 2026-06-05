"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { STAFF_ROLES } from "@/lib/auth/portal";
import { inviteTeamMember } from "@/app/admin/team/actions";

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  property_manager: "Property manager",
  concierge: "Concierge",
  membership_coordinator: "Membership coordinator",
};

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";

export function InviteTeamForm({
  properties,
}: {
  properties: ReadonlyArray<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [propertyId, setPropertyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSentTo(null);
    startTransition(async () => {
      const result = await inviteTeamMember({
        email,
        role,
        propertyId: propertyId || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't send the invite.");
        return;
      }
      setSentTo(email);
      setEmail("");
      setPropertyId("");
      router.refresh();
    });
  };

  return (
    <Card padding="loose">
      <div className="font-serif font-semibold text-[18px] text-olive mb-1">Add a team member</div>
      <p className="font-serif italic text-[14px] text-gray mt-0 mb-4">
        They&rsquo;ll get an email invite. On first sign-in they set their name to finish.
      </p>

      {error && (
        <Alert variant="error" title="Couldn't invite" className="mb-3">
          {error}
        </Alert>
      )}
      {sentTo && (
        <Alert variant="success" title="Invite sent" className="mb-3">
          Sent an invite to <strong>{sentTo}</strong>.
        </Alert>
      )}

      <div className="flex flex-col gap-3 max-w-md">
        <label className="block">
          <span className={labelCls}>Email</span>
          <input
            className={inputCls}
            type="email"
            value={email}
            placeholder="teammate@rhythmoutdoors.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Role</span>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Property (property managers only)</span>
          <select
            className={inputCls}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">— none —</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <Button type="button" variant="primary" loading={isPending} onClick={submit}>
            {isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

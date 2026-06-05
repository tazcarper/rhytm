import { Badge, Card } from "@/lib/ui";
import type { TeamMember } from "@/src/services/admin/team";
import { ROLE_LABELS } from "./invite-team-form";
import { TeamMemberActions } from "./team-member-actions";

const STATUS_META: Record<
  TeamMember["status"],
  { label: string; variant: "open" | "draft" | "past" }
> = {
  active: { label: "Active", variant: "open" },
  invited: { label: "Invited", variant: "draft" },
  disabled: { label: "Disabled", variant: "past" },
};

// Team roster with per-row management. Props in, JSX out.
export function TeamList({
  members,
  properties,
  currentUserId,
}: {
  members: TeamMember[];
  properties: ReadonlyArray<{ id: string; name: string }>;
  currentUserId: string;
}) {
  if (members.length === 0) {
    return (
      <Card padding="loose">
        <p className="font-serif italic text-[15px] text-gray m-0">
          No team members yet. Add one above.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="loose">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-[13px]">
          <thead>
            <tr className="text-left text-gray uppercase tracking-[0.5px] text-[11px]">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const status = STATUS_META[member.status];
              return (
                <tr key={member.userId} className="border-t border-rule text-olive align-top">
                  <td className="py-2 pr-3 font-serif text-[15px]">
                    {member.fullName ?? <span className="text-gray italic">— pending —</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[12px]">{member.email}</td>
                  <td className="py-2 pr-3">{ROLE_LABELS[member.role] ?? member.role}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={status.variant} pill>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="py-2 pl-3">
                    <TeamMemberActions
                      member={member}
                      properties={properties}
                      currentUserId={currentUserId}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { Badge, Card, Eyebrow, Heading } from "@/lib/ui";
import type { MembershipForMember } from "@/src/services/members/memberships";

// One membership card: property name + tier badge header, a meta strip
// (member number / status / role), and a household footer listing the
// other people on this membership (or a "you're solo" message). The
// household is pre-filtered by the service to exclude the current user.
export function MembershipCard({
  membership,
}: {
  membership: MembershipForMember;
}) {
  return (
    <Card padding="loose">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <Heading level={3} size="h3">
          {membership.property?.name ?? "—"}
        </Heading>
        {membership.membershipTier && (
          <Badge pill variant="tierMember">
            {membership.membershipTier}
          </Badge>
        )}
      </div>
      <div className="font-sans text-[13px] text-gray tracking-[0.5px]">
        Member{" "}
        <code className="font-mono text-olive">
          #{membership.memberNumber}
        </code>
        {" · "}
        {membership.status}
        {" · "}
        your role: <em className="text-tan-deep">{membership.myRole}</em>
      </div>

      <HouseholdSection household={membership.household} />
    </Card>
  );
}

function HouseholdSection({
  household,
}: {
  household: MembershipForMember["household"];
}) {
  if (household.length === 0) {
    return (
      <p className="mt-4 font-serif italic text-[14px] text-gray">
        You are the only person on this membership.
      </p>
    );
  }
  return (
    <div className="mt-5 pt-5 border-t border-rule">
      <Eyebrow as="div" className="mb-2">
        Also on this membership
      </Eyebrow>
      <ul className="m-0 pl-5 text-[14px] text-olive">
        {household.map((member) => (
          <li key={member.role + member.email}>
            {member.firstName} {member.lastName}{" "}
            <code className="font-mono text-gray text-[0.85em]">
              ({member.email})
            </code>{" "}
            &middot; <em className="text-tan-deep">{member.role}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminMemberDetail } from "@/src/services/admin/members";
import { MembershipStatusBadge } from "@/src/components/admin/membership-status-badge";
import { MemberBookings } from "@/src/components/admin/member-bookings";
import { PropertyPill } from "@/src/components/admin/property-pill";
import s from "@/src/components/admin/member-detail.module.css";
import tableStyles from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function AdminMemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const member = await getAdminMemberDetail(supabase, id);

  if (!member) {
    notFound();
  }

  const name =
    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
    member.email ||
    "Member";
  // The self-entered display override, shown beneath the official name when
  // it's set and actually different.
  const goesBy =
    member.displayName && member.displayName !== name
      ? member.displayName
      : null;
  const contact = [member.email, member.phone].filter(Boolean).join(" · ");

  return (
    <PageShell width="xl">
      <div className={s.header}>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Members", href: "/admin/members" },
            { label: name },
          ]}
        />
        <div className={s.titleRow}>
          <Heading level={1} size="h2" underline>
            {name}
          </Heading>
          <span className={s.loginTag}>
            {member.hasLogin ? "Has login" : "No login"}
          </span>
        </div>
        {goesBy && <p className={s.alias}>Goes by “{goesBy}”</p>}
        {contact && <p className={s.memberNumber}>{contact}</p>}
      </div>

      <div className={s.sections}>
        <Card padding="loose" elevation="soft">
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Memberships</h2>
            <span className={s.sectionCount}>
              {member.memberships.length}{" "}
              {member.memberships.length === 1 ? "property" : "properties"}
            </span>
          </div>
          {member.memberships.length === 0 ? (
            <p className={s.emptyNote}>No memberships.</p>
          ) : (
            <div className={tableStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Member #</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Household</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {member.memberships.map((membership) => (
                    <tr key={membership.membershipId}>
                      <td>
                        <PropertyPill
                          name={membership.propertyName}
                          slug={membership.propertySlug}
                        />
                      </td>
                      <td className={s.memberNumber}>
                        #{membership.memberNumber}
                      </td>
                      <td>
                        <MembershipStatusBadge status={membership.status} />
                      </td>
                      <td className={s.roleCell}>{membership.role}</td>
                      <td className={s.joinedCell}>
                        {membership.householdSize}{" "}
                        {membership.householdSize === 1 ? "person" : "people"}
                      </td>
                      <td className={s.joinedCell}>
                        {formatDateOnly(membership.joinedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Bookings</h2>
            <span className={s.sectionCount}>{member.bookings.length}</span>
          </div>
          <MemberBookings bookings={member.bookings} />
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Adventure RSVPs</h2>
            <span className={s.sectionCount}>{member.rsvps.length}</span>
          </div>
          {member.rsvps.length === 0 ? (
            <p className={s.emptyNote}>No RSVPs yet.</p>
          ) : (
            <div className={tableStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Adventure</th>
                    <th>Date</th>
                    <th>Guests</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {member.rsvps.map((rsvp) => (
                    <tr key={rsvp.id}>
                      <td>{rsvp.adventureTitle}</td>
                      <td>{formatDateOnly(rsvp.startDate)}</td>
                      <td>{rsvp.guestCount}</td>
                      <td className={s.rsvpStatus}>{rsvp.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

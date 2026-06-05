import { Badge } from "@/lib/ui";
import { getDevJunctionRows } from "../_lib/queries";
import { formatTimestamp } from "../_lib/format";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Read-only table of the latest membership_people junction rows.
export async function JunctionRowsSection() {
  const junction = await getDevJunctionRows();

  return (
    <DevSection
      title="Recent membership_people rows (latest 30)"
      description="One row per junction entry. A single person on multiple memberships shows multiple rows, sharing the same email."
    >
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Linked?</th>
              <th>Property</th>
              <th>Member #</th>
              <th>Role</th>
              <th>Invited</th>
              <th>Accepted</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {junction.map((row) => {
              const person = pickOne(row.people);
              const membership = pickOne(row.memberships);
              const property = membership ? pickOne(membership.properties) : null;
              return (
                <tr key={row.id}>
                  <td>{person?.email ?? "—"}</td>
                  <td>
                    {person?.user_id ? (
                      <Badge variant="open">Yes</Badge>
                    ) : (
                      <Badge variant="draft">Pending</Badge>
                    )}
                  </td>
                  <td>{property?.name ?? "—"}</td>
                  <td>
                    <code className={s.code}>{membership?.member_number ?? "—"}</code>
                  </td>
                  <td>{row.role}</td>
                  <td>
                    <code className={s.code}>{formatTimestamp(person?.invited_at)}</code>
                  </td>
                  <td>
                    <code className={s.code}>{formatTimestamp(person?.invite_accepted_at)}</code>
                  </td>
                  <td>
                    <code className={s.code}>{formatTimestamp(person?.invite_expires_at)}</code>
                  </td>
                </tr>
              );
            })}
            {junction.length === 0 && (
              <tr>
                <td colSpan={8} className={s.tableEmpty}>
                  No junction rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DevSection>
  );
}

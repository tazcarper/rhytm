import { createServiceRoleClient } from "@/lib/supabase/service";
import type {
  OrgDivision,
  OrgSeat,
  OrgSeatStatus,
} from "@/src/types/accountability";

// Chart-of-Accountability reads. Service-role only — org_seats has no RLS
// policies (deny-by-default); callers are gated in app code (the /admin proxy
// + hasAdminAccess). Mirrors the staff_profiles access model.

interface OrgSeatRow {
  id: string;
  name: string | null;
  title: string;
  division: string;
  accountabilities: string[] | null;
  status: string;
  email: string | null;
  phone: string | null;
  parent_id: string | null;
  sort_order: number;
}

function toSeat(row: OrgSeatRow): OrgSeat {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    division: row.division as OrgDivision,
    accountabilities: row.accountabilities ?? [],
    status: row.status as OrgSeatStatus,
    email: row.email,
    phone: row.phone,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
  };
}

export async function getOrgSeats(): Promise<OrgSeat[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("org_seats")
    .select(
      "id, name, title, division, accountabilities, status, email, phone, parent_id, sort_order",
    )
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map(toSeat);
}

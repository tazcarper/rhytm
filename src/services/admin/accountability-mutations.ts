import { createServiceRoleClient } from "@/lib/supabase/service";
import type { OrgDivision, OrgSeatStatus } from "@/src/types/accountability";

// Chart-of-Accountability writes. Service-role only; callers MUST be gated by
// canManageTeam in the server action layer (org_seats is deny-by-default RLS).

export interface SeatInput {
  name: string | null;
  title: string;
  division: OrgDivision;
  accountabilities: string[];
  status: OrgSeatStatus;
  email: string | null;
  phone: string | null;
  parentId: string | null;
}

type MutationResult = { ok: boolean; error?: string };

export async function createSeat(input: SeatInput): Promise<MutationResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("org_seats").insert({
    name: input.name,
    title: input.title,
    division: input.division,
    accountabilities: input.accountabilities,
    status: input.status,
    email: input.email,
    phone: input.phone,
    parent_id: input.parentId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeat(id: string, input: SeatInput): Promise<MutationResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("org_seats")
    .update({
      name: input.name,
      title: input.title,
      division: input.division,
      accountabilities: input.accountabilities,
      status: input.status,
      email: input.email,
      phone: input.phone,
      parent_id: input.parentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeat(id: string): Promise<MutationResult> {
  const admin = createServiceRoleClient();

  // Re-parent the deleted seat's reports to its own manager so the reporting
  // chain stays intact, rather than orphaning them up to the apex.
  const { data: seat } = await admin
    .from("org_seats")
    .select("parent_id")
    .eq("id", id)
    .maybeSingle();
  await admin
    .from("org_seats")
    .update({ parent_id: seat?.parent_id ?? null })
    .eq("parent_id", id);

  const { error } = await admin.from("org_seats").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

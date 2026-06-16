"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageTeam } from "@/lib/auth/portal";
import {
  createSeat,
  updateSeat,
  deleteSeat,
  type SeatInput,
} from "@/src/services/admin/accountability-mutations";

const DIVISIONS = [
  "ownership",
  "executive",
  "central",
  "media",
  "hogheaven",
  "horseshoebay",
  "packsaddle",
] as const;
const STATUSES = ["active", "open", "hopeful"] as const;

const SeatSchema = z.object({
  name: z.string().trim().max(120).nullable(),
  title: z.string().trim().min(1, "A title is required.").max(160),
  division: z.enum(DIVISIONS),
  accountabilities: z.array(z.string().trim().min(1)).max(8),
  status: z.enum(STATUSES),
  email: z.string().trim().max(160).nullable(),
  phone: z.string().trim().max(40).nullable(),
  parentId: z.string().uuid().nullable(),
});

type ActionResult = { ok: boolean; error?: string };

// Every write re-checks the caller can manage the team — org_seats is
// deny-by-default RLS, but the server action is the real authorization gate.
async function requireManager(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return canManageTeam(user?.app_metadata?.role as string | undefined);
}

function normalize(input: z.infer<typeof SeatSchema>): SeatInput {
  return {
    name: input.name && input.name.length > 0 ? input.name : null,
    title: input.title,
    division: input.division,
    accountabilities: input.accountabilities,
    status: input.status,
    email: input.email && input.email.length > 0 ? input.email : null,
    phone: input.phone && input.phone.length > 0 ? input.phone : null,
    parentId: input.parentId,
  };
}

export async function createSeatAction(raw: unknown): Promise<ActionResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "You don't have permission to edit the chart." };
  }
  const parsed = SeatSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the seat details." };
  }
  const result = await createSeat(normalize(parsed.data));
  if (!result.ok) return { ok: false, error: "Couldn't add the seat." };
  revalidatePath("/admin/accountability");
  return { ok: true };
}

export async function updateSeatAction(id: string, raw: unknown): Promise<ActionResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "You don't have permission to edit the chart." };
  }
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "That seat no longer exists." };
  }
  const parsed = SeatSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the seat details." };
  }
  if (parsed.data.parentId === id) {
    return { ok: false, error: "A seat can't report to itself." };
  }
  const result = await updateSeat(id, normalize(parsed.data));
  if (!result.ok) return { ok: false, error: "Couldn't save the seat." };
  revalidatePath("/admin/accountability");
  return { ok: true };
}

export async function deleteSeatAction(id: string): Promise<ActionResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "You don't have permission to edit the chart." };
  }
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "That seat no longer exists." };
  }
  const result = await deleteSeat(id);
  if (!result.ok) return { ok: false, error: "Couldn't remove the seat." };
  revalidatePath("/admin/accountability");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createMemberRsvp, type CreateRsvpResult } from "@/src/services/members/rsvps";

// Reserve an adventure from the public detail page. Sign-up lives here
// (not the member portal); only a member with an active membership at the
// adventure's property can succeed — enforced by the member's own RLS
// (rsvps: member insert own) + the capacity trigger downstream. Thin:
// validate → service → revalidate the member's "my trips" list. The
// detail page itself refreshes client-side via the form's router.refresh().

const RsvpInputSchema = z.object({
  adventureId: z.string().uuid(),
  membershipId: z.string().uuid(),
  guestCount: z.number().int().positive().max(50),
});

export type RsvpActionInput = z.infer<typeof RsvpInputSchema>;

export async function createRsvpAction(
  input: RsvpActionInput,
): Promise<CreateRsvpResult> {
  const parsed = RsvpInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "unknown", message: "Please check your reservation details and try again." };
  }

  const supabase = await createServerSupabaseClient();
  const result = await createMemberRsvp(supabase, parsed.data);

  if (result.ok) {
    revalidatePath("/member/adventures");
    revalidatePath(`/adventures/${parsed.data.adventureId}`);
  }
  return result;
}

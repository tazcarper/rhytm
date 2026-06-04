"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Mint / revoke the shareable trip token for App 4.5. Member-gated; the
// RLS-scoped read proves the caller's household owns the booking, then the
// service role writes (members have no booking UPDATE policy — same pattern
// as the adventure cancel/release actions). Mint is idempotent (reuses an
// existing token so re-sharing doesn't break prior links) and only succeeds
// once the trip is finalized (bid signed + deposit paid).

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

interface BookingGateRow {
  id: string;
  share_token: string | null;
  deposit_amount: string | number | null;
  amount_paid: string | number | null;
  bids: { signed_at: string | null } | { signed_at: string | null }[] | null;
}

function isFinalized(row: BookingGateRow): boolean {
  const bid = Array.isArray(row.bids) ? row.bids[0] : row.bids;
  const deposit = row.deposit_amount == null ? null : Number(row.deposit_amount);
  const paid = row.amount_paid == null ? 0 : Number(row.amount_paid);
  return !!bid?.signed_at && deposit !== null && paid >= deposit;
}

export async function mintShareLink(input: {
  bookingId: string;
  note?: string;
}): Promise<{ ok: boolean; token?: string; message?: string }> {
  const parsed = z
    .object({ bookingId: z.string().uuid(), note: z.string().max(500).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check your request." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in to share your trip." };
  }

  // RLS scopes this to the caller's household; also pull the finalized-gate
  // fields so we never mint a link for an unconfirmed trip.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, share_token, deposit_amount, amount_paid, bids ( signed_at )")
    .eq("id", parsed.data.bookingId)
    .maybeSingle<BookingGateRow>();
  if (!booking) return { ok: false, message: "We couldn't find that booking." };
  if (!isFinalized(booking)) {
    return { ok: false, message: "You can share once the trip is signed and the deposit is paid." };
  }

  const token = booking.share_token ?? newToken();
  const trimmed = parsed.data.note?.trim();
  const note = trimmed ? trimmed.slice(0, 500) : null;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("bookings")
    .update({ share_token: token, share_note: note })
    .eq("id", parsed.data.bookingId);
  if (error) return { ok: false, message: "Couldn't create the link — try again." };

  revalidatePath(`/member/bookings/${parsed.data.bookingId}`);
  return { ok: true, token };
}

export async function revokeShareLink(input: {
  bookingId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ bookingId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check your request." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in to manage sharing." };
  }

  // Ownership check via RLS (household read).
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, message: "We couldn't find that booking." };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("bookings")
    .update({ share_token: null }) // keep share_note; a fresh mint gets a new token
    .eq("id", parsed.data.bookingId);
  if (error) return { ok: false, message: "Couldn't revoke the link — try again." };

  revalidatePath(`/member/bookings/${parsed.data.bookingId}`);
  return { ok: true };
}

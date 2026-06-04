import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAdventureDetails,
  type AdventureDetails,
  type AdventureStatus,
} from "@/src/services/adventures/display";
import { parseGuestManifest } from "@/src/services/adventures/guest-manifest";

// Admin-side adventures queries. Use the caller's RLS-scoped client:
// admins see every property, property managers only their own (the
// Phase 5 "adventures: admin/property_manager read" + "rsvps: admin read /
// property_manager read" policies). The roster is for staff to see who's
// booked / requested.

export type AdventurePaymentMode = "instant" | "deposit" | "inquire";

function toNum(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}
function toOptNum(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface AdminAdventureListRow {
  id: string;
  title: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  status: AdventureStatus;
  paymentMode: string;
  maxCapacity: number;
  occupied: number; // confirmed + pending guest_count
  requested: number; // open inquire leads
  price: number;
}

export async function getAdminAdventuresList(
  supabase: SupabaseClient,
): Promise<AdminAdventureListRow[]> {
  const { data: rows, error } = await supabase
    .from("member_adventures")
    .select("id, title, start_date, end_date, status, payment_mode, max_capacity, price, properties ( name )")
    .order("start_date", { ascending: true });
  if (error || !rows) return [];

  const ids = rows.map((r) => r.id as string);
  const occupied = new Map<string, number>();
  const requested = new Map<string, number>();
  if (ids.length) {
    const { data: rsvps } = await supabase
      .from("member_adventure_rsvps")
      .select("adventure_id, guest_count, status")
      .in("adventure_id", ids)
      .in("status", ["confirmed", "pending_payment", "requested"]);
    for (const r of rsvps ?? []) {
      if (r.status === "requested") {
        requested.set(r.adventure_id, (requested.get(r.adventure_id) ?? 0) + 1);
      } else {
        occupied.set(r.adventure_id, (occupied.get(r.adventure_id) ?? 0) + r.guest_count);
      }
    }
  }

  return rows.map((r): AdminAdventureListRow => {
    const property = pickOne(r.properties as { name: string } | { name: string }[] | null);
    return {
      id: r.id,
      title: r.title,
      propertyName: property?.name ?? "—",
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status as AdventureStatus,
      paymentMode: r.payment_mode,
      maxCapacity: r.max_capacity,
      occupied: occupied.get(r.id) ?? 0,
      requested: requested.get(r.id) ?? 0,
      price: toNum(r.price),
    };
  });
}

export interface AdminAdventureEditable {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  maxGuestsPerRsvp: number;
  price: number;
  guestPrice: number | null;
  depositAmount: number | null;
  freeCancellationDays: number;
  paymentMode: AdventurePaymentMode;
  status: AdventureStatus;
  isManuallySoldOut: boolean;
  details: AdventureDetails;
}

export async function getAdminAdventure(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminAdventureEditable | null> {
  const { data, error } = await supabase
    .from("member_adventures")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;

  const mode = data.payment_mode;
  return {
    id: data.id,
    propertyId: data.property_id,
    title: data.title,
    description: data.description ?? "",
    startDate: data.start_date,
    endDate: data.end_date,
    maxCapacity: data.max_capacity,
    maxGuestsPerRsvp: data.max_guests_per_rsvp,
    price: toNum(data.price),
    guestPrice: toOptNum(data.guest_price),
    depositAmount: toOptNum(data.deposit_amount),
    freeCancellationDays: data.free_cancellation_days ?? 14,
    paymentMode: mode === "deposit" || mode === "inquire" ? mode : "instant",
    status: data.status as AdventureStatus,
    isManuallySoldOut: data.is_manually_sold_out,
    details: parseAdventureDetails(data.details),
  };
}

export interface AdventureRosterRow {
  rsvpId: string;
  guestName: string;
  memberNumber: string;
  status: string;
  guestCount: number;
  guestNames: string[]; // additional guests in the party (the manifest)
  amountPaid: number | null;
  createdAt: string;
}

export async function getAdventureRoster(
  supabase: SupabaseClient,
  adventureId: string,
): Promise<AdventureRosterRow[]> {
  const { data: rsvps } = await supabase
    .from("member_adventure_rsvps")
    .select("id, status, guest_count, guests, amount_paid, created_at, created_by_person_id, membership_id")
    .eq("adventure_id", adventureId)
    .order("created_at", { ascending: true });
  if (!rsvps?.length) return [];

  const personIds = Array.from(
    new Set(rsvps.map((r) => r.created_by_person_id).filter((v): v is string => !!v)),
  );
  const membershipIds = Array.from(
    new Set(rsvps.map((r) => r.membership_id).filter((v): v is string => !!v)),
  );

  const [peopleRes, membershipsRes] = await Promise.all([
    personIds.length
      ? supabase.from("people").select("id, first_name, last_name").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
    membershipIds.length
      ? supabase.from("memberships").select("id, member_number").in("id", membershipIds)
      : Promise.resolve({ data: [] as { id: string; member_number: string }[] }),
  ]);

  const personMap = new Map((peopleRes.data ?? []).map((p) => [p.id, p]));
  const memberMap = new Map((membershipsRes.data ?? []).map((m) => [m.id, m.member_number]));

  return rsvps.map((r): AdventureRosterRow => {
    const person = r.created_by_person_id ? personMap.get(r.created_by_person_id) : null;
    const name = person
      ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "—"
      : "—";
    return {
      rsvpId: r.id,
      guestName: name,
      memberNumber: r.membership_id ? memberMap.get(r.membership_id) ?? "—" : "—",
      status: r.status,
      guestCount: r.guest_count,
      guestNames: parseGuestManifest(r.guests).map((g) => g.name),
      amountPaid: toOptNum(r.amount_paid),
      createdAt: r.created_at,
    };
  });
}

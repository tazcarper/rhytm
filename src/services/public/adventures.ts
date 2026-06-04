import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAdventureDetails,
  type AdventureSection,
  type AdventureStatus,
} from "@/src/services/adventures/display";

// Public read for the homepage showcase + /adventures/[id] detail page.
// Adventures are members-only at the RLS layer, so the public surface
// reads through the SECURITY DEFINER RPC public_member_adventures(p_id),
// which returns only published/sold_out rows (no PII) to anon AND
// authenticated callers alike — so a logged-in member sees the same full
// cross-property set on the homepage as an anonymous visitor (their
// normal RLS would otherwise scope them to their own properties).

export type AdventurePaymentMode = "instant" | "deposit" | "inquire";

export interface PublicAdventure {
  id: string;
  title: string;
  description: string | null;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;
  propertyId: string;
  propertyName: string;
  pricing: { price: number; guestPrice: number | null; maxGuestsPerRsvp: number };
  paymentMode: AdventurePaymentMode;
  depositAmount: number | null;
  freeCancellationDays: number;
  isSoldOut: boolean;
  comingSoon: boolean;
  category: string | null;
  location: string | null;
  durationLabel: string | null;
  datesLabel: string | null;
  priceLabel: string | null;
  capacityLabel: string | null;
  badge: string | null;
  heroImage: string | null;
  gallery: string[];
  attributes: string[];
  highlights: string[];
  sections: AdventureSection[];
}

export interface PublicAdventuresResult {
  data: PublicAdventure[] | null;
  error: { message: string } | null;
}

interface PublicAdventureRpcRow {
  id: string;
  property_id: string;
  property_name: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  max_guests_per_rsvp: number;
  price: string | number | null;
  guest_price: string | number | null;
  deposit_amount: string | number | null;
  payment_mode: string;
  free_cancellation_days: number;
  status: AdventureStatus;
  is_manually_sold_out: boolean;
  details: unknown;
}

function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

function toOptionalNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

function normalize(row: PublicAdventureRpcRow): PublicAdventure {
  const details = parseAdventureDetails(row.details);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    propertyId: row.property_id,
    propertyName: row.property_name,
    pricing: {
      price: toNumber(row.price),
      guestPrice: toOptionalNumber(row.guest_price),
      maxGuestsPerRsvp: row.max_guests_per_rsvp,
    },
    paymentMode:
      row.payment_mode === "deposit" || row.payment_mode === "inquire"
        ? row.payment_mode
        : "instant",
    depositAmount: toOptionalNumber(row.deposit_amount),
    freeCancellationDays: row.free_cancellation_days ?? 14,
    isSoldOut: row.status === "sold_out" || row.is_manually_sold_out,
    comingSoon: details.comingSoon ?? false,
    category: details.category ?? null,
    location: details.location ?? null,
    durationLabel: details.durationLabel ?? null,
    datesLabel: details.datesLabel ?? null,
    priceLabel: details.priceLabel ?? null,
    capacityLabel: details.capacityLabel ?? null,
    badge: details.badge ?? null,
    heroImage: details.heroImage ?? null,
    gallery: details.gallery ?? [],
    attributes: details.attributes ?? [],
    highlights: details.highlights ?? [],
    sections: details.sections ?? [],
  };
}

export async function getPublicAdventures(
  supabase: SupabaseClient,
): Promise<PublicAdventuresResult> {
  const { data, error } = await supabase.rpc("public_member_adventures");
  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return {
    data: (data as PublicAdventureRpcRow[]).map(normalize),
    error: null,
  };
}

export async function getPublicAdventure(
  supabase: SupabaseClient,
  id: string,
): Promise<PublicAdventure | null> {
  const { data, error } = await supabase.rpc("public_member_adventures", {
    p_id: id,
  });
  if (error || !data || (data as PublicAdventureRpcRow[]).length === 0) {
    return null;
  }
  return normalize((data as PublicAdventureRpcRow[])[0]);
}

// Staff preview: read an adventure of ANY status (draft, etc.) directly,
// bypassing the published-only public RPC. RLS still scopes it (admins see
// all, property managers their own). Used by the public detail page when a
// staff viewer follows the admin "View public page" link before publishing.
export async function getAdventureForPreview(
  supabase: SupabaseClient,
  id: string,
): Promise<PublicAdventure | null> {
  const { data, error } = await supabase
    .from("member_adventures")
    .select(
      "id, property_id, title, description, start_date, end_date, max_capacity, max_guests_per_rsvp, price, guest_price, deposit_amount, payment_mode, free_cancellation_days, status, is_manually_sold_out, details, properties ( name )",
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const property = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  return normalize({
    ...data,
    property_name: property?.name ?? "—",
  } as unknown as PublicAdventureRpcRow);
}

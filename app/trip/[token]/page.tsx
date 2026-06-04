import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getSharedTrip } from "@/src/services/public/shared-trip";
import { SharedTripView } from "@/src/components/public/shared-trip-view";

export const dynamic = "force-dynamic";

// Private bearer link — never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Anonymous, read-only shared trip view (App 4.5). Reads via service role
// (no session) — the getSharedTrip service applies the column allowlist +
// the finalized gate, and returns null for an unknown/unfinalized/revoked
// token, which we render as a 404.
export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createServiceRoleClient();
  const trip = await getSharedTrip(admin, token);
  if (!trip) notFound();
  return <SharedTripView trip={trip} />;
}

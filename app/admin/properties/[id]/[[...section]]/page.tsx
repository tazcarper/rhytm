import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import { getPropertyCatalog } from "@/src/services/admin/catalog";
import { getPropertyCatering } from "@/src/services/admin/catering";
import { getEstimateGuestFees } from "@/src/services/admin/estimate-guest-fees";
import { PropertyWorkspace } from "@/src/components/admin/property-workspace";

export const dynamic = "force-dynamic";

// One server load serves every section of a property (Basics / Experiences /
// Add-ons / Catering / Guest fees). The requested section + open item live in
// the catch-all URL but are read client-side by the workspace, so they don't
// need to change what we fetch here — we always hand over the full picture.
export default async function PropertyWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const property = await getAdminPropertyById(supabase, id);
  if (!property) notFound();

  const [catalog, cateringOptions, guestFeeBands] = await Promise.all([
    getPropertyCatalog(supabase, property.id),
    getPropertyCatering(supabase, property.id),
    getEstimateGuestFees(supabase, property.id),
  ]);

  return (
    <PropertyWorkspace
      property={property}
      catalog={catalog}
      cateringOptions={cateringOptions}
      guestFeeBands={guestFeeBands}
    />
  );
}

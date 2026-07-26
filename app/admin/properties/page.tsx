import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert } from "@/lib/ui";
import { getAdminPropertiesList } from "@/src/services/admin/properties";

export const dynamic = "force-dynamic";

// The index has no UI of its own — it sends you straight into the first
// property's workspace. The shared header + rail come from the layout.
export default async function AdminPropertiesPage() {
  const supabase = await createServerSupabaseClient();

  let firstPropertySlug: string | null = null;
  let loadError: string | null = null;
  try {
    const properties = await getAdminPropertiesList(supabase);
    firstPropertySlug = properties[0]?.slug ?? null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load properties";
  }

  if (firstPropertySlug) {
    redirect(`/admin/properties/${firstPropertySlug}`);
  }

  if (loadError) {
    return (
      <Alert variant="error" title="Could not load properties">
        {loadError}
      </Alert>
    );
  }

  return (
    <Alert variant="warn" title="No properties found">
      Seed the properties table to see the settings.
    </Alert>
  );
}

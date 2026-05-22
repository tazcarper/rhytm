import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminPropertiesList,
  type AdminProperty,
} from "@/src/services/admin/properties";
import { PropertySettingsForm } from "@/src/components/admin/property-settings-form";
import s from "./properties-page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const supabase = await createServerSupabaseClient();

  let properties: AdminProperty[] = [];
  let loadError: string | null = null;
  try {
    properties = await getAdminPropertiesList(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load properties";
  }

  return (
    <PageShell width="xl">
      <div className={s.header}>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Properties" },
          ]}
        />
        <Heading level={1} size="h2" underline>
          Property Settings
        </Heading>
        <Text variant="lead" className={s.lead}>
          Per-property knobs: booking horizon, capacity, tagline, support contact.
          Changes save per card and apply immediately.
        </Text>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load properties">
          {loadError}
        </Alert>
      )}

      {properties.length === 0 && !loadError && (
        <Alert variant="warn" title="No properties found">
          Seed the properties table to see the settings cards.
        </Alert>
      )}

      <div className={s.grid}>
        {properties.map((property) => (
          <PropertySettingsForm key={property.id} property={property} />
        ))}
      </div>
    </PageShell>
  );
}

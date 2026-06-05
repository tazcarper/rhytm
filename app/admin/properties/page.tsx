import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminPropertiesList,
  type AdminProperty,
} from "@/src/services/admin/properties";
import { PropertiesWorkspace } from "@/src/components/admin/properties-workspace";
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
          Pick a property, then edit its booking rules, public info, and pre-visit details. Changes
          save per property and apply immediately.
        </Text>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load properties">
          {loadError}
        </Alert>
      )}

      {properties.length === 0 && !loadError && (
        <Alert variant="warn" title="No properties found">
          Seed the properties table to see the settings.
        </Alert>
      )}

      {properties.length > 0 && <PropertiesWorkspace properties={properties} />}
    </PageShell>
  );
}

import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import { getCatalogAddOn } from "@/src/services/admin/catalog";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { AddOnEditorForm } from "@/src/components/admin/add-on-editor-form";
import s from "@/src/components/admin/catalog.module.css";

export const dynamic = "force-dynamic";

export default async function AddOnEditPage({
  params,
}: {
  params: Promise<{ id: string; addOnId: string }>;
}) {
  const { id, addOnId } = await params;
  const supabase = await createServerSupabaseClient();

  const [property, addOn] = await Promise.all([
    getAdminPropertyById(supabase, id),
    getCatalogAddOn(supabase, addOnId),
  ]);

  if (!property || !addOn || addOn.propertyId !== property.id) {
    notFound();
  }

  return (
    <PageShell width="xl">
      <div className={s.shellHeader}>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Properties", href: "/admin/properties" },
            {
              label: property.name,
              href: `/admin/properties/${property.id}/catalog`,
            },
            {
              label: "Catalog",
              href: `/admin/properties/${property.id}/catalog`,
            },
            { label: addOn.name },
          ]}
        />
        <Heading level={1} size="h2" underline>
          Edit add-on
        </Heading>
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <AddOnEditorForm
          propertyId={property.id}
          propertySlug={property.slug}
          addOn={addOn}
        />
      </div>
    </PageShell>
  );
}

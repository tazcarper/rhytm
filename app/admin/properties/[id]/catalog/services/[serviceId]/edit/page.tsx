import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import {
  getCatalogService,
  getPropertyCatalog,
} from "@/src/services/admin/catalog";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { ServiceEditorForm } from "@/src/components/admin/service-editor-form";
import s from "@/src/components/admin/catalog.module.css";

export const dynamic = "force-dynamic";

export default async function ServiceEditPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const { id, serviceId } = await params;
  const supabase = await createServerSupabaseClient();

  const [property, service] = await Promise.all([
    getAdminPropertyById(supabase, id),
    getCatalogService(supabase, serviceId),
  ]);

  if (!property || !service || service.propertyId !== property.id) {
    notFound();
  }

  const catalog = await getPropertyCatalog(supabase, property.id);
  const availableAddOns = catalog.addOns.filter((addOn) => addOn.isActive);
  const initialLinkedAddOnIds = catalog.links
    .filter((link) => link.serviceId === serviceId)
    .map((link) => link.addOnId);

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
            { label: service.name },
          ]}
        />
        <Heading level={1} size="h2" underline>
          Edit service
        </Heading>
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <ServiceEditorForm
          propertyId={property.id}
          propertySlug={property.slug}
          service={service}
          availableAddOns={availableAddOns}
          initialLinkedAddOnIds={initialLinkedAddOnIds}
        />
      </div>
    </PageShell>
  );
}

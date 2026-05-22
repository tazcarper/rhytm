import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import { getPropertyCatalog } from "@/src/services/admin/catalog";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CatalogServicesPanel } from "@/src/components/admin/catalog-services-panel";
import { CatalogAddOnsPanel } from "@/src/components/admin/catalog-add-ons-panel";
import s from "@/src/components/admin/catalog.module.css";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const property = await getAdminPropertyById(supabase, id);
  if (!property) notFound();

  const catalog = await getPropertyCatalog(supabase, property.id);

  return (
    <PageShell width="xl">
      <div className={s.shellHeader}>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Properties", href: "/admin/properties" },
            { label: property.name },
            { label: "Catalog" },
          ]}
        />
        <div className={s.shellHeaderRow}>
          <Heading level={1} size="h2" underline>
            {property.name} catalog
          </Heading>
        </div>
        <Text variant="lead">
          Services and add-ons offered at this property. Public booking funnel
          reads these on every visit — active items appear, inactive ones
          don&rsquo;t. Edit a service to choose which add-ons are available
          for it.
        </Text>
      </div>

      <div className={s.twoCol}>
        <CatalogServicesPanel
          propertyId={property.id}
          propertySlug={property.slug}
          services={catalog.services}
          links={catalog.links}
        />
        <CatalogAddOnsPanel
          propertyId={property.id}
          propertySlug={property.slug}
          addOns={catalog.addOns}
          links={catalog.links}
          services={catalog.services}
        />
      </div>
    </PageShell>
  );
}

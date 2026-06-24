import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import { getPropertyCatalog } from "@/src/services/admin/catalog";
import { getPropertyCatering } from "@/src/services/admin/catering";
import { getEstimateGuestFees } from "@/src/services/admin/estimate-guest-fees";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CatalogServicesPanel } from "@/src/components/admin/catalog-services-panel";
import { CatalogAddOnsPanel } from "@/src/components/admin/catalog-add-ons-panel";
import { CatalogCateringPanel } from "@/src/components/admin/catalog-catering-panel";
import { EstimateGuestFeesEditor } from "@/src/components/admin/estimate-guest-fees-editor";
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

  const [catalog, cateringOptions, guestFeeBands] = await Promise.all([
    getPropertyCatalog(supabase, property.id),
    getPropertyCatering(supabase, property.id),
    getEstimateGuestFees(supabase, property.id),
  ]);

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
          Experiences, add-ons, the guest-fee schedule, and catering offered at
          this property. The public Request-an-Estimate page and booking funnel
          read these on every visit — active items appear, inactive ones
          don&rsquo;t. Edit an experience to set its estimate pricing and which
          add-ons attach to it.
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

      <div className={s.twoCol} style={{ marginTop: "var(--space-6)" }}>
        <EstimateGuestFeesEditor
          propertyId={property.id}
          propertySlug={property.slug}
          bands={guestFeeBands}
        />
        <CatalogCateringPanel
          propertyId={property.id}
          propertySlug={property.slug}
          options={cateringOptions}
        />
      </div>
    </PageShell>
  );
}

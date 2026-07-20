import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { PromotionEditorForm } from "@/src/components/admin/promotion-editor-form";

export const dynamic = "force-dynamic";

export default async function NewPromotionPage() {
  const supabase = await createServerSupabaseClient();
  const properties = await getAdminPropertiesList(supabase);

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Promotions", href: "/admin/promotions" },
          { label: "New" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        New promotion
      </Heading>
      <PromotionEditorForm
        promotion={null}
        properties={properties.map((property) => ({
          id: property.id,
          name: property.name,
        }))}
      />
    </PageShell>
  );
}

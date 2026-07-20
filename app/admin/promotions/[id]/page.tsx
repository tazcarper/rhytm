import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getPromotion } from "@/src/services/admin/promotions";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { PromotionEditorForm } from "@/src/components/admin/promotion-editor-form";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [promotion, properties] = await Promise.all([
    getPromotion(supabase, id),
    getAdminPropertiesList(supabase),
  ]);

  if (!promotion) {
    notFound();
  }

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Promotions", href: "/admin/promotions" },
          { label: promotion.title },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Edit promotion
      </Heading>
      <PromotionEditorForm
        promotion={promotion}
        properties={properties.map((property) => ({
          id: property.id,
          name: property.name,
        }))}
      />
    </PageShell>
  );
}

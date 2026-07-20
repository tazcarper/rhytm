import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  PropertyRail,
  type PropertyRailItem,
} from "@/src/components/admin/property-rail";
import { getAdminPropertiesWithLogos } from "@/src/services/admin/properties";
import s from "./properties-page.module.css";

export const dynamic = "force-dynamic";

// Shell shared by every property route: a static header + the property
// switcher. Lives in the layout so the rail persists (and keeps its highlight)
// while you move between properties and their sub-sections.
export default async function PropertiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  let properties: PropertyRailItem[] = [];
  try {
    properties = await getAdminPropertiesWithLogos(supabase);
  } catch {
    // The child page surfaces load failures; the rail just renders empty.
  }

  return (
    <PageShell width="xl">
      <div className={s.header}>
        <AdminBreadcrumb
          segments={[{ label: "Admin", href: "/admin" }, { label: "Properties" }]}
        />
        <Heading level={1} size="h2" underline>
          Properties
        </Heading>
        <Text variant="lead" className={s.lead}>
          Pick a property, then manage its information, marketing pages, and more.
        </Text>
      </div>

      {properties.length > 0 && <PropertyRail properties={properties} />}

      {children}
    </PageShell>
  );
}

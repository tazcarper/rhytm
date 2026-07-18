import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminPropertyById } from "@/src/services/admin/properties";
import {
  getPropertyPageContentSection,
  type AdminPropertyPageSection,
} from "@/src/services/admin/property-page-content";
import type { PropertyPageKey } from "@/src/services/public/property-page-content";
import { PROPERTY_PAGE_SECTIONS } from "@/src/constants/admin/property-page-sections";
import { getUpcomingEventsForProperty } from "@/src/services/admin/events";
import { PropertyWorkspace } from "@/src/components/admin/property-workspace";

export const dynamic = "force-dynamic";

// One server load serves every section of a property (Basics / Marketing
// pages / Events). The requested tab lives in the catch-all URL but is read
// client-side by the workspace, so it doesn't need to change what we fetch
// here — we always hand over the full picture, including every configured
// content section (src/constants/admin/property-page-sections.ts) across
// every page, plus this property's upcoming events.
export default async function PropertyWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const property = await getAdminPropertyById(supabase, id);
  if (!property) notFound();

  const [pageContentRows, upcomingEvents] = await Promise.all([
    Promise.all(
      PROPERTY_PAGE_SECTIONS.map((config) =>
        getPropertyPageContentSection(supabase, property.id, config.pageKey, config.sectionKey),
      ),
    ),
    getUpcomingEventsForProperty(supabase, property.id),
  ]);

  const pageContent = {} as Record<PropertyPageKey, Record<string, AdminPropertyPageSection | null>>;
  PROPERTY_PAGE_SECTIONS.forEach((config, index) => {
    pageContent[config.pageKey] ??= {};
    pageContent[config.pageKey][config.sectionKey] = pageContentRows[index];
  });

  return (
    <PropertyWorkspace
      property={property}
      pageContent={pageContent}
      upcomingEvents={upcomingEvents}
    />
  );
}

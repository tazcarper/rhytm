import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getActiveWaiverTemplate } from "@/src/services/waiver/get-active-waiver-template";
import { WaiverTemplateEditor } from "@/src/components/admin/waiver-template-editor";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Config-in-DB waiver editor. One editor card per property; saving creates
// a new immutable version and activates it (previously signed waivers keep
// the exact version their guest agreed to).
export default async function WaiverSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const properties = await getAdminPropertiesList(supabase);
  const templates = await Promise.all(
    properties.map((property) =>
      getActiveWaiverTemplate(supabase, property.id),
    ),
  );

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Waivers" }]}
      />
      <Heading level={1} size="h2" underline>
        Waiver templates
      </Heading>
      <p
        style={{
          color: "var(--charcoal-soft)",
          marginTop: "var(--space-2)",
          maxWidth: "60ch",
        }}
      >
        Edit each property&rsquo;s liability waiver. Saving creates a new
        version and activates it; the legal text the guest signs is frozen
        into their PDF, so existing signed waivers are unaffected.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          marginTop: "var(--space-5)",
        }}
      >
        {properties.map((property, index) => (
          <WaiverTemplateEditor
            key={property.id}
            propertyId={property.id}
            propertyName={property.name}
            template={templates[index]}
          />
        ))}
      </div>
    </PageShell>
  );
}

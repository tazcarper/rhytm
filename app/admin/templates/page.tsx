import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBidContentLibrary } from "@/src/services/admin/bid-content-templates";
import { TemplatesManager } from "@/src/components/admin/templates/templates-manager";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Bid Content Library management. Staff author reusable FAQ + gear items,
// scope them to properties / disciplines / booking types, and the resolver
// auto-fills them onto new bids at creation. Editing a template here never
// touches an already-composed bid (bids store a frozen JSONB snapshot).
export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient();
  const library = await getBidContentLibrary(supabase);

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "FAQ & Gear" }]}
      />
      <Heading level={1} size="h2" underline>
        FAQ &amp; Gear Templates
      </Heading>
      <p
        style={{
          color: "var(--charcoal-soft)",
          marginTop: "var(--space-2)",
          maxWidth: "64ch",
        }}
      >
        Reusable FAQ and gear-list items. Each item is scoped — to every bid
        (Global), or to a property, discipline, or booking type — and auto-fills
        onto new bids that match. Editing an item here only changes future bids;
        already-sent bids keep the copy they were created with.
      </p>

      <TemplatesManager library={library} />
    </PageShell>
  );
}

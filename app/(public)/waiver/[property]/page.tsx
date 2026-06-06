import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getActiveWaiverTemplate } from "@/src/services/waiver/get-active-waiver-template";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { WaiverKioskForm } from "@/src/components/public/waiver-kiosk-form";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Don't index per-property kiosk pages.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Public walk-in waiver kiosk for a property. A staff member opens this on
// an iPad; the guest reads the waiver, enters their name + email, and signs.
// No login — the property's active template is read via service role.
export default async function WaiverKioskPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const admin = createServiceRoleClient();

  const { data: property } = await admin
    .from("properties")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string }>();
  if (!property) notFound();

  const template = await getActiveWaiverTemplate(admin, property.id);

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        {property.name}
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        {template?.title ?? "Liability waiver"}
      </Heading>

      {!template ? (
        <Alert variant="warn" title="No waiver configured" className="mt-6">
          This property doesn&rsquo;t have a waiver set up yet. Please ask a staff member.
        </Alert>
      ) : (
        <>
          <div className="mt-5 mb-8 max-h-[46vh] overflow-y-auto rounded-card border border-rule bg-paper p-5">
            <MarkdownProse>{template.body}</MarkdownProse>
          </div>
          <WaiverKioskForm propertySlug={slug} consentText={template.consentText} />
        </>
      )}
    </PageShell>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getActiveWaiverTemplate } from "@/src/services/waiver/get-active-waiver-template";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { TokenWaiverSignForm } from "@/src/components/public/token-waiver-sign-form";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Private signing link (from a booking's QR) — keep out of search.
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface BookingRow {
  id: string;
  property_id: string;
  properties: { name: string } | { name: string }[] | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Public scan-to-sign page. Reached by scanning a booking's QR; each guest
// signs their own waiver for that booking. The token authorizes signing; the
// page is anonymous (read via service role).
export default async function ScanSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createServiceRoleClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, property_id, properties ( name )")
    .eq("waiver_sign_token", token)
    .maybeSingle<BookingRow>();
  if (!booking) notFound();

  const property = pickOne(booking.properties);
  const template = await getActiveWaiverTemplate(admin, booking.property_id);

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        {property?.name ?? "Rhythm Outdoors"}
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
          <TokenWaiverSignForm token={token} consentText={template.consentText} />
        </>
      )}
    </PageShell>
  );
}

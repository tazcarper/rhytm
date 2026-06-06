import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { getAdminBidDetail } from "@/src/services/admin/get-bid-detail";
import { getActiveWaiverTemplate } from "@/src/services/waiver/get-active-waiver-template";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { BidSignForm } from "@/src/components/admin/bid-sign-form";

export const dynamic = "force-dynamic";

// On-site waiver signing for a booking. Staff open this on an iPad and hand
// it to the guest. RLS scopes the bid read to the caller; the template read
// uses the staff "waiver_templates: staff read" policy.
export default async function BidSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const detail = await getAdminBidDetail(supabase, id);
  if (!detail) notFound();

  const template = await getActiveWaiverTemplate(supabase, detail.property.id);
  const alreadySigned = !!detail.bid.signedAt;
  const signable =
    detail.bid.status === "confirmed" || detail.bid.status === "paid";

  return (
    <PageShell width="narrow">
      <div className="mb-4">
        <Link
          href={`/admin/bids/${id}`}
          className="font-serif italic text-tan-deep hover:text-olive text-[14px]"
        >
          ← Back to the booking
        </Link>
      </div>
      <Eyebrow as="div" className="mb-2">
        {detail.property.name} · In-person signing
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        {template?.title ?? "Liability waiver"}
      </Heading>

      {alreadySigned ? (
        <Alert variant="success" title="Already signed" className="mt-6">
          This booking&rsquo;s waiver was signed on{" "}
          {new Date(detail.bid.signedAt!).toLocaleDateString()}.
        </Alert>
      ) : !signable ? (
        <Alert variant="warn" title="Not ready to sign" className="mt-6">
          Confirm this bid before collecting the waiver.
        </Alert>
      ) : !template ? (
        <Alert variant="warn" title="No waiver configured" className="mt-6">
          This property doesn&rsquo;t have a waiver set up yet.
        </Alert>
      ) : (
        <>
          <div className="mt-5 mb-8 max-h-[42vh] overflow-y-auto rounded-card border border-rule bg-paper p-5">
            <MarkdownProse>{template.body}</MarkdownProse>
          </div>
          <BidSignForm
            bidId={id}
            guestName={detail.booking.guestName}
            consentText={template.consentText}
          />
        </>
      )}
    </PageShell>
  );
}

import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getInquiry, getInquiryEvents } from "@/src/services/admin/inquiries";
import { InquiryDetail } from "@/src/components/admin/inquiry-detail";

export const dynamic = "force-dynamic";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [inquiry, events] = await Promise.all([
    getInquiry(supabase, id),
    getInquiryEvents(supabase, id),
  ]);

  if (!inquiry) {
    notFound();
  }

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Inquiries", href: "/admin/inquiries" },
          { label: inquiry.name },
        ]}
      />
      <Heading level={1} size="h2" underline>
        {inquiry.name}
      </Heading>
      <InquiryDetail inquiry={inquiry} events={events} />
    </PageShell>
  );
}

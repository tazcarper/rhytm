import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { getAdminBidDetail } from "@/src/services/admin/get-bid-detail";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { BidStatusBadge } from "@/src/components/admin/bid-status-badge";
import { BidEditorForm } from "@/src/components/admin/bid-editor-form";
import s from "@/src/components/admin/bid-detail.module.css";

export const dynamic = "force-dynamic";

export default async function AdminBidEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const detail = await getAdminBidDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  return (
    <PageShell width="xl">
      <div className={s.header}>
        <div>
          <AdminBreadcrumb
            segments={[
              { label: "Admin", href: "/admin" },
              { label: "Bids", href: "/admin/bids" },
              {
                label: detail.booking.guestName,
                href: `/admin/bids/${detail.bid.id}`,
              },
              { label: "Edit" },
            ]}
          />
          <div className={s.titleRow}>
            <Heading level={1} size="h2" underline>
              {detail.booking.guestName}
            </Heading>
            <BidStatusBadge status={detail.bid.status} />
          </div>
        </div>
      </div>

      <BidEditorForm detail={detail} />
    </PageShell>
  );
}

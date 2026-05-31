import { redirect } from "next/navigation";

// Editing now happens in place on the bid detail page — pricing inline and
// bid content via a slide-over drawer. This route is kept only so existing
// links / bookmarks to /edit land somewhere sensible.
export default async function AdminBidEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/bids/${id}`);
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";

// Admin access to a signed waiver PDF. The lookup runs through the admin's
// cookie-scoped client, so RLS decides visibility: super_admin / admin see
// every waiver; property_manager only their property's; anyone else gets
// nothing (and we 404 rather than distinguishing "missing" from
// "forbidden", so we don't leak existence). The private bucket is then
// read via a short-lived (60s) service-role signed URL and the browser is
// redirected to it — the raw object URL is never persisted or pre-shared.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("waiver_documents")
    .select("blob_pathname")
    .eq("bid_id", id)
    .maybeSingle<{ blob_pathname: string }>();

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const storage = createWaiverStorage(createServiceRoleClient());
  let signedUrl: string;
  try {
    signedUrl = await storage.createSignedUrl(data.blob_pathname, 60);
  } catch {
    return new NextResponse("Could not open the waiver", { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}

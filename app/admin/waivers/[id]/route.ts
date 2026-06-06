import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createWaiverStorage } from "@/lib/storage/waiver-storage";

// Admin access to any signed waiver PDF by its waiver_documents id (works
// for both standalone walk-in and bid-linked waivers). The lookup runs
// through the admin's cookie client so RLS decides visibility; we 404 rather
// than distinguish missing from forbidden. The private bucket is then read
// via a short-lived service-role signed URL and the browser is redirected.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("waiver_documents")
    .select("blob_pathname")
    .eq("id", id)
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

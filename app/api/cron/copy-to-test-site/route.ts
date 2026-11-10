import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createPreviewDatabaseClient } from "@/src/services/admin/copy-events-to-preview";
import { syncTestSite } from "@/src/services/admin/test-site-sync";

// Nightly: copies the live site's content and settings to the test sites'
// database (see syncTestSite). Run by Vercel Cron (vercel.json), which
// sends CRON_SECRET. An admin signed in to the live site can also open
// this address to run it now.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function isAllowed(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  return role === "admin" || role === "super_admin";
}

export async function GET(request: NextRequest) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 401 });
  }
  const target = createPreviewDatabaseClient();
  if (!target) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Only runs on the live site, once PREVIEW_SUPABASE_URL and PREVIEW_SUPABASE_SECRET_KEY are set in Vercel (Production).",
      },
      { status: 400 },
    );
  }
  const tables = await syncTestSite({ source: createServiceRoleClient(), target });
  const failed = tables.filter((table) => table.error);
  if (failed.length) console.error("[copy-to-test-site] some tables failed:", failed);
  return NextResponse.json({ ok: failed.length === 0, tables });
}

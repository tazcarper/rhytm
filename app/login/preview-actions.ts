"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalHomeForRole } from "@/lib/auth/portal";
import {
  previewLoginEmail,
  signInForPreview,
} from "@/src/services/auth/preview-sign-in";

// The preview site's "Sign in as test admin" button. Does nothing outside
// Vercel preview sites (see previewLoginEmail).
export async function previewSignInAction(
  rawNext: string | null,
): Promise<{ error: string }> {
  const email = previewLoginEmail();
  if (!email) return { error: "Quick sign-in only works on preview sites." };

  const userClient = await createServerSupabaseClient();
  const result = await signInForPreview(email, {
    adminClient: createServiceRoleClient(),
    userClient,
  });
  if (!result.ok) return { error: result.error };

  // Same open-redirect guard as the login page.
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : null;
  const {
    data: { user },
  } = await userClient.auth.getUser();
  redirect(next ?? portalHomeForRole(user?.app_metadata?.role as string));
}

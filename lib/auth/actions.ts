"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Signs the current Supabase user out and sends them back to /login.
// Used by the logout buttons in the member and admin portals (and
// anywhere else an authenticated surface needs an exit). Calling it
// from a <form action={signOut}> keeps the trigger a server-driven
// POST so we don't need a client component.
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

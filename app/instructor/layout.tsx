import type { ReactNode } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentInstructor } from "@/src/services/instructors/current-instructor";
import { InstructorNav } from "@/src/components/instructors/instructor-nav";

// Chrome for the instructor portal. The proxy (PORTAL_ALLOWLIST) already gates
// /instructor to the `instructor` role, so this layout only composes the nav
// + content. Name lookup fails open — a transient error must not blank the
// portal, so the nav just drops the name.
export default async function InstructorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const instructor = await getCurrentInstructor(supabase).catch(() => null);

  return (
    <>
      <InstructorNav instructorName={instructor?.name ?? null} />
      {children}
    </>
  );
}

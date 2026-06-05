import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getStaffProfile } from "@/src/services/admin/team";
import { StaffProfileForm } from "@/src/components/admin/staff-profile-form";
import { PasswordForm } from "@/src/components/members/password-form";

export const dynamic = "force-dynamic";

// A staff member's own profile: update their display name, and optionally set
// a password to sign in directly instead of a magic link.
export default async function AdminProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getStaffProfile(user.id);

  return (
    <PageShell width="narrow">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Profile" }]} />
      <Heading level={1} size="h2" underline>
        Your profile
      </Heading>
      <p className="text-gray font-serif italic text-[14px] mt-2 mb-0">
        Signed in as <strong>{user.email}</strong>.
      </p>

      <Card padding="loose" className="mt-6">
        <Heading level={2} size="h4">
          Name
        </Heading>
        <StaffProfileForm initialName={profile?.fullName ?? ""} />
      </Card>

      <Card padding="loose" className="mt-4">
        <Heading level={2} size="h4">
          Password
        </Heading>
        <p className="text-gray font-serif italic text-[14px] mt-1 mb-0 max-w-md">
          Set a password to sign in directly next time, instead of waiting for a magic link. You can
          always use the link as a backup.
        </p>
        <PasswordForm />
      </Card>
    </PageShell>
  );
}

import { PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { PrototypeIndex } from "@/src/components/admin/prototypes/prototype-index";

export default function EventPrototypesPage() {
  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Prototypes" },
        ]}
      />
      <PrototypeIndex />
    </PageShell>
  );
}

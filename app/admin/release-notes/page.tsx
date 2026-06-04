import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { Heading, PageShell } from "@/lib/ui";
import { RELEASE_PATCHES } from "@/src/constants/release-notes";
import { ReleaseNotesView } from "@/src/components/admin/release-notes-view";

// Client-facing changelog. Static content from src/constants/release-notes —
// no data fetch; the admin layout supplies the nav + auth gate.
export default function ReleaseNotesPage() {
  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "What’s New" }]}
      />
      <Heading level={1} size="h2" underline>
        What&rsquo;s New
      </Heading>
      <p
        style={{
          color: "var(--charcoal-soft)",
          marginTop: "var(--space-2)",
          maxWidth: "70ch",
        }}
      >
        A running log of everything we&rsquo;ve added and improved across the platform,
        newest first — a quick way to catch up on what&rsquo;s changed since your last visit.
      </p>

      <ReleaseNotesView patches={RELEASE_PATCHES} />
    </PageShell>
  );
}

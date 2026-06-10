import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { Heading, PageShell } from "@/lib/ui";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { getClientSetupGuideMarkdown } from "@/src/services/admin/setup-guide";

// Admin-only view of the client onboarding guide (docs/CLIENT_SETUP.md). Reachable
// directly at /admin/setup but intentionally NOT in the nav. The admin layout
// supplies the nav + auth gate; middleware restricts /admin to staff roles.
export default function AdminSetupPage() {
  const markdown = getClientSetupGuideMarkdown();

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Client Setup" }]}
      />
      <Heading level={1} size="h2" underline>
        Client Setup Guide
      </Heading>
      <p
        style={{
          color: "var(--charcoal-soft)",
          marginTop: "var(--space-2)",
          maxWidth: "70ch",
        }}
      >
        The exact walkthrough a client follows to set up the project on their Mac. The
        same content is shareable as a standalone page at{" "}
        <a href="/client-setup.html" target="_blank" rel="noopener noreferrer">
          /client-setup.html
        </a>
        .
      </p>

      {markdown ? (
        <div style={{ marginTop: "var(--space-5)" }}>
          <MarkdownProse>{markdown}</MarkdownProse>
        </div>
      ) : (
        <p style={{ marginTop: "var(--space-5)" }}>
          The guide couldn&rsquo;t be loaded here. Open the{" "}
          <a href="/client-setup.html" target="_blank" rel="noopener noreferrer">
            shareable setup page
          </a>{" "}
          instead.
        </p>
      )}
    </PageShell>
  );
}

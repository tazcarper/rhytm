import { Card } from "@/lib/ui";
import { CheckTestDatabaseButton } from "./check-test-database-button";
import { DevSection } from "../_components/dev-section";

// Lists columns the live database has and the test one doesn't, with the
// SQL to add them (see src/services/admin/schema-drift.ts).
export function CheckTestDatabaseSection() {
  return (
    <DevSection
      title="Check the test database"
      description={
        <>
          Compares the live and test databases and lists any table or column
          the test one is missing (the cause of &ldquo;column &hellip; does
          not exist&rdquo; on test sites). Gives you the SQL to add missing
          columns; it changes nothing by itself. Only works on the live site.
        </>
      }
    >
      <Card padding="loose">
        <CheckTestDatabaseButton />
      </Card>
    </DevSection>
  );
}

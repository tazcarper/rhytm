import { redirect } from "next/navigation";
import { authenticate } from "../actions";
import { isDevAuthorized } from "@/lib/dev/auth";
import {
  Alert,
  Button,
  Card,
  Eyebrow,
  FormField,
  Heading,
  Input,
  PageShell,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isDevAuthorized()) {
    redirect("/dev");
  }

  const { error } = await searchParams;
  const errorMessage =
    error === "invalid"
      ? "Wrong password."
      : error === "missing"
        ? "Password is required."
        : null;

  return (
    <PageShell dark dotGrid>
      <Card
        elevation="lift"
        padding="loose"
        style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
      >
        <Eyebrow variant="crest" as="div" style={{ marginBottom: "1.5rem" }}>
          Internal Tool
        </Eyebrow>
        <Heading level={1} size="h2" style={{ marginBottom: "0.5rem" }}>
          Developer <em>Dashboard</em>
        </Heading>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--gray)",
            margin: "0 0 2rem",
          }}
        >
          Restricted. Enter the password configured in{" "}
          <code style={{ fontFamily: "var(--sans)", fontStyle: "normal" }}>
            DEV_DASHBOARD_PASSWORD
          </code>
          .
        </p>

        {errorMessage && (
          <Alert variant="error" title="Could not sign in">
            {errorMessage}
          </Alert>
        )}

        <form action={authenticate} style={{ textAlign: "left" }}>
          <FormField label="Password">
            {(p) => (
              <Input
                {...p}
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                required
              />
            )}
          </FormField>
          <Button type="submit" variant="primary" fullWidth>
            Enter
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}

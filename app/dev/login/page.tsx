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
        className="max-w-[420px] w-full text-center"
      >
        <Eyebrow variant="crest" as="div" className="mb-6">
          Internal Tool
        </Eyebrow>
        <Heading level={1} size="h2" className="mb-2">
          Developer <em>Dashboard</em>
        </Heading>
        <p className="font-serif italic text-gray mt-0 mb-8">
          Restricted. Enter the password configured in{" "}
          <code className="font-sans not-italic">DEV_DASHBOARD_PASSWORD</code>.
        </p>

        {errorMessage && (
          <Alert variant="error" title="Could not sign in">
            {errorMessage}
          </Alert>
        )}

        <form action={authenticate} className="text-left">
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

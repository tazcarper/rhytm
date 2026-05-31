import { signOut } from "@/lib/auth/actions";
import { Button } from "@/lib/ui";

// Identity strip at the top of the member portal: "Signed in as …
// · role: …" on the left, sign-out form on the right. Read-only —
// the sign-out is a server action passed through unchanged. Prefers
// the member's display name (user_metadata.display_name) and falls
// back to their email when no display name is set.
export function MemberHeader({
  email,
  role,
  displayName,
}: {
  email: string | undefined;
  role: string | undefined;
  displayName?: string;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mt-4">
      <p className="text-gray m-0 font-serif italic text-[18px]">
        Signed in as{" "}
        <strong className="text-olive">{displayName || email}</strong>{" "}
        &middot; role:{" "}
        <code className="font-mono not-italic text-[0.85em]">
          {role ?? "—"}
        </code>
      </p>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}

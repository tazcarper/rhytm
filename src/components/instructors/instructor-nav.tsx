import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/lib/ui";
import s from "./instructor-nav.module.css";

// The one bar across the instructor portal. Deliberately spare — instructors
// are on their phone walking up to meet guests, so it's just the brand (a tap
// back to the event list) + their name + sign out. The global SiteHeader is
// suppressed under /instructor (see site-header.tsx).
export function InstructorNav({
  instructorName,
}: {
  instructorName: string | null;
}) {
  return (
    <nav className={s.bar} aria-label="Instructor">
      <Link href="/instructor" className={s.brand}>
        <span className={s.wordmark}>Rhythm</span>
        <span className={s.scope}>Gameplan</span>
      </Link>

      <div className={s.identity}>
        <Link href="/instructor/profile" className={s.link}>
          Profile
        </Link>
        {instructorName && <span className={s.name}>{instructorName}</span>}
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}

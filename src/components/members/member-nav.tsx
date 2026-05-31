import Link from "next/link";
import { cn } from "@/lib/ui/utils/cn";

// Tab strip shared by every /member page. Mounted from each page (not
// from a shared layout) so pages stay self-contained — see plan/app/
// app-4-member-portal.md Decision §8.
//
// Active tab is passed as a prop, not derived from usePathname(). Keeps
// this a pure server component and avoids a client-island just to
// highlight one link.

export type MemberNavTab = "home" | "bookings" | "adventures" | "profile";

interface Tab {
  id: MemberNavTab;
  label: string;
  href: string;
}

const TABS: ReadonlyArray<Tab> = [
  { id: "home", label: "Home", href: "/member" },
  { id: "bookings", label: "My bookings", href: "/member/bookings" },
  { id: "adventures", label: "Adventures", href: "/member/adventures" },
  { id: "profile", label: "Profile", href: "/member/profile" },
];

export function MemberNav({ active }: { active: MemberNavTab }) {
  return (
    <nav
      aria-label="Member portal"
      className="flex gap-1 border-b border-rule mt-6 mb-8"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "px-4 py-2 -mb-px border-b-2 font-serif text-[15px] tracking-[0.3px] transition-colors",
              isActive
                ? "border-olive text-olive"
                : "border-transparent text-gray hover:text-olive hover:border-tan",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

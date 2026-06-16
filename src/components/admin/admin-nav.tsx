"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { canManageTeam } from "@/lib/auth/portal";
import { Button, cn } from "@/lib/ui";
import { GuidesMenu } from "./guides-menu";
import { NavDropdown, type NavDropdownItem } from "./nav-dropdown";
import s from "./admin-nav.module.css";

interface FlatNavItem {
  label: string;
  href: string;
  badgeCount?: number;
}

interface AdminNavProps {
  email: string | undefined;
  role: string | undefined;
  pendingBidCount: number;
}

export function AdminNav({ email, role, pendingBidCount }: AdminNavProps) {
  const pathname = usePathname();

  // High-traffic destinations stay one click away as flat links.
  const flatItems: ReadonlyArray<FlatNavItem> = [
    { label: "Dashboard", href: "/admin" },
    {
      label: "Bids",
      href: "/admin/bids",
      badgeCount: pendingBidCount > 0 ? pendingBidCount : undefined,
    },
    { label: "Bookings", href: "/admin/bookings" },
  ];

  // The rest collapse into grouped dropdowns by the job staff are doing.
  const programmingItems: ReadonlyArray<NavDropdownItem> = [
    { label: "Adventures", href: "/admin/adventures" },
    { label: "Properties", href: "/admin/properties" },
    { label: "FAQ & Gear", href: "/admin/templates" },
    { label: "Waivers", href: "/admin/waivers" },
  ];

  const peopleItems: ReadonlyArray<NavDropdownItem> = [
    { label: "Instructors", href: "/admin/instructors" },
    { label: "Members", href: "/admin/members" },
    // Team management is super_admin + admin only.
    ...(canManageTeam(role) ? [{ label: "Team", href: "/admin/team" }] : []),
  ];

  const companyItems: ReadonlyArray<NavDropdownItem> = [
    // Static org chart served from /public, opens in its own tab.
    { label: "Accountability Chart", href: "/rhythm-accountability.html", external: true },
    { label: "What's New", href: "/admin/release-notes" },
  ];

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className={s.bar} aria-label="Admin">
      <Link href="/admin" className={s.brand}>
        <span className={s.wordmark}>Rhythm</span>
        <span className={s.scope}>Admin</span>
      </Link>

      <ul className={s.links}>
        {flatItems.map((item) => {
          const active = isActive(item.href);

          return (
            <li key={item.href} className={s.linkItem}>
              <Link
                href={item.href}
                className={cn(s.link, active && s.linkActive)}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {item.badgeCount !== undefined && (
                  <span className={s.badge}>{item.badgeCount}</span>
                )}
              </Link>
            </li>
          );
        })}

        <li className={s.linkItem}>
          <NavDropdown label="Programming" items={programmingItems} />
        </li>
        <li className={s.linkItem}>
          <NavDropdown label="People" items={peopleItems} />
        </li>
        <li className={s.linkItem}>
          <NavDropdown label="Company" items={companyItems} />
        </li>
      </ul>

      <div className={s.identity}>
        <GuidesMenu role={role} />
        <Button asChild variant="secondary" size="sm">
          <a href="/" target="_blank" rel="noopener noreferrer">
            View site ↗
          </a>
        </Button>
        <Link href="/admin/profile" className={s.identityText} title="Your profile">
          <span className={s.identityEmail}>{email ?? "—"}</span>
          <span>{role ?? "—"}</span>
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}

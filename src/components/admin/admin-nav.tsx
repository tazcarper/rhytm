"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { Button, cn } from "@/lib/ui";
import s from "./admin-nav.module.css";

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badgeCount?: number;
}

interface AdminNavProps {
  email: string | undefined;
  role: string | undefined;
  pendingBidCount: number;
}

export function AdminNav({ email, role, pendingBidCount }: AdminNavProps) {
  const pathname = usePathname();

  const items: ReadonlyArray<NavItem> = [
    { label: "Dashboard", href: "/admin" },
    {
      label: "Bids",
      href: "/admin/bids",
      badgeCount: pendingBidCount > 0 ? pendingBidCount : undefined,
    },
    { label: "Bookings", href: "/admin/bookings" },
    { label: "Members", href: "/admin/members", disabled: true },
    { label: "Properties", href: "/admin/properties" },
    { label: "Waivers", href: "/admin/settings/waivers" },
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
        {items.map((item) => {
          const active = !item.disabled && isActive(item.href);
          const cls = cn(
            s.link,
            active && s.linkActive,
            item.disabled && s.linkDisabled,
          );

          return (
            <li key={item.href} className={s.linkItem}>
              {item.disabled ? (
                <span className={cls} aria-disabled="true">
                  {item.label}
                  <span className={s.comingSoon}>soon</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cls}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  {item.badgeCount !== undefined && (
                    <span className={s.badge}>{item.badgeCount}</span>
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className={s.identity}>
        <div className={s.identityText}>
          <span className={s.identityEmail}>{email ?? "—"}</span>
          <span>{role ?? "—"}</span>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}

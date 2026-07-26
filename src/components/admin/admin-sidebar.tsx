"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  House,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Network,
  Send,
  Signature,
  Sparkles,
  Ticket,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { canManageTeam } from "@/lib/auth/portal";
import { cn } from "@/src/components/ui/utils";
import { getPropertyBrandTint } from "@/src/constants/admin/property-brand-tints";

interface NavItem {
  type?: "link";
  label: string;
  href: string;
  icon: LucideIcon;
  badgeCount?: number;
  /** Plain anchor in a new tab (static HTML outside the app router). */
  external?: boolean;
}

interface ExpandableChildItem {
  label: string;
  href: string;
  /** Property slug — keys the brand-tint monogram fallback when no logo is set. */
  slug?: string;
  logoUrl?: string | null;
}

interface ExpandableNavItem {
  type: "expandable";
  label: string;
  icon: LucideIcon;
  /** Any pathname under this prefix counts as "within" — auto-opens the group and highlights its row. */
  basePath: string;
  children: ReadonlyArray<ExpandableChildItem>;
}

type NavEntry = NavItem | ExpandableNavItem;

interface NavGroup {
  label: string | null;
  items: ReadonlyArray<NavEntry>;
}

interface PropertyNavItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface GuideLink {
  label: string;
  href: string;
}

// The published manual lives as static HTML in /public — plain anchors that
// open in a new tab, shareable without a login. Mirrors the retired
// guides-menu.tsx list.
const GUIDE_LINKS: ReadonlyArray<GuideLink> = [
  { label: "All guides", href: "/guide.html" },
  { label: "Staff guide", href: "/guide-staff.html" },
  { label: "Admin & super-admin", href: "/guide-admin.html" },
  { label: "Instructor guide", href: "/guide-instructor.html" },
  { label: "Member guide", href: "/guide-member.html" },
  { label: "Guest guide", href: "/guide-public.html" },
];

// Site-editing guides for contributors — admins / super-admins only.
const CONTRIBUTOR_LINKS: ReadonlyArray<GuideLink> = [
  { label: "Editing the site", href: "/client-setup.html" },
  { label: "Designing the look", href: "/guide-design-workflow.html" },
  { label: "Requesting a feature", href: "/guide-feature-request.html" },
  { label: "Building a feature", href: "/guide-build-a-feature.html" },
];

interface AdminSidebarProps {
  email: string | undefined;
  role: string | undefined;
  pendingBidCount: number;
  newInquiryCount: number;
  properties: ReadonlyArray<PropertyNavItem>;
}

function buildNavGroups(
  role: string | undefined,
  pendingBidCount: number,
  newInquiryCount: number,
  properties: ReadonlyArray<PropertyNavItem>,
): NavGroup[] {
  return [
    {
      label: null,
      items: [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        {
          label: "Inquiries",
          href: "/admin/inquiries",
          icon: Mail,
          badgeCount: newInquiryCount > 0 ? newInquiryCount : undefined,
        },
        { label: "Newsletter", href: "/admin/newsletter", icon: Send },
      ],
    },
    {
      label: "Programming",
      items: [
        { label: "Events", href: "/admin/events", icon: Ticket },
        { label: "Waivers", href: "/admin/waivers", icon: Signature },
      ],
    },
    {
      label: "Content Management",
      items: [
        {
          type: "expandable",
          label: "Properties",
          icon: Building2,
          basePath: "/admin/properties",
          children: properties.map((property) => ({
            label: property.name,
            href: `/admin/properties/${property.slug}`,
            slug: property.slug,
            logoUrl: property.logoUrl,
          })),
        },
        { label: "Homepage", href: "/admin/homepage", icon: House },
      ],
    },
    {
      label: "People",
      items: [
        {
          label: "Instructors",
          href: "/admin/instructors",
          icon: GraduationCap,
        },
        { label: "Members", href: "/admin/members", icon: Users },
        ...(canManageTeam(role)
          ? [{ label: "Team", href: "/admin/team", icon: UserRound }]
          : []),
      ],
    },
    {
      label: "Company",
      items: [
        {
          label: "Accountability Chart",
          href: "/rhythm-accountability.html",
          icon: Network,
          external: true,
        },
        { label: "What's New", href: "/admin/release-notes", icon: Sparkles },
      ],
    },
  ];
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const linkClassName = cn(
    "flex items-center gap-2.5 rounded-sharp px-3 py-2 text-[13.5px] leading-snug transition-colors",
    active
      ? "bg-cream/10 font-medium text-cream"
      : "text-cream/70 hover:bg-cream/[0.06] hover:text-cream",
  );
  const inner = (
    <>
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {item.badgeCount !== undefined && (
        <span className="ml-auto rounded-pill bg-tan px-1.5 py-px text-[11px] font-semibold leading-snug text-olive-darker">
          {item.badgeCount}
        </span>
      )}
      {item.external && (
        <ExternalLink
          className="ml-auto size-3 opacity-50"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      className={linkClassName}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {inner}
    </Link>
  );
}

// 18px logo medallion for a property row in the sidebar — mirrors the
// properties workspace's own top-rail badge (property-rail.tsx) at a
// smaller size for the narrower nav column. Falls back to an initial-letter
// monogram tinted with that club's brand color when no logo is uploaded.
function PropertyBadge({
  slug,
  name,
  logoUrl,
  active,
}: {
  slug: string | undefined;
  name: string;
  logoUrl: string | null | undefined;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-[18px] shrink-0 place-items-center overflow-hidden rounded-full border bg-white",
        active ? "border-cream/40" : "border-cream/15",
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-contain p-[2px]" />
      ) : (
        <span
          className="grid size-full place-items-center font-serif text-[9px] font-semibold leading-none text-cream"
          style={{ background: getPropertyBrandTint(slug) }}
          aria-hidden="true"
        >
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}

function ExpandableNavLink({
  item,
  onNavigate,
}: {
  item: ExpandableNavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const within = pathname === item.basePath || pathname.startsWith(`${item.basePath}/`);
  const [open, setOpen] = useState(within);

  // Auto-open (never auto-close) whenever navigation lands inside this group.
  useEffect(() => {
    if (within) setOpen(true);
  }, [within]);

  const Chevron = open ? ChevronDown : ChevronRight;
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-sharp px-3 py-2 text-[13.5px] leading-snug transition-colors",
          within
            ? "bg-cream/10 font-medium text-cream"
            : "text-cream/70 hover:bg-cream/[0.06] hover:text-cream",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
        <Chevron className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
      </button>
      {open && (
        <ul className="mt-0.5 flex flex-col gap-px pl-7">
          {item.children.length === 0 && (
            <li className="px-2 py-1.5 text-[12.5px] text-cream/40">No properties yet</li>
          )}
          {item.children.map((child) => {
            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-sharp py-1.5 pl-1.5 pr-2 text-[12.5px] transition-colors",
                    active
                      ? "bg-cream/10 font-medium text-cream"
                      : "text-cream/60 hover:bg-cream/[0.06] hover:text-cream",
                  )}
                >
                  <PropertyBadge slug={child.slug} name={child.label} logoUrl={child.logoUrl} active={active} />
                  <span className={active ? "text-white truncate" : "truncate"}>{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GuidesSection({ role }: { role: string | undefined }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const links = canManageTeam(role)
    ? [...GUIDE_LINKS, ...CONTRIBUTOR_LINKS]
    : GUIDE_LINKS;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-sharp px-3 py-2 text-[13.5px] leading-snug text-cream/70 transition-colors hover:bg-cream/[0.06] hover:text-cream"
      >
        <BookOpen className="size-4 shrink-0 opacity-80" aria-hidden="true" />
        <span>Guides</span>
        <Chevron className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
      </button>
      {open && (
        <ul className="mt-0.5 flex flex-col gap-px pl-9">
          {links.map((guide) => (
            <li key={guide.href}>
              <a
                href={guide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-sharp px-2 py-1.5 text-[12.5px] text-cream/60 transition-colors hover:bg-cream/[0.06] hover:text-cream"
              >
                {guide.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarContent({
  email,
  role,
  pendingBidCount,
  newInquiryCount,
  properties,
  onNavigate,
}: AdminSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = buildNavGroups(role, pendingBidCount, newInquiryCount, properties);

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        className="flex flex-col gap-0.5 border-b border-cream/10 px-5 pb-4 pt-5 no-underline"
        onClick={onNavigate}
      >
        <span className="font-serif text-[22px] font-semibold leading-none text-cream">
          Rhythm
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-tan">
          Admin
        </span>
      </Link>

      <nav
        aria-label="Admin"
        className="flex-1 overflow-y-auto px-2.5 pb-4 pt-3"
      >
        {groups.map((group, groupIndex) => (
          <div key={group.label ?? "main"} className={groupIndex > 0 ? "mt-5" : undefined}>
            {group.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[2px] text-cream/40">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-px">
              {group.items.map((item) =>
                item.type === "expandable" ? (
                  <li key={item.label}>
                    <ExpandableNavLink item={item} onNavigate={onNavigate} />
                  </li>
                ) : (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={!item.external && isActive(item.href)}
                      onNavigate={onNavigate}
                    />
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}

        <div className="mt-5">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[2px] text-cream/40">
            Help
          </p>
          <GuidesSection role={role} />
        </div>
      </nav>

      <div className="border-t border-cream/10 px-2.5 py-3">
        <Link
          href="/admin/profile"
          className="flex flex-col gap-0.5 rounded-sharp px-3 py-2 transition-colors hover:bg-cream/[0.06]"
          title="Your profile"
          onClick={onNavigate}
        >
          <span className="truncate text-[12.5px] font-medium text-cream">
            {email ?? "—"}
          </span>
          <span className="text-[10.5px] uppercase tracking-label text-cream/50">
            {role ? role.replace(/_/g, " ") : "—"}
          </span>
        </Link>
        <div className="mt-1 flex items-center gap-px">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center gap-2 rounded-sharp px-3 py-2 text-[12.5px] text-cream/70 transition-colors hover:bg-cream/[0.06] hover:text-cream"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            View site
          </a>
          <form action={signOut} className="flex-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-sharp px-3 py-2 text-[12.5px] text-cream/70 transition-colors hover:bg-cream/[0.06] hover:text-cream"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * The admin shell's navigation: a fixed deep-olive sidebar on desktop, a
 * compact top bar + slide-over drawer on mobile. Replaces the old top-bar
 * AdminNav (see docs/dashboard-redesign-plan.md).
 */
export function AdminSidebar(props: AdminSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Safety net: close the drawer on any route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-cream/10 bg-olive-deep lg:block">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-cream/10 bg-olive-deep px-4 lg:hidden">
        <Link href="/admin" className="flex items-baseline gap-2 no-underline">
          <span className="font-serif text-[19px] font-semibold text-cream">
            Rhythm
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-tan">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-sharp text-cream/80 transition-colors hover:bg-cream/[0.08] hover:text-cream"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[var(--scrim)]"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-olive-deep shadow-lift">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-4 flex size-9 items-center justify-center rounded-sharp text-cream/70 transition-colors hover:bg-cream/[0.08] hover:text-cream"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <SidebarContent {...props} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

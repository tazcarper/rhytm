// Single source of truth for "given a role, where does this user
// belong?" Used by /auth/callback (post-link redirect) and /login
// (redirect-already-signed-in). Keep in sync with the proxy
// PORTAL_ALLOWLIST in proxy.ts — these two structures describe
// the same role-to-portal mapping from opposite directions.

const ROLE_TO_PORTAL: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  property_manager: "/admin",
  concierge: "/admin",
  membership_coordinator: "/admin",
  member: "/member",
  partner: "/partner",
};

export function portalHomeForRole(role: string | null | undefined): string {
  if (!role) return "/";
  return ROLE_TO_PORTAL[role] ?? "/";
}

// True for every role that lands on /admin — super_admin, admin,
// property_manager, concierge, membership_coordinator. Used by chrome
// surfaces (SiteHeader) to decide whether to surface an admin shortcut.
export function hasAdminAccess(role: string | null | undefined): boolean {
  return portalHomeForRole(role) === "/admin";
}

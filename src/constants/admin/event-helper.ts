// Who can use the AI event helper. Pilot decision (2026-11-03): admins and
// property managers. Checked by the helper's API route and by the pages
// that show the helper.
export const EVENT_HELPER_ROLES: ReadonlySet<string> = new Set(["super_admin", "admin", "property_manager"]);

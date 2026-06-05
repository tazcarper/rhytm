// Shared types for the dev dashboard. Lives in _lib (no component imports)
// so both the server-side registry and the client sidebar can depend on it
// without leaking server components into the client bundle.

export interface DevNavItem {
  id: string;
  label: string;
  group: string;
}

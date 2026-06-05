import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Read helpers for the dev dashboard, behind a small boundary so each
// section depends on the slice it needs (ISP) rather than a god-fetch in
// the page. Colocated with the tool (it's removed before launch) rather
// than promoted to src/services.
//
// Wrapped in React `cache()` for per-request memoization: several sections
// call getDevProperties() in a single render, but it runs one query.

export interface DevProperty {
  id: string;
  name: string;
  slug: string;
}

export const getDevProperties = cache(async (): Promise<DevProperty[]> => {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("properties")
    .select("id, name, slug")
    .order("name");
  return (data as DevProperty[] | null) ?? [];
});

export interface DevMembership {
  id: string;
  member_number: string;
  property_id: string;
  properties: { name: string } | { name: string }[] | null;
}

export const getDevMemberships = cache(async (): Promise<DevMembership[]> => {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("memberships")
    .select("id, member_number, property_id, properties(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as DevMembership[] | null) ?? [];
});

export interface DevJunctionRow {
  id: string;
  role: string;
  status: string;
  people:
    | {
        id: string;
        email: string;
        user_id: string | null;
        invited_at: string | null;
        invite_accepted_at: string | null;
        invite_expires_at: string | null;
        created_at: string | null;
      }
    | Array<{
        id: string;
        email: string;
        user_id: string | null;
        invited_at: string | null;
        invite_accepted_at: string | null;
        invite_expires_at: string | null;
        created_at: string | null;
      }>
    | null;
  memberships:
    | {
        id: string;
        member_number: string;
        status: string;
        property_id: string;
        properties: { name: string } | { name: string }[] | null;
      }
    | Array<{
        id: string;
        member_number: string;
        status: string;
        property_id: string;
        properties: { name: string } | { name: string }[] | null;
      }>
    | null;
}

export const getDevJunctionRows = cache(async (): Promise<DevJunctionRow[]> => {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("membership_people")
    .select(
      `id, role, status,
       people(id, email, user_id, invited_at, invite_accepted_at, invite_expires_at, created_at),
       memberships(id, member_number, status, property_id, properties(name))`,
    )
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as DevJunctionRow[] | null) ?? [];
});

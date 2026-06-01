import type { SupabaseClient } from "@supabase/supabase-js";

// Admin-facing read model for memberships. The household account
// (`memberships`) is the unit, not the individual person — one membership
// can carry several people via the `membership_people` junction. Staff read
// access is granted by the admin / property_manager / membership_coordinator
// SELECT policies on people / memberships / membership_people.

export type MembershipStatus =
  | "pending"
  | "active"
  | "inactive"
  | "lapsed"
  | "suspended";

export const MEMBERSHIP_STATUSES: ReadonlyArray<MembershipStatus> = [
  "pending",
  "active",
  "inactive",
  "lapsed",
  "suspended",
];

export type MembershipRole = "primary" | "spouse" | "dependent" | "authorized";

export interface AdminMemberListFilters {
  status?: MembershipStatus;
  propertyId?: string;
  tier?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

// One membership belonging to a person, as shown stacked inside their row.
export interface AdminMemberMembership {
  membershipId: string;
  memberNumber: string;
  tier: string | null;
  status: MembershipStatus;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  householdSize: number;
  createdAt: string;
}

// A row is one PERSON (the primary on their memberships), carrying every
// membership where they're primary. A person who is a member at three
// properties is a single row listing three memberships — not three rows.
// Households stay collapsed too: a multi-person membership sits under its
// primary, with the others counted in `householdSize`.
export interface AdminMemberListRow {
  key: string;
  // The primary person the row groups by — the row links to their page.
  // Null only for the rare membership with no active primary person.
  personId: string | null;
  // Official name (first + last). The self-entered display override, when
  // present, is shown beneath it.
  primaryName: string | null;
  primaryDisplayName: string | null;
  primaryEmail: string | null;
  memberships: AdminMemberMembership[];
  earliestJoined: string;
}

export interface AdminMemberListResult {
  rows: AdminMemberListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

type EmbeddedPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  display_name: string | null;
};

// Upper bound on memberships pulled for in-memory person grouping. Far above
// any realistic launch-scale member count; revisit (move grouping into a
// SQL view / RPC) if the membership table ever approaches this.
const MAX_MEMBERSHIPS_FETCH = 2000;

type MembershipPersonRow = {
  role: MembershipRole;
  status: string;
  people: EmbeddedPerson | EmbeddedPerson[] | null;
};

type MembershipsRow = {
  id: string;
  member_number: string;
  membership_tier: string | null;
  status: MembershipStatus;
  created_at: string;
  property_id: string;
  properties: { name: string; slug: string };
  membership_people: MembershipPersonRow[] | null;
};

function fullName(person: EmbeddedPerson | null): string | null {
  if (!person) return null;
  const joined = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined.length > 0 ? joined : null;
}

function firstEmbedded(
  value: EmbeddedPerson | EmbeddedPerson[] | null,
): EmbeddedPerson | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Strip PostgREST filter metacharacters before interpolating a search term.
function sanitizeSearch(term: string): string {
  return term.replace(/[%(),]/g, "").trim();
}

export async function getAdminMembersList(
  supabase: SupabaseClient,
  filters: AdminMemberListFilters = {},
): Promise<AdminMemberListResult> {
  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  // Search spans member number (on memberships) AND person name/email (on
  // the junction's people). Resolve the people side to membership ids
  // first, then OR them with a member_number match — that keeps count +
  // pagination server-side and correct, instead of filtering in memory.
  const searchTerm = filters.q ? sanitizeSearch(filters.q) : "";
  let peopleMatchedIds: string[] = [];
  if (searchTerm) {
    const { data: matched } = await supabase
      .from("membership_people")
      .select("membership_id, people!inner ( first_name, last_name, email )")
      .or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`,
        { referencedTable: "people" },
      );
    peopleMatchedIds = Array.from(
      new Set(
        ((matched ?? []) as Array<{ membership_id: string }>).map(
          (entry) => entry.membership_id,
        ),
      ),
    );
  }

  let query = supabase
    .from("memberships")
    .select(
      `
      id, member_number, membership_tier, status, created_at,
      property_id,
      properties!inner ( name, slug ),
      membership_people ( role, status, people ( id, first_name, last_name, email, display_name ) )
    `,
    )
    .order("created_at", { ascending: false })
    .range(0, MAX_MEMBERSHIPS_FETCH - 1);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }
  if (filters.tier) {
    query = query.eq("membership_tier", filters.tier);
  }
  if (searchTerm) {
    const orParts = [`member_number.ilike.%${searchTerm}%`];
    if (peopleMatchedIds.length > 0) {
      orParts.push(`id.in.(${peopleMatchedIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Admin members list failed: ${error.message}`);
  }

  // Group the matched memberships by their primary person so one human is
  // one row. A membership with no active primary falls back to a per-
  // membership key so it still appears.
  const groups = new Map<string, AdminMemberListRow>();
  for (const row of (data ?? []) as unknown as MembershipsRow[]) {
    const householdRows = (row.membership_people ?? []).filter(
      (entry) => entry.status === "active",
    );
    const primary =
      householdRows.find((entry) => entry.role === "primary") ??
      householdRows[0] ??
      null;
    const primaryPerson = primary ? firstEmbedded(primary.people) : null;
    const key = primaryPerson ? `p:${primaryPerson.id}` : `m:${row.id}`;

    const membership: AdminMemberMembership = {
      membershipId: row.id,
      memberNumber: row.member_number,
      tier: row.membership_tier,
      status: row.status,
      propertyId: row.property_id,
      propertyName: row.properties.name,
      propertySlug: row.properties.slug,
      householdSize: householdRows.length,
      createdAt: row.created_at,
    };

    const existing = groups.get(key);
    if (existing) {
      existing.memberships.push(membership);
      if (row.created_at < existing.earliestJoined) {
        existing.earliestJoined = row.created_at;
      }
    } else {
      groups.set(key, {
        key,
        personId: primaryPerson?.id ?? null,
        primaryName: fullName(primaryPerson),
        primaryDisplayName: primaryPerson?.display_name ?? null,
        primaryEmail: primaryPerson?.email ?? null,
        memberships: [membership],
        earliestJoined: row.created_at,
      });
    }
  }

  // Newest members first (by their earliest membership). Memberships within
  // a row keep the fetch order (newest first). Grouping + pagination happen
  // in memory — fine at launch scale (see MAX_MEMBERSHIPS_FETCH).
  const allRows = Array.from(groups.values()).sort((left, right) =>
    right.earliestJoined.localeCompare(left.earliestJoined),
  );

  const totalCount = allRows.length;
  const rows = allRows.slice(rangeFrom, rangeTo + 1);
  return {
    rows,
    totalCount,
    page,
    pageSize,
    hasMore: rangeFrom + rows.length < totalCount,
  };
}

// Distinct membership tiers present in the data, for the filter dropdown.
// Tier vocabulary is client-gated (Q9) — this just surfaces whatever exists
// so the filter works the moment real tiers are assigned.
export async function getMembershipTiers(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("membership_tier")
    .not("membership_tier", "is", null);

  if (error) {
    throw new Error(`Membership tiers load failed: ${error.message}`);
  }

  const tiers = new Set(
    ((data ?? []) as Array<{ membership_tier: string | null }>)
      .map((row) => row.membership_tier)
      .filter((tier): tier is string => !!tier),
  );
  return Array.from(tiers).sort();
}

// ---- Member (person) detail ----

// One membership the person belongs to, with their role on it.
export interface MemberMembership {
  membershipId: string;
  memberNumber: string;
  tier: string | null;
  status: MembershipStatus;
  role: MembershipRole;
  propertyName: string;
  propertySlug: string;
  joinedAt: string;
  householdSize: number;
}

export interface MemberBooking {
  id: string;
  bidId: string | null;
  status: string;
  bookingType: string;
  startTime: string;
  durationHours: number;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  propertyTimezone: string;
}

export interface MemberRsvp {
  id: string;
  status: string;
  guestCount: number;
  adventureTitle: string;
  startDate: string;
}

export interface AdminMemberDetail {
  personId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  hasLogin: boolean;
  memberships: MemberMembership[];
  bookings: MemberBooking[];
  rsvps: MemberRsvp[];
}

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
};

type MemberMembershipRow = {
  role: MembershipRole;
  memberships: {
    id: string;
    member_number: string;
    membership_tier: string | null;
    status: MembershipStatus;
    created_at: string;
    properties: { name: string; slug: string };
    membership_people: Array<{ status: string }> | null;
  } | null;
};

export async function getAdminMemberDetail(
  supabase: SupabaseClient,
  personId: string,
): Promise<AdminMemberDetail | null> {
  const { data: personData, error: personError } = await supabase
    .from("people")
    .select("id, first_name, last_name, display_name, email, phone, user_id")
    .eq("id", personId)
    .maybeSingle();

  if (personError) {
    throw new Error(`Admin member detail failed: ${personError.message}`);
  }
  if (!personData) return null;

  const person = personData as unknown as PersonRow;

  const { data: membershipData, error: membershipError } = await supabase
    .from("membership_people")
    .select(
      `
      role,
      memberships!inner (
        id, member_number, membership_tier, status, created_at,
        properties!inner ( name, slug ),
        membership_people ( status )
      )
    `,
    )
    .eq("person_id", personId);

  if (membershipError) {
    throw new Error(`Member memberships load failed: ${membershipError.message}`);
  }

  const memberships: MemberMembership[] = (
    (membershipData ?? []) as unknown as MemberMembershipRow[]
  )
    .map((entry): MemberMembership | null => {
      const membership = entry.memberships;
      if (!membership) return null;
      const householdSize = (membership.membership_people ?? []).filter(
        (junction) => junction.status === "active",
      ).length;
      return {
        membershipId: membership.id,
        memberNumber: membership.member_number,
        tier: membership.membership_tier,
        status: membership.status,
        role: entry.role,
        propertyName: membership.properties.name,
        propertySlug: membership.properties.slug,
        joinedAt: membership.created_at,
        householdSize,
      };
    })
    .filter((entry): entry is MemberMembership => entry !== null)
    .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt));

  const membershipIds = memberships.map((membership) => membership.membershipId);

  // A member's bookings are keyed off their auth login. No login → no
  // member-attributed bookings.
  const bookings = person.user_id
    ? await loadMemberBookings(supabase, person.user_id)
    : [];
  const rsvps = membershipIds.length
    ? await loadMemberRsvps(supabase, membershipIds)
    : [];

  return {
    personId: person.id,
    firstName: person.first_name,
    lastName: person.last_name,
    displayName: person.display_name,
    email: person.email,
    phone: person.phone,
    hasLogin: person.user_id !== null,
    memberships,
    bookings,
    rsvps,
  };
}

type DetailBookingRow = {
  id: string;
  status: string;
  booking_type: string;
  start_time: string;
  duration_hours: number;
  property_id: string;
  properties: { name: string; slug: string; timezone: string };
  bids: Array<{ id: string }> | { id: string } | null;
};

async function loadMemberBookings(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<MemberBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, status, booking_type, start_time, duration_hours,
      property_id,
      properties!inner ( name, slug, timezone ),
      bids ( id )
    `,
    )
    .eq("member_user_id", memberUserId)
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(`Member bookings load failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as DetailBookingRow[]).map((row) => {
    const bid = Array.isArray(row.bids) ? row.bids[0] : row.bids;
    return {
      id: row.id,
      bidId: bid?.id ?? null,
      status: row.status,
      bookingType: row.booking_type,
      startTime: row.start_time,
      durationHours: row.duration_hours,
      propertyId: row.property_id,
      propertyName: row.properties.name,
      propertySlug: row.properties.slug,
      propertyTimezone: row.properties.timezone,
    };
  });
}

type DetailRsvpRow = {
  id: string;
  status: string;
  guest_count: number;
  member_adventures: { title: string; start_date: string } | null;
};

async function loadMemberRsvps(
  supabase: SupabaseClient,
  membershipIds: string[],
): Promise<MemberRsvp[]> {
  const { data, error } = await supabase
    .from("member_adventure_rsvps")
    .select(
      `
      id, status, guest_count,
      member_adventures!inner ( title, start_date )
    `,
    )
    .in("membership_id", membershipIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Member RSVPs load failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as DetailRsvpRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    guestCount: row.guest_count,
    adventureTitle: row.member_adventures?.title ?? "—",
    startDate: row.member_adventures?.start_date ?? "",
  }));
}

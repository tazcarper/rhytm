import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardKind } from "@/src/services/rewards/ledger";

// Read side of rewards. Every query runs under the caller's RLS scope:
// members see their household's accounts, staff see their property's (or
// all, for admins). Returns domain shapes, never raw PostgREST rows.

export interface RewardBalance {
  membershipId: string;
  balance: number;
  lifetimeEarned: number;
  /** ISO timestamp, or null before the first transaction. */
  expiresAt: string | null;
  isExpired: boolean;
}

export interface RewardActivity {
  id: string;
  points: number;
  kind: RewardKind;
  source: "online_payment" | "staff";
  reason: string;
  occurredOn: string;
  amountUsd: number | null;
  createdAt: string;
  createdBy: string | null;
}

export interface RewardAccountSummary extends RewardBalance {
  memberNumber: string;
  propertyName: string;
  propertySlug: string;
  householdName: string;
  lastActivityAt: string | null;
}

interface BalanceRow {
  membership_id: string;
  balance: number;
  lifetime_earned: number;
  expires_at: string | null;
  is_expired: boolean;
}

function emptyBalance(membershipId: string): RewardBalance {
  return { membershipId, balance: 0, lifetimeEarned: 0, expiresAt: null, isExpired: false };
}

function toBalance(row: BalanceRow): RewardBalance {
  return {
    membershipId: row.membership_id,
    balance: row.balance,
    lifetimeEarned: row.lifetime_earned,
    expiresAt: row.expires_at,
    isExpired: row.is_expired,
  };
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Balances for a set of memberships. Memberships with no activity yet come back as zero. */
export async function getRewardBalances(
  supabase: SupabaseClient,
  membershipIds: ReadonlyArray<string>,
): Promise<Map<string, RewardBalance>> {
  const result = new Map<string, RewardBalance>();
  for (const id of membershipIds) result.set(id, emptyBalance(id));
  if (membershipIds.length === 0) return result;

  const { data, error } = await supabase
    .from("reward_balances")
    .select("membership_id, balance, lifetime_earned, expires_at, is_expired")
    .in("membership_id", membershipIds as string[]);

  if (error) {
    console.error("[rewards/accounts] balance read failed", error);
    return result;
  }
  for (const row of (data ?? []) as BalanceRow[]) {
    result.set(row.membership_id, toBalance(row));
  }
  return result;
}

export async function getRewardBalance(
  supabase: SupabaseClient,
  membershipId: string,
): Promise<RewardBalance> {
  const balances = await getRewardBalances(supabase, [membershipId]);
  return balances.get(membershipId) ?? emptyBalance(membershipId);
}

/** Most recent ledger entries for one membership, newest first. */
export async function getRewardActivity(
  supabase: SupabaseClient,
  membershipId: string,
  limit = 50,
): Promise<RewardActivity[]> {
  const { data, error } = await supabase
    .from("reward_transactions")
    .select("id, points, kind, source, reason, occurred_on, amount_usd, created_at, created_by")
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[rewards/accounts] activity read failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    points: row.points as number,
    kind: row.kind as RewardKind,
    source: row.source as RewardActivity["source"],
    reason: row.reason as string,
    occurredOn: row.occurred_on as string,
    amountUsd: row.amount_usd === null ? null : Number(row.amount_usd),
    createdAt: row.created_at as string,
    createdBy: (row.created_by as string | null) ?? null,
  }));
}

export interface RewardAccountListFilters {
  /** Member number or household last name. */
  search?: string;
  propertySlug?: string;
}

interface MembershipListRow {
  id: string;
  member_number: string;
  properties: { name: string; slug: string } | { name: string; slug: string }[] | null;
  membership_people:
    | {
        role: string;
        status: string;
        people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      }[]
    | null;
}

function householdName(row: MembershipListRow): string {
  const people = (row.membership_people ?? []).filter((mp) => mp.status === "active");
  const primary = people.find((mp) => mp.role === "primary") ?? people[0];
  const person = pickOne(primary?.people);
  return person ? `${person.first_name} ${person.last_name}`.trim() : "—";
}

/**
 * Staff list of reward accounts. With a search, looks across every
 * membership the staff member can see (so a household with no points yet
 * can still be found and credited). Without one, lists accounts that have
 * activity, most recent first.
 */
export async function listRewardAccounts(
  supabase: SupabaseClient,
  filters: RewardAccountListFilters,
): Promise<RewardAccountSummary[]> {
  const search = filters.search?.trim() ?? "";

  let membershipIds: string[] | null = null;
  if (!search) {
    const { data, error } = await supabase
      .from("reward_balances")
      .select("membership_id")
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      console.error("[rewards/accounts] list read failed", error);
      return [];
    }
    membershipIds = (data ?? []).map((row) => row.membership_id as string);
    if (membershipIds.length === 0) return [];
  }

  let query = supabase
    .from("memberships")
    .select(
      `id, member_number,
       properties!inner ( name, slug ),
       membership_people ( role, status, people ( first_name, last_name ) )`,
    )
    .limit(100);

  if (membershipIds) query = query.in("id", membershipIds);
  if (filters.propertySlug) query = query.eq("properties.slug", filters.propertySlug);
  if (search) {
    // Member numbers are short codes; an exact-ish match is what staff type.
    query = query.ilike("member_number", `%${search.replace(/[%_]/g, "")}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[rewards/accounts] memberships read failed", error);
    return [];
  }

  let rows = (data ?? []) as MembershipListRow[];

  // Last-name search as a second pass (PostgREST can't OR across an embed
  // and a base column in one filter without an RPC; fine at POC scale).
  if (search && rows.length === 0) {
    const { data: byName } = await supabase
      .from("memberships")
      .select(
        `id, member_number,
         properties!inner ( name, slug ),
         membership_people!inner ( role, status, people!inner ( first_name, last_name ) )`,
      )
      .ilike("membership_people.people.last_name", `%${search.replace(/[%_]/g, "")}%`)
      .limit(100);
    rows = (byName ?? []) as MembershipListRow[];
    if (filters.propertySlug) {
      rows = rows.filter((row) => pickOne(row.properties)?.slug === filters.propertySlug);
    }
  }

  const balances = await getRewardBalances(supabase, rows.map((row) => row.id));
  const { data: activityRows } = await supabase
    .from("reward_balances")
    .select("membership_id, last_activity_at")
    .in("membership_id", rows.map((row) => row.id));
  const lastActivity = new Map(
    (activityRows ?? []).map((row) => [row.membership_id as string, row.last_activity_at as string | null]),
  );

  const summaries = rows.map((row): RewardAccountSummary => {
    const property = pickOne(row.properties);
    const balance = balances.get(row.id) ?? emptyBalance(row.id);
    return {
      ...balance,
      memberNumber: row.member_number,
      propertyName: property?.name ?? "—",
      propertySlug: property?.slug ?? "",
      householdName: householdName(row),
      lastActivityAt: lastActivity.get(row.id) ?? null,
    };
  });

  return summaries.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
}

/** One account for the staff detail page, or null if the caller can't see it. */
export async function getRewardAccountSummary(
  supabase: SupabaseClient,
  membershipId: string,
): Promise<RewardAccountSummary | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      `id, member_number,
       properties ( name, slug ),
       membership_people ( role, status, people ( first_name, last_name ) )`,
    )
    .eq("id", membershipId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as MembershipListRow;
  const property = pickOne(row.properties);
  const balance = await getRewardBalance(supabase, membershipId);
  return {
    ...balance,
    memberNumber: row.member_number,
    propertyName: property?.name ?? "—",
    propertySlug: property?.slug ?? "",
    householdName: householdName(row),
    lastActivityAt: null,
  };
}

/** Total outstanding points per property, for the liability line on the admin page. */
export interface OutstandingPoints {
  propertyName: string;
  redeemablePoints: number;
  expiredPoints: number;
}

export async function getOutstandingPointsByProperty(
  supabase: SupabaseClient,
): Promise<OutstandingPoints[]> {
  const [{ data, error }, { data: properties }] = await Promise.all([
    supabase.from("reward_balances").select("property_id, balance, is_expired"),
    supabase.from("properties").select("id, name"),
  ]);
  if (error) return [];
  const names = new Map((properties ?? []).map((p) => [p.id as string, p.name as string]));
  const totals = new Map<string, OutstandingPoints>();
  for (const row of data ?? []) {
    const key = row.property_id as string;
    const current =
      totals.get(key) ?? { propertyName: names.get(key) ?? "—", redeemablePoints: 0, expiredPoints: 0 };
    const balance = Math.max(0, row.balance as number);
    if (row.is_expired) current.expiredPoints += balance;
    else current.redeemablePoints += balance;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => a.propertyName.localeCompare(b.propertyName));
}

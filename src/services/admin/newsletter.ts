import type { SupabaseClient } from "@supabase/supabase-js";

// Admin read model for newsletter signups (see the newsletter_signups
// migration). Insert-only from the public side — nothing here writes.

export interface AdminNewsletterSignupFilters {
  propertyId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminNewsletterSignupRow {
  id: string;
  email: string;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  createdAt: string;
}

export interface AdminNewsletterSignupListResult {
  rows: AdminNewsletterSignupRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;
// Upper bound for a CSV export pull — far above any realistic launch-scale
// signup count; revisit (server-side streaming) if it's ever approached.
const MAX_EXPORT_ROWS = 20000;

const LIST_COLUMNS = "id, email, created_at, property_id, properties ( name, slug )";

type SignupRow = {
  id: string;
  email: string;
  created_at: string;
  property_id: string;
  properties: { name: string; slug: string };
};

function mapSignupRow(row: SignupRow): AdminNewsletterSignupRow {
  return {
    id: row.id,
    email: row.email,
    propertyId: row.property_id,
    propertyName: row.properties.name,
    propertySlug: row.properties.slug,
    createdAt: row.created_at,
  };
}

// Strip PostgREST filter metacharacters before interpolating a search term.
function sanitizeSearch(term: string): string {
  return term.replace(/[%(),]/g, "").trim();
}

export async function getAdminNewsletterSignupsList(
  supabase: SupabaseClient,
  filters: AdminNewsletterSignupFilters = {},
): Promise<AdminNewsletterSignupListResult> {
  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let query = supabase
    .from("newsletter_signups")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.q) {
    const term = sanitizeSearch(filters.q);
    if (term) query = query.ilike("email", `%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Couldn't load newsletter signups: ${error.message}`);

  const rows = ((data ?? []) as unknown as SignupRow[]).map(mapSignupRow);
  const totalCount = count ?? rows.length;
  return {
    rows,
    totalCount,
    page,
    pageSize,
    hasMore: rangeFrom + rows.length < totalCount,
  };
}

export async function getAdminNewsletterSignupsForExport(
  supabase: SupabaseClient,
  filters: Pick<AdminNewsletterSignupFilters, "propertyId" | "q"> = {},
): Promise<AdminNewsletterSignupRow[]> {
  let query = supabase
    .from("newsletter_signups")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .range(0, MAX_EXPORT_ROWS - 1);

  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.q) {
    const term = sanitizeSearch(filters.q);
    if (term) query = query.ilike("email", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Couldn't export newsletter signups: ${error.message}`);

  return ((data ?? []) as unknown as SignupRow[]).map(mapSignupRow);
}

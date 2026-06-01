import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminMembersList,
  getMembershipTiers,
  type AdminMemberListFilters,
  type MembershipStatus,
  MEMBERSHIP_STATUSES,
} from "@/src/services/admin/members";
import { getPublicProperties } from "@/src/services/public/properties";
import { MemberFilters } from "@/src/components/admin/member-filters";
import { MemberListTable } from "@/src/components/admin/member-list-table";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/members";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isMembershipStatus(
  value: string | undefined,
): value is MembershipStatus {
  return !!value && (MEMBERSHIP_STATUSES as ReadonlyArray<string>).includes(value);
}

function parseFilters(params: RawSearchParams): AdminMemberListFilters {
  const statusValue = first(params.status);
  const propertyId = first(params.propertyId) || undefined;
  const tier = first(params.tier) || undefined;
  const searchTerm = first(params.q)?.trim() || undefined;
  const pageValue = first(params.page);
  const page = pageValue ? Math.max(0, parseInt(pageValue, 10) || 0) : 0;

  return {
    status: isMembershipStatus(statusValue) ? statusValue : undefined,
    propertyId,
    tier,
    q: searchTerm,
    page,
  };
}

function buildPageHref(
  filters: AdminMemberListFilters,
  nextPage: number,
): string {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.propertyId) queryParams.set("propertyId", filters.propertyId);
  if (filters.tier) queryParams.set("tier", filters.tier);
  if (filters.q) queryParams.set("q", filters.q);
  if (nextPage > 0) queryParams.set("page", String(nextPage));
  const queryString = queryParams.toString();
  return queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
}

export default async function AdminMembersList({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createServerSupabaseClient();

  const [list, propertiesResult, tiers] = await Promise.all([
    getAdminMembersList(supabase, filters).catch((err: Error) => ({
      error: err.message,
      rows: [],
      totalCount: 0,
      page: filters.page ?? 0,
      pageSize: 50,
      hasMore: false,
    })),
    getPublicProperties(supabase),
    getMembershipTiers(supabase).catch(() => [] as string[]),
  ]);

  const properties = propertiesResult.data ?? [];

  const error = "error" in list ? list.error : null;
  const start = list.page * list.pageSize + (list.rows.length > 0 ? 1 : 0);
  const end = list.page * list.pageSize + list.rows.length;

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Members" }]}
      />
      <Heading level={1} size="h2" underline>
        Members
      </Heading>

      <MemberFilters
        current={filters}
        properties={properties}
        tiers={tiers}
        basePath={BASE_PATH}
      />

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load members">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.summary}>
        {list.totalCount === 0
          ? "0 members"
          : `Showing ${start}–${end} of ${list.totalCount}`}
      </div>

      <MemberListTable rows={list.rows} />

      {(list.page > 0 || list.hasMore) && (
        <div className={s.pagination}>
          <div className={s.pageInfo}>Page {list.page + 1}</div>
          <div className={s.pageButtons}>
            {list.page > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildPageHref(filters, list.page - 1)}>
                  ← Previous
                </Link>
              </Button>
            ) : null}
            {list.hasMore ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildPageHref(filters, list.page + 1)}>
                  Next →
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}

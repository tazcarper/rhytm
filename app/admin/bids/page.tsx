import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminBidsList,
  type AdminBidListFilters,
  type AdminBidStatus,
  type AdminBidStatusGroup,
  ADMIN_BID_STATUSES,
  BID_STATUS_GROUPS,
} from "@/src/services/admin/bids";
import { getPublicProperties } from "@/src/services/public/properties";
import { BidFilters } from "@/src/components/admin/bid-filters";
import { BidListTable } from "@/src/components/admin/bid-list-table";
import { buildBidsHref } from "@/src/components/admin/bid-filter-params";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/bids";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isBidStatus(value: string | undefined): value is AdminBidStatus {
  return !!value && (ADMIN_BID_STATUSES as ReadonlyArray<string>).includes(value);
}

function isStatusGroup(
  value: string | undefined,
): value is AdminBidStatusGroup {
  return !!value && BID_STATUS_GROUPS.some((group) => group.key === value);
}

function parseFilters(params: RawSearchParams): AdminBidListFilters {
  const statusValue = first(params.status);
  const statusGroupValue = first(params.statusGroup);
  const propertyId = first(params.propertyId) || undefined;
  const from = first(params.from) || undefined;
  const to = first(params.to) || undefined;
  const searchTerm = first(params.q)?.trim() || undefined;
  const onlyDeleted = first(params.deleted) === "1";
  const pageValue = first(params.page);
  const page = pageValue ? Math.max(0, parseInt(pageValue, 10) || 0) : 0;

  return {
    status: isBidStatus(statusValue) ? statusValue : undefined,
    statusGroup: isStatusGroup(statusGroupValue) ? statusGroupValue : undefined,
    propertyId,
    from,
    to,
    q: searchTerm,
    onlyDeleted,
    page,
  };
}

export default async function AdminBidsList({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createServerSupabaseClient();

  const [list, propertiesResult] = await Promise.all([
    getAdminBidsList(supabase, filters).catch((err: Error) => ({
      error: err.message,
      rows: [],
      totalCount: 0,
      page: filters.page ?? 0,
      pageSize: 50,
      hasMore: false,
    })),
    getPublicProperties(supabase),
  ]);

  const properties = propertiesResult.data ?? [];

  const error = "error" in list ? list.error : null;
  const start = list.page * list.pageSize + (list.rows.length > 0 ? 1 : 0);
  const end = list.page * list.pageSize + list.rows.length;

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Bids" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Bid Review Queue
      </Heading>

      <BidFilters
        current={filters}
        properties={properties}
        basePath={BASE_PATH}
      />

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load bids">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.summary}>
        {list.totalCount === 0
          ? "0 bids"
          : `Showing ${start}–${end} of ${list.totalCount}`}
      </div>

      <BidListTable rows={list.rows} />

      {(list.page > 0 || list.hasMore) && (
        <div className={s.pagination}>
          <div className={s.pageInfo}>
            Page {list.page + 1}
          </div>
          <div className={s.pageButtons}>
            {list.page > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={buildBidsHref(BASE_PATH, filters, { page: list.page - 1 })}
                >
                  ← Previous
                </Link>
              </Button>
            ) : null}
            {list.hasMore ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={buildBidsHref(BASE_PATH, filters, { page: list.page + 1 })}
                >
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

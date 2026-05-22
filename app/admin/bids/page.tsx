import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Eyebrow, Heading, PageShell } from "@/lib/ui";
import {
  getAdminBidsList,
  type AdminBidListFilters,
  type AdminBidStatus,
  ADMIN_BID_STATUSES,
} from "@/src/services/admin/bids";
import { getPublicProperties } from "@/src/services/public/properties";
import { BidFilters } from "@/src/components/admin/bid-filters";
import { BidListTable } from "@/src/components/admin/bid-list-table";
import s from "@/src/components/admin/bid-list.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/bids";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isBidStatus(v: string | undefined): v is AdminBidStatus {
  return !!v && (ADMIN_BID_STATUSES as ReadonlyArray<string>).includes(v);
}

function parseFilters(raw: RawSearchParams): AdminBidListFilters {
  const statusRaw = first(raw.status);
  const propertyId = first(raw.propertyId) || undefined;
  const from = first(raw.from) || undefined;
  const to = first(raw.to) || undefined;
  const q = first(raw.q)?.trim() || undefined;
  const pageRaw = first(raw.page);
  const page = pageRaw ? Math.max(0, parseInt(pageRaw, 10) || 0) : 0;

  return {
    status: isBidStatus(statusRaw) ? statusRaw : undefined,
    propertyId,
    from,
    to,
    q,
    page,
  };
}

function buildPageHref(
  filters: AdminBidListFilters,
  nextPage: number,
): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.propertyId) params.set("propertyId", filters.propertyId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  if (nextPage > 0) params.set("page", String(nextPage));
  const qs = params.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

export default async function AdminBidsList({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

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
      <Eyebrow as="div" className="mb-2">
        Admin / Bids
      </Eyebrow>
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

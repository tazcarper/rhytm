import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminBookingsList,
  type AdminBookingListFilters,
  type AdminBookingStatus,
  type AdminBookingType,
  ADMIN_BOOKING_STATUSES,
  ADMIN_BOOKING_TYPES,
} from "@/src/services/admin/bookings";
import { getPublicProperties } from "@/src/services/public/properties";
import { BookingFilters } from "@/src/components/admin/booking-filters";
import { BookingListTable } from "@/src/components/admin/booking-list-table";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/bookings";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isBookingStatus(value: string | undefined): value is AdminBookingStatus {
  return !!value && (ADMIN_BOOKING_STATUSES as ReadonlyArray<string>).includes(value);
}

function isBookingType(value: string | undefined): value is AdminBookingType {
  return !!value && (ADMIN_BOOKING_TYPES as ReadonlyArray<string>).includes(value);
}

function parseFilters(params: RawSearchParams): AdminBookingListFilters {
  const statusValue = first(params.status);
  const typeValue = first(params.type);
  const propertyId = first(params.propertyId) || undefined;
  const from = first(params.from) || undefined;
  const to = first(params.to) || undefined;
  const searchTerm = first(params.q)?.trim() || undefined;
  const pageValue = first(params.page);
  const page = pageValue ? Math.max(0, parseInt(pageValue, 10) || 0) : 0;

  return {
    status: isBookingStatus(statusValue) ? statusValue : undefined,
    type: isBookingType(typeValue) ? typeValue : undefined,
    propertyId,
    from,
    to,
    q: searchTerm,
    page,
  };
}

function buildPageHref(
  filters: AdminBookingListFilters,
  nextPage: number,
): string {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.type) queryParams.set("type", filters.type);
  if (filters.propertyId) queryParams.set("propertyId", filters.propertyId);
  if (filters.from) queryParams.set("from", filters.from);
  if (filters.to) queryParams.set("to", filters.to);
  if (filters.q) queryParams.set("q", filters.q);
  if (nextPage > 0) queryParams.set("page", String(nextPage));
  const queryString = queryParams.toString();
  return queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
}

export default async function AdminBookingsList({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createServerSupabaseClient();

  const [list, propertiesResult] = await Promise.all([
    getAdminBookingsList(supabase, filters).catch((err: Error) => ({
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
          { label: "Bookings" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Bookings
      </Heading>

      <BookingFilters
        current={filters}
        properties={properties}
        basePath={BASE_PATH}
      />

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load bookings">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.summary}>
        {list.totalCount === 0
          ? "0 bookings"
          : `Showing ${start}–${end} of ${list.totalCount}`}
      </div>

      <BookingListTable rows={list.rows} />

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

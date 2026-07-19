import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminNewsletterSignupsList,
  type AdminNewsletterSignupFilters,
} from "@/src/services/admin/newsletter";
import { getPublicProperties } from "@/src/services/public/properties";
import { NewsletterFilters } from "@/src/components/admin/newsletter-filters";
import { NewsletterSignupsDataTable } from "@/src/components/admin/newsletter-signups-data-table";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/newsletter";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseFilters(params: RawSearchParams): AdminNewsletterSignupFilters {
  const propertyId = first(params.propertyId) || undefined;
  const searchTerm = first(params.q)?.trim() || undefined;
  const pageValue = first(params.page);
  const page = pageValue ? Math.max(0, parseInt(pageValue, 10) || 0) : 0;

  return { propertyId, q: searchTerm, page };
}

function buildPageHref(filters: AdminNewsletterSignupFilters, nextPage: number): string {
  const queryParams = new URLSearchParams();
  if (filters.propertyId) queryParams.set("propertyId", filters.propertyId);
  if (filters.q) queryParams.set("q", filters.q);
  if (nextPage > 0) queryParams.set("page", String(nextPage));
  const queryString = queryParams.toString();
  return queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
}

function buildExportHref(filters: AdminNewsletterSignupFilters): string {
  const queryParams = new URLSearchParams();
  if (filters.propertyId) queryParams.set("propertyId", filters.propertyId);
  if (filters.q) queryParams.set("q", filters.q);
  const queryString = queryParams.toString();
  const exportPath = `${BASE_PATH}/export.csv`;
  return queryString ? `${exportPath}?${queryString}` : exportPath;
}

export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createServerSupabaseClient();

  const [list, propertiesResult] = await Promise.all([
    getAdminNewsletterSignupsList(supabase, filters).catch((err: Error) => ({
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
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level={1} size="h2" underline>
            Newsletter Signups
          </Heading>
          <Text variant="lead">Club news subscribers from the public site, by property.</Text>
        </div>
        <Button asChild variant="secondary" size="sm">
          <a href={buildExportHref(filters)}>Export CSV</a>
        </Button>
      </div>

      <NewsletterFilters current={filters} properties={properties} basePath={BASE_PATH} />

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load newsletter signups">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.summary}>
        {list.totalCount === 0
          ? "0 signups"
          : `Showing ${start}–${end} of ${list.totalCount}`}
      </div>

      <NewsletterSignupsDataTable rows={list.rows} />

      {(list.page > 0 || list.hasMore) && (
        <div className={s.pagination}>
          <div className={s.pageInfo}>Page {list.page + 1}</div>
          <div className={s.pageButtons}>
            {list.page > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildPageHref(filters, list.page - 1)}>← Previous</Link>
              </Button>
            ) : null}
            {list.hasMore ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildPageHref(filters, list.page + 1)}>Next →</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}

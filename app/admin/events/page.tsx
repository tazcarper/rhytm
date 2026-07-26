import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { StatCard } from "@/src/components/admin/dashboard/stat-card";
import { EventsSignupChart } from "@/src/components/admin/events-signup-chart";
import { EventsCalendar } from "@/src/components/admin/events-calendar";
import { EventsDaySchedule } from "@/src/components/admin/events-day-schedule";
import { EventsDataTable } from "@/src/components/admin/events-data-table";
import { getEventsList } from "@/src/services/admin/events";
import { getAdminPropertiesList, type AdminProperty } from "@/src/services/admin/properties";
import {
  getEventsSignupTrend,
  getEventsBusinessMetrics,
  isEventsTrendRange,
  type EventsTrendRange,
  type EventsSignupTrend,
  type EventsBusinessMetrics,
} from "@/src/services/admin/events-stats";
import {
  getAdminMonthEvents,
  computeEventDayDensity,
  eventCalendarDate,
  type AdminEventCalendarRow,
} from "@/src/services/admin/events-calendar";
import { formatDateLong } from "@/src/services/public/format";
import dashboard from "@/src/components/admin/dashboard.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/events";
const ALL_PROPERTIES = "all";
// All three properties share this zone today; bucketing uses each event's
// own property timezone, so a second zone needs no change.
const CALENDAR_TZ = "America/Chicago";
const DEFAULT_RANGE: EventsTrendRange = "1m";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function todayKeyInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Events index — dated occasions with a hard capacity cap and member vs.
// non-member pricing, distinct from open-slot bookings. Layout: KPI row →
// signups trend (range-toggled) → calendar + day detail → the full
// filterable table.
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const todayKey = todayKeyInTz(CALENDAR_TZ);

  const monthValue = first(params.month);
  const month =
    monthValue && MONTH_PATTERN.test(monthValue) ? monthValue : todayKey.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);

  const propertyValue = first(params.property) || ALL_PROPERTIES;
  const isAllProperties = propertyValue === ALL_PROPERTIES;
  const selectedPropertyId = isAllProperties ? undefined : propertyValue;

  const rangeValue = first(params.range);
  const range = rangeValue && isEventsTrendRange(rangeValue) ? rangeValue : DEFAULT_RANGE;

  const supabase = await createServerSupabaseClient();

  const [
    propertiesResult,
    eventsListResult,
    trendResult,
    metricsResult,
    monthEventsResult,
  ] = await Promise.allSettled([
    getAdminPropertiesList(supabase),
    getEventsList(supabase),
    getEventsSignupTrend(supabase, range),
    getEventsBusinessMetrics(supabase),
    getAdminMonthEvents(supabase, {
      propertyId: selectedPropertyId,
      year,
      month: monthNumber,
      monthCount: 2,
    }),
  ]);

  let error: string | null = null;
  const propertyDetails: AdminProperty[] =
    propertiesResult.status === "fulfilled" ? propertiesResult.value : [];
  if (propertiesResult.status === "rejected") {
    error = (propertiesResult.reason as Error).message;
  }

  const eventRows = eventsListResult.status === "fulfilled" ? eventsListResult.value : [];
  if (eventsListResult.status === "rejected") {
    error = error ?? (eventsListResult.reason as Error).message;
  }

  const trend: EventsSignupTrend | null =
    trendResult.status === "fulfilled" ? trendResult.value : null;
  if (trendResult.status === "rejected") {
    error = error ?? (trendResult.reason as Error).message;
  }

  const metrics: EventsBusinessMetrics | null =
    metricsResult.status === "fulfilled" ? metricsResult.value : null;
  if (metricsResult.status === "rejected") {
    error = error ?? (metricsResult.reason as Error).message;
  }

  const monthEvents: AdminEventCalendarRow[] =
    monthEventsResult.status === "fulfilled" ? monthEventsResult.value : [];
  if (monthEventsResult.status === "rejected") {
    error = error ?? (monthEventsResult.reason as Error).message;
  }

  const densityMap = computeEventDayDensity(monthEvents, propertyDetails);
  const dayCells = Object.fromEntries(densityMap);

  // Default selected day: today if it's inside the viewed month, else the 1st.
  const dayValue = first(params.day);
  const selectedDay =
    dayValue && DAY_PATTERN.test(dayValue)
      ? dayValue
      : todayKey.slice(0, 7) === month
        ? todayKey
        : `${month}-01`;

  const columnProperties = isAllProperties
    ? propertyDetails
    : propertyDetails.filter((property) => property.id === propertyValue);
  const selectedDayRows = monthEvents.filter(
    (row) => eventCalendarDate(row) === selectedDay,
  );

  const preserveParams = { month, property: propertyValue, day: selectedDay };

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Events" }]} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading level={1} size="h2" underline>
            Events
          </Heading>
          <Text variant="lead">
            Specific dated occasions with a capacity cap and member vs.
            non-member pricing. Create a template once, then reuse it for
            each new event.
          </Text>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/events/new">New event</Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Some events data could not load">
            {error}
          </Alert>
        </div>
      )}

      <div className={dashboard.stack}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
          <section id="events-table" aria-label="All events">
            <Heading level={2} size="h3" className="mb-3">
              All events
            </Heading>
            <EventsDataTable
              rows={eventRows}
              properties={propertyDetails.map((property) => ({
                id: property.id,
                name: property.name,
              }))}
            />
          </section>

          <div className="flex flex-col gap-6">
            {metrics && (
              <section aria-label="Key numbers" className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Upcoming events"
                  value={String(metrics.upcomingCount)}
                  hint="published, across all clubs"
                  href={`${BASE_PATH}#events-calendar`}
                />
                <StatCard
                  label="Signups · 30 days"
                  value={String(metrics.signups30d)}
                  hint={
                    metrics.memberSharePct !== null
                      ? `${metrics.memberSharePct}% at member rate`
                      : "confirmed registrations"
                  }
                  href={`${BASE_PATH}#events-trend`}
                />
                <StatCard
                  label="Avg. fill rate"
                  value={metrics.avgFillRatePct !== null ? `${metrics.avgFillRatePct}%` : "—"}
                  hint="capacity used, upcoming events"
                  href={`${BASE_PATH}#events-table`}
                />
                <StatCard
                  label="Est. revenue · upcoming"
                  value={currencyFormatter.format(metrics.revenueUpcoming)}
                  hint="confirmed registrations, quoted price"
                  href={`${BASE_PATH}#events-table`}
                />
              </section>
            )}

            <section id="events-trend" aria-label="Signups trend">
              {trend && (
                <EventsSignupChart
                  trend={trend}
                  range={range}
                  basePath={BASE_PATH}
                  preserveParams={preserveParams}
                />
              )}
            </section>
          </div>
        </div>

        <section id="events-calendar" aria-label="Events calendar">
          <Heading level={2} size="h3" className="mb-3">
            Calendar
          </Heading>
          <EventsCalendar
            month={month}
            selectedDay={selectedDay}
            propertyId={propertyValue}
            properties={propertyDetails.map((property) => ({
              id: property.id,
              name: property.name,
            }))}
            dayCells={dayCells}
            today={todayKey}
            basePath={BASE_PATH}
          />

          <div style={{ marginTop: "var(--space-6)" }}>
            <p className={dashboard.dayLabel}>
              <span className={dashboard.dayLabelName}>Schedule</span>
              <span className={dashboard.dayLabelDate}>
                {formatDateLong(selectedDay)}
              </span>
            </p>
            <div className={dashboard.columnGrid}>
              {columnProperties.map((property) => (
                <EventsDaySchedule
                  key={property.id}
                  propertyName={property.name}
                  propertySlug={property.slug}
                  rows={selectedDayRows.filter((row) => row.propertyId === property.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

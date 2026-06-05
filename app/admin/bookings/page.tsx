import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  BookingsCalendar,
  type PropertyOption,
} from "@/src/components/admin/bookings-calendar";
import {
  DaySchedule,
  bookingRowToScheduleBlock,
} from "@/src/components/admin/day-schedule";
import {
  getAdminMonthBookings,
  computeDayDensity,
  bookingCalendarDate,
} from "@/src/services/admin/bookings-calendar";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import type { AdminBookingListRow } from "@/src/services/admin/bookings";
import { formatDateLong } from "@/src/services/public/format";
import dashboard from "@/src/components/admin/dashboard.module.css";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/bookings";
const ALL_PROPERTIES = "all";
// All three properties share this zone today; bucketing in computeDayDensity
// uses each booking's own property timezone, so a second zone needs no change.
const CALENDAR_TZ = "America/Chicago";

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

/** Add days to a YYYY-MM-DD key (UTC math; the key is timezone-agnostic). */
function addDaysToKey(dateKey: string, days: number): string {
  const [year, monthNumber, dayOfMonth] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, dayOfMonth));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export default async function AdminBookingsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const todayKey = todayKeyInTz(CALENDAR_TZ);

  const monthValue = first(params.month);
  const month = monthValue && MONTH_PATTERN.test(monthValue)
    ? monthValue
    : todayKey.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);

  const propertyValue = first(params.property) || ALL_PROPERTIES;
  const isAllProperties = propertyValue === ALL_PROPERTIES;

  const supabase = await createServerSupabaseClient();

  let properties: PropertyOption[] = [];
  let monthRows: AdminBookingListRow[] = [];
  let error: string | null = null;
  let horizonDate: string | null = null;
  // Slug/timezone needed for the day-detail columns, beyond the filter options.
  let propertyDetails: Awaited<ReturnType<typeof getAdminPropertiesList>> = [];

  try {
    propertyDetails = await getAdminPropertiesList(supabase);
    properties = propertyDetails.map((property) => ({
      id: property.id,
      name: property.name,
    }));

    // The filter narrows the fetch; "all" omits propertyId.
    const selectedPropertyId = isAllProperties ? undefined : propertyValue;
    // Two months so the second calendar (next month) is also density-colored;
    // the second month is hidden by CSS below tablet width.
    monthRows = await getAdminMonthBookings(supabase, {
      propertyId: selectedPropertyId,
      year,
      month: monthNumber,
      monthCount: 2,
    });

    // Horizon boundary: a specific property's own horizon, or the furthest
    // any property allows when viewing all.
    const horizonDays = isAllProperties
      ? propertyDetails.reduce(
          (furthest, property) => Math.max(furthest, property.bookingHorizonDays),
          0,
        )
      : (propertyDetails.find((property) => property.id === propertyValue)
          ?.bookingHorizonDays ?? null);
    if (horizonDays !== null) {
      horizonDate = addDaysToKey(todayKey, horizonDays);
    }
  } catch (caughtError) {
    error = (caughtError as Error).message;
  }

  const densityMap = computeDayDensity(monthRows, propertyDetails);
  const dayCells = Object.fromEntries(densityMap);

  // Default selected day: today if it's inside the viewed month, else the 1st.
  const dayValue = first(params.day);
  const selectedDay = dayValue && DAY_PATTERN.test(dayValue)
    ? dayValue
    : todayKey.slice(0, 7) === month
      ? todayKey
      : `${month}-01`;

  // Day-detail columns: bookings on the selected day, grouped per property.
  const columnProperties = isAllProperties
    ? propertyDetails
    : propertyDetails.filter((property) => property.id === propertyValue);
  const selectedDayRows = monthRows.filter(
    (row) => bookingCalendarDate(row) === selectedDay,
  );

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Bookings" }]}
      />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <Heading level={1} size="h2" underline>
          Bookings
        </Heading>
        <Button asChild variant="primary" size="sm">
          <Link href="/book">Book for a customer</Link>
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load bookings">
            {error}
          </Alert>
        </div>
      )}

      <BookingsCalendar
        month={month}
        selectedDay={selectedDay}
        propertyId={propertyValue}
        properties={properties}
        dayCells={dayCells}
        today={todayKey}
        horizonDate={horizonDate}
        basePath={BASE_PATH}
      />

      <section style={{ marginTop: "var(--space-6)" }}>
        <p className={dashboard.dayLabel}>
          <span className={dashboard.dayLabelName}>Schedule</span>
          <span className={dashboard.dayLabelDate}>
            {formatDateLong(selectedDay)}
          </span>
        </p>
        <div className={dashboard.columnGrid}>
          {columnProperties.map((property) => (
            <DaySchedule
              key={property.id}
              propertyId={property.id}
              propertyName={property.name}
              propertySlug={property.slug}
              rows={selectedDayRows
                .filter((row) => row.propertyId === property.id)
                .map(bookingRowToScheduleBlock)}
              dateInTz={selectedDay}
              todayInTz={todayKey}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

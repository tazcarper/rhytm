import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Card, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { formatDateLongTz } from "@/src/services/public/format";
import {
  getUnactionedInquiries,
  type AdminInquiryListRow,
} from "@/src/services/admin/inquiries";
import {
  getEventsBusinessMetrics,
  type EventsBusinessMetrics,
} from "@/src/services/admin/events-stats";
import {
  getAdminMonthEvents,
  eventCalendarDate,
  type AdminEventCalendarRow,
} from "@/src/services/admin/events-calendar";
import { getAdminPropertiesList, type AdminProperty } from "@/src/services/admin/properties";
import { EventsDaySchedule } from "@/src/components/admin/events-day-schedule";
import { StatCard } from "@/src/components/admin/dashboard/stat-card";
import { INQUIRY_TYPE_LABEL } from "@/src/components/admin/humanize";
import s from "@/src/components/admin/dashboard.module.css";

export const dynamic = "force-dynamic";

const CALENDAR_TZ = "America/Chicago";
const ATTENTION_LIMIT = 5;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function todayKeyInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// "Today · 2:15 PM" for a same-day submission, otherwise a short date —
// mirrors the events/bookings dashboards' "is this today" pattern, but
// inquiries aren't scheduled events so there's no slot time to bucket by,
// just a submission instant worth showing precisely when recent.
function inquiryWhenLabel(iso: string): string {
  const created = new Date(iso);
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  if (dateFormatter.format(created) === dateFormatter.format(new Date())) {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: CALENDAR_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(created);
    return `Today · ${time}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TZ,
    month: "short",
    day: "numeric",
  }).format(created);
}

function InquiryMiniRow({ row }: { row: AdminInquiryListRow }) {
  return (
    <li>
      <Link href={`/admin/inquiries/${row.id}`} className={s.miniRow}>
        <div className={s.miniRowTop}>
          <span className={s.miniRowName}>{row.name}</span>
          <span className={s.miniRowWhen}>{inquiryWhenLabel(row.createdAt)}</span>
        </div>
        <div className={s.miniRowMeta}>
          <span>{INQUIRY_TYPE_LABEL[row.inquiryType]}</span>
          <span>·</span>
          <span>{row.propertyName}</span>
        </div>
      </Link>
    </li>
  );
}

export default async function AdminHome() {
  const supabase = await createServerSupabaseClient();
  const todayKey = todayKeyInTz(CALENDAR_TZ);
  const [year, month] = todayKey.slice(0, 7).split("-").map(Number);

  let unactionedInquiries: AdminInquiryListRow[] = [];
  let metrics: EventsBusinessMetrics | null = null;
  let todayEvents: AdminEventCalendarRow[] = [];
  let properties: AdminProperty[] = [];
  let error: string | null = null;

  // Each fetch fails independently — a broken events query must not blank
  // the inquiries queue, and vice versa.
  const [inquiriesResult, metricsResult, monthEventsResult, propertiesResult] =
    await Promise.allSettled([
      getUnactionedInquiries(supabase),
      getEventsBusinessMetrics(supabase),
      getAdminMonthEvents(supabase, { year, month, monthCount: 1 }),
      getAdminPropertiesList(supabase),
    ]);

  if (inquiriesResult.status === "fulfilled") unactionedInquiries = inquiriesResult.value;
  else error = (inquiriesResult.reason as Error).message;

  if (metricsResult.status === "fulfilled") metrics = metricsResult.value;
  else error = error ?? (metricsResult.reason as Error).message;

  if (monthEventsResult.status === "fulfilled") {
    todayEvents = monthEventsResult.value.filter((row) => eventCalendarDate(row) === todayKey);
  } else {
    error = error ?? (monthEventsResult.reason as Error).message;
  }

  if (propertiesResult.status === "fulfilled") properties = propertiesResult.value;
  else error = error ?? (propertiesResult.reason as Error).message;

  const todayHeading = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const eventsByProperty = properties.map((property) => ({
    propertyName: property.name,
    propertySlug: property.slug,
    rows: todayEvents.filter((row) => row.propertyId === property.id),
  }));

  return (
    <PageShell width="xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow as="div" className="mb-2">
            Admin
          </Eyebrow>
          <Heading level={1} size="h2" underline>
            Dashboard
          </Heading>
        </div>
        <p className="m-0 pb-1 text-micro uppercase tracking-label text-gray">
          {todayHeading}
        </p>
      </div>
      <p className={s.pageIntro}>
        A live read on what needs your attention — new inquiries to answer and
        what&rsquo;s on the events calendar across all three clubs.
      </p>

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load dashboard">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.stack}>
        <section
          aria-label="Key numbers"
          className="grid grid-cols-2 gap-4 xl:grid-cols-4"
        >
          <StatCard
            label="New inquiries"
            value={String(unactionedInquiries.length)}
            hint="awaiting your response"
            href="/admin/inquiries"
          />
          <StatCard
            label="Upcoming events"
            value={metrics ? String(metrics.upcomingCount) : "—"}
            hint="published, across all clubs"
            href="/admin/events#events-calendar"
          />
          <StatCard
            label="Signups · 30 days"
            value={metrics ? String(metrics.signups30d) : "—"}
            hint="confirmed registrations"
            href="/admin/events#events-trend"
          />
          <StatCard
            label="Est. revenue · upcoming"
            value={metrics ? currencyFormatter.format(metrics.revenueUpcoming) : "—"}
            hint="confirmed registrations, quoted price"
            href="/admin/events#events-table"
          />
        </section>

        <Card padding="loose" elevation="soft">
          <div className={s.cardHead}>
            <div className={s.cardHeadText}>
              <h2 className={s.cardTitle}>Needs your attention</h2>
              <p className={s.cardDesc}>
                New membership and private-event inquiries you haven&rsquo;t
                responded to yet, oldest first.
              </p>
            </div>
            {unactionedInquiries.length > 0 && (
              <span className={s.cardCount}>{unactionedInquiries.length}</span>
            )}
          </div>
          {unactionedInquiries.length === 0 ? (
            <p className={s.miniEmpty}>No new inquiries.</p>
          ) : (
            <ul className={s.miniList}>
              {unactionedInquiries.slice(0, ATTENTION_LIMIT).map((row) => (
                <InquiryMiniRow key={row.id} row={row} />
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link href="/admin/inquiries" className={s.cardLink}>
              Open inquiries →
            </Link>
          </div>
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={s.cardHead}>
            <div className={s.cardHeadText}>
              <h2 className={s.cardTitle}>Today&rsquo;s events</h2>
              <p className={s.cardDesc}>
                Dated occasions on the books today, by club.
              </p>
            </div>
            {todayEvents.length > 0 && (
              <span className={s.cardCount}>{todayEvents.length}</span>
            )}
          </div>
          <p className={s.dayLabel}>
            <span className={s.dayLabelName}>Today</span>
            <span className={s.dayLabelDate}>{formatDateLongTz(new Date().toISOString(), CALENDAR_TZ)}</span>
          </p>
          <div className={s.columnGrid}>
            {eventsByProperty.map((column) => (
              <EventsDaySchedule
                key={column.propertySlug}
                propertyName={column.propertyName}
                propertySlug={column.propertySlug}
                rows={column.rows}
              />
            ))}
          </div>
          <div className="mt-3">
            <Link href="/admin/events#events-calendar" className={s.cardLink}>
              Open events calendar →
            </Link>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

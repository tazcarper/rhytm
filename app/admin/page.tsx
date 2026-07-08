import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Card, Eyebrow, Heading, PageShell } from "@/lib/ui";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import {
  getAdminDashboardData,
  type AdminDashboardData,
  type PropertyColumn,
} from "@/src/services/admin/dashboard-data";
import {
  getAdminDashboardMetrics,
  type AdminDashboardMetrics,
} from "@/src/services/admin/dashboard-metrics";
import { type AdminBidListRow } from "@/src/services/admin/bids";
import { PropertyPill } from "@/src/components/admin/property-pill";
import {
  DaySchedule,
  bidRowToScheduleBlock,
} from "@/src/components/admin/day-schedule";
import { ActivityFeed } from "@/src/components/admin/activity-feed";
import { StatCard } from "@/src/components/admin/dashboard/stat-card";
import { BrandAreaChart } from "@/src/components/ui/charts/brand-area-chart";
import {
  BrandBarChart,
  type BrandBarChartRow,
} from "@/src/components/ui/charts/brand-bar-chart";
import { propertyChartColor } from "@/src/components/admin/humanize";
import s from "@/src/components/admin/dashboard.module.css";

export const dynamic = "force-dynamic";

const BOOKING_TYPE_SHORT: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Lesson",
  host_an_occasion: "Occasion",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// "Today" / "Tomorrow" / weekday + short date in the property's timezone.
// Strips year + weekday from the long format to keep timeline rows compact.
function timelineDateLabel(iso: string, tz: string): string {
  const long = formatDateLongTz(iso, tz);
  const noYear = long.replace(/, \d{4}$/, "");
  const noWeekday = noYear.replace(/^\w+, /, "");
  const today = new Date();
  const targetDay = new Intl.DateTimeFormat("en-US", { timeZone: tz })
    .format(new Date(iso));
  const todayInTz = new Intl.DateTimeFormat("en-US", { timeZone: tz })
    .format(today);
  if (targetDay === todayInTz) return "Today";
  return noWeekday;
}

function PendingMiniRow({ row }: { row: AdminBidListRow }) {
  return (
    <li>
      <Link href={`/admin/bids/${row.id}`} className={s.miniRow}>
        <div className={s.miniRowTop}>
          <span className={s.miniRowName}>{row.guestName}</span>
          <span className={s.miniRowWhen}>
            {timelineDateLabel(row.startTime, row.propertyTimezone)} ·{" "}
            {formatSlotLabelTz(row.startTime, row.propertyTimezone)} CT
          </span>
        </div>
        <div className={s.miniRowMeta}>
          <span>{BOOKING_TYPE_SHORT[row.bookingType]}</span>
          <PropertyPill name={row.propertyName} slug={row.propertySlug} />
        </div>
      </Link>
    </li>
  );
}

function PropertyColumnView({ column }: { column: PropertyColumn }) {
  return (
    <div className={s.column}>
      <div className={s.columnHead}>
        <PropertyPill
          name={column.propertyName}
          slug={column.propertySlug}
          withDot
        />
        <span className={s.columnCount}>{column.rows.length}</span>
      </div>
      {column.rows.length === 0 ? (
        <p className={s.columnEmpty}>Nothing this week.</p>
      ) : (
        <ul className={s.columnList}>
          {column.rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/bids/${row.id}`} className={s.columnRow}>
                <div className={s.columnWhen}>
                  {timelineDateLabel(row.startTime, row.propertyTimezone)} ·{" "}
                  {formatSlotLabelTz(row.startTime, row.propertyTimezone)}
                </div>
                <div className={s.columnGuest}>{row.guestName}</div>
                <div className={s.columnMeta}>
                  <span>{BOOKING_TYPE_SHORT[row.bookingType]}</span>
                  <span>·</span>
                  <span>
                    {row.guestCount}{" "}
                    {row.guestCount === 1 ? "guest" : "guests"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartCardHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-eyebrow font-semibold uppercase tracking-label text-gray">
        {eyebrow}
      </span>
      <span className="font-serif text-h3 leading-tight text-olive">
        {title}
      </span>
      <span className="text-micro text-gray">{detail}</span>
    </div>
  );
}

export default async function AdminHome() {
  const supabase = await createServerSupabaseClient();

  let data: AdminDashboardData | null = null;
  let metrics: AdminDashboardMetrics | null = null;
  let error: string | null = null;
  // Each fetch fails independently — a broken metrics query must not blank
  // the review queue, and vice versa.
  const [dataResult, metricsResult] = await Promise.allSettled([
    getAdminDashboardData(supabase),
    getAdminDashboardMetrics(supabase),
  ]);
  if (dataResult.status === "fulfilled") data = dataResult.value;
  else error = (dataResult.reason as Error).message;
  if (metricsResult.status === "fulfilled") metrics = metricsResult.value;
  else error = error ?? (metricsResult.reason as Error).message;

  const todayHeading = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const outlookRows: BrandBarChartRow[] = (metrics?.outlook ?? []).map(
    (point) => ({ label: point.label, ...point.counts }),
  );
  const outlookSeries = (metrics?.outlookSeries ?? []).map((series) => ({
    key: series.slug,
    label: series.name,
    color: propertyChartColor(series.slug),
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
        A live read on what needs your attention and what&rsquo;s on the books —
        review pending bids, track recent changes, and see the schedule across
        all three clubs.
      </p>

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Could not load dashboard">
            {error}
          </Alert>
        </div>
      )}

      <div className={s.stack}>
        {data && metrics && (
          <section
            aria-label="Key numbers"
            className="grid grid-cols-2 gap-4 xl:grid-cols-4"
          >
            <StatCard
              label="Needs review"
              value={String(data.pendingBidCount)}
              hint="bids awaiting a decision"
              href="/admin/bids?status=pending_review"
            />
            <StatCard
              label="Next 24 hours"
              value={String(data.next24hCount)}
              hint="on the schedule, incl. pending holds"
              href="/admin/bookings"
            />
            <StatCard
              label="Week ahead"
              value={String(data.upcomingWeekCount)}
              hint="confirmed over the next 7 days"
              href="/admin/bids?statusGroup=active"
            />
            <StatCard
              label="Collected · 30 days"
              value={currencyFormatter.format(metrics.collected30d)}
              hint={`across ${metrics.paidCount30d} paid ${
                metrics.paidCount30d === 1 ? "bid" : "bids"
              }`}
              href="/admin/bids?status=paid"
            />
          </section>
        )}

        {metrics && (
          <section
            aria-label="Trends"
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <Card padding="loose" elevation="soft">
              <div className="flex flex-col gap-3">
                <ChartCardHeader
                  eyebrow="Demand"
                  title="New bids"
                  detail={`${metrics.bidsCreated30d} created in the last 30 days`}
                />
                <BrandAreaChart data={metrics.bidTrend} height={200} />
              </div>
            </Card>
            <Card padding="loose" elevation="soft">
              <div className="flex flex-col gap-3">
                <ChartCardHeader
                  eyebrow="On the books"
                  title="Next 14 days"
                  detail={`${metrics.outlookTotal} confirmed ${
                    metrics.outlookTotal === 1 ? "booking" : "bookings"
                  } by club`}
                />
                <BrandBarChart
                  data={outlookRows}
                  series={outlookSeries}
                  height={200}
                />
              </div>
            </Card>
          </section>
        )}

        {data && (
          <>
            <div className={s.topRow}>
              <Card padding="loose" elevation="soft">
                <div className={s.cardHead}>
                  <div className={s.cardHeadText}>
                    <h2 className={s.cardTitle}>Needs review</h2>
                    <p className={s.cardDesc}>
                      Bids waiting on your decision — confirm or deny each one
                      before it reaches the guest.
                    </p>
                  </div>
                </div>
                {data.recentPending.length === 0 ? (
                  <p className={s.miniEmpty}>No pending bids.</p>
                ) : (
                  <ul className={s.miniList}>
                    {data.recentPending.map((row) => (
                      <PendingMiniRow key={row.id} row={row} />
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <Link
                    href="/admin/bids?status=pending_review"
                    className={s.cardLink}
                  >
                    Open queue →
                  </Link>
                </div>
              </Card>

              <Card padding="loose" elevation="soft">
                {data.recentActivity.length === 0 ? (
                  <>
                    <div className={s.cardHead}>
                      <div className={s.cardHeadText}>
                        <h2 className={s.cardTitle}>Recent activity</h2>
                        <p className={s.cardDesc}>
                          The latest status change on every bid, newest first.
                        </p>
                      </div>
                    </div>
                    <p className={s.miniEmpty}>No activity yet.</p>
                  </>
                ) : (
                  <ActivityFeed rows={data.recentActivity} />
                )}
              </Card>
            </div>

            <Card padding="loose" elevation="soft">
              <div className={s.cardHead}>
                <div className={s.cardHeadText}>
                  <h2 className={s.cardTitle}>Next 24 hours</h2>
                  <p className={s.cardDesc}>
                    Today and tomorrow, hour-by-hour for each club — confirmed
                    bookings plus pending holds (shown hatched) not yet locked
                    in.
                  </p>
                </div>
                {data.next24hCount > 0 && (
                  <span className={s.cardCount}>{data.next24hCount}</span>
                )}
              </div>
              {(() => {
                const tz = "America/Chicago";
                const dateFormatter = new Intl.DateTimeFormat("en-CA", {
                  timeZone: tz,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                });
                const longFormatter = new Intl.DateTimeFormat("en-US", {
                  timeZone: tz,
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                });
                const now = new Date();
                const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
                const todayCt = dateFormatter.format(now);
                const tomorrowCt = dateFormatter.format(tomorrow);
                const todayLong = longFormatter.format(now);
                const tomorrowLong = longFormatter.format(tomorrow);
                const hasTomorrow = data.tomorrowByProperty.some(
                  (column) => column.rows.length > 0,
                );
                return (
                  <>
                    <p className={s.dayLabel}>
                      <span className={s.dayLabelName}>Today</span>
                      <span className={s.dayLabelDate}>{todayLong}</span>
                    </p>
                    <div className={s.columnGrid}>
                      {data.todayByProperty.map((col) => (
                        <DaySchedule
                          key={col.propertyId}
                          propertyId={col.propertyId}
                          propertyName={col.propertyName}
                          propertySlug={col.propertySlug}
                          rows={col.rows.map(bidRowToScheduleBlock)}
                          dateInTz={todayCt}
                          todayInTz={todayCt}
                        />
                      ))}
                    </div>
                    {hasTomorrow && (
                      <>
                        <p
                          className={s.dayLabel}
                          style={{ marginTop: "var(--space-5)" }}
                        >
                          <span className={s.dayLabelName}>Tomorrow</span>
                          <span className={s.dayLabelDate}>{tomorrowLong}</span>
                        </p>
                        <div className={s.columnGrid}>
                          {data.tomorrowByProperty.map((col) => (
                            <DaySchedule
                              key={col.propertyId}
                              propertyId={col.propertyId}
                              propertyName={col.propertyName}
                              propertySlug={col.propertySlug}
                              rows={col.rows.map(bidRowToScheduleBlock)}
                              dateInTz={tomorrowCt}
                              todayInTz={todayCt}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
              <div className="mt-3">
                <Link href="/admin/bookings" className={s.cardLink}>
                  Open bookings calendar →
                </Link>
              </div>
            </Card>

            <Card padding="loose" elevation="soft">
              <div className={s.cardHead}>
                <div className={s.cardHeadText}>
                  <h2 className={s.cardTitle}>The week ahead</h2>
                  <p className={s.cardDesc}>
                    Every confirmed booking across the next seven days, grouped
                    by club.
                  </p>
                </div>
                {data.upcomingWeekCount > 0 && (
                  <span className={s.cardCount}>{data.upcomingWeekCount}</span>
                )}
              </div>
              <div className={s.columnGrid}>
                {data.upcomingByProperty.map((col) => (
                  <PropertyColumnView key={col.propertyId} column={col} />
                ))}
              </div>
              <div className="mt-3">
                <Link href="/admin/bids" className={s.cardLink}>
                  See full schedule →
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}

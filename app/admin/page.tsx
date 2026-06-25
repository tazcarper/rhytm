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
import { type AdminBidListRow } from "@/src/services/admin/bids";
import { PropertyPill } from "@/src/components/admin/property-pill";
import {
  DaySchedule,
  bidRowToScheduleBlock,
} from "@/src/components/admin/day-schedule";
import { ActivityFeed } from "@/src/components/admin/activity-feed";
import s from "@/src/components/admin/dashboard.module.css";

export const dynamic = "force-dynamic";

const BOOKING_TYPE_SHORT: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Lesson",
  host_an_occasion: "Occasion",
};

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

export default async function AdminHome() {
  const supabase = await createServerSupabaseClient();

  let data: AdminDashboardData | null = null;
  let error: string | null = null;
  try {
    data = await getAdminDashboardData(supabase);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <PageShell width="xl">
      <Eyebrow as="div" className="mb-2">
        Admin
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        Dashboard
      </Heading>
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

      {data && (
        <div className={s.stack}>
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
                  bookings plus pending holds (shown hatched) not yet locked in.
                </p>
              </div>
              <span className={s.cardCount}>{data.next24hCount}</span>
            </div>
            {(() => {
              const tz = "America/Chicago";
              const dateFmt = new Intl.DateTimeFormat("en-CA", {
                timeZone: tz,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              });
              const longFmt = new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                weekday: "long",
                month: "long",
                day: "numeric",
              });
              const now = new Date();
              const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
              const todayCt = dateFmt.format(now);
              const tomorrowCt = dateFmt.format(tomorrow);
              const todayLong = longFmt.format(now);
              const tomorrowLong = longFmt.format(tomorrow);
              const hasTomorrow = data.tomorrowByProperty.some(
                (c) => c.rows.length > 0,
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
              <span className={s.cardCount}>{data.upcomingWeekCount}</span>
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
        </div>
      )}
    </PageShell>
  );
}

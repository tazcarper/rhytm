import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  Heading,
  PageShell,
  Text,
} from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { getAdminBookingDetail } from "@/src/services/admin/get-booking-detail";
import { BookingStatusBadge } from "@/src/components/admin/booking-status-badge";
import { PropertyPill } from "@/src/components/admin/property-pill";
import s from "@/src/components/admin/bid-detail.module.css";

export const dynamic = "force-dynamic";

const BOOKING_TYPE_LABEL: Record<string, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

const AUDIENCE_LABEL: Record<string, string> = {
  public: "Public guest",
  member: "Member",
  partner: "Partner channel",
};

function formatTimestamp(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return `${formatDateLongTz(iso, timezone)} · ${formatSlotLabelTz(
    iso,
    timezone,
  )} CT`;
}

function formatMoneyOrDash(n: number | null): string {
  return n === null ? "—" : `$${formatMoney(n)}`;
}

export default async function AdminBookingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const detail = await getAdminBookingDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  if (detail.bidId) {
    redirect(`/admin/bids/${detail.bidId}`);
  }

  const { booking, property } = detail;
  const tz = property.timezone;

  return (
    <PageShell width="wide">
      <div className={s.header}>
        <Link href="/admin/bookings" className={s.backLink}>
          ← All bookings
        </Link>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Bookings", href: "/admin/bookings" },
            { label: booking.guestName },
          ]}
        />
        <div className={s.titleRow}>
          <Heading level={1} size="h2">
            {booking.guestName}
          </Heading>
          <BookingStatusBadge status={booking.status} />
        </div>
        <Text variant="caption" className={s.slug}>
          {booking.id}
        </Text>
      </div>

      <Card padding="loose" className="mt-6">
        <Heading level={2} size="h4" className={s.sectionTitle}>
          Booking
        </Heading>
        <div className={s.kv}>
          <span className={s.kvKey}>Type</span>
          <span className={s.kvValue}>
            {BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType}
          </span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Property</span>
          <span className={s.kvValue}>
            <PropertyPill name={property.name} slug={property.slug} />
          </span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>When</span>
          <span className={s.kvValue}>{formatTimestamp(booking.startTime, tz)}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Duration</span>
          <span className={s.kvValue}>{booking.durationHours}h</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Guests</span>
          <span className={s.kvValue}>{booking.guestCount}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Audience</span>
          <span className={s.kvValue}>
            {AUDIENCE_LABEL[booking.audienceType] ?? booking.audienceType}
          </span>
        </div>
        {detail.bookedByStaff && (
          <div className={s.kv}>
            <span className={s.kvKey}>Booked by</span>
            <span className={s.kvValue}>
              {detail.bookedByStaff.name} · {detail.bookedByStaff.email}{" "}
              <em>(staff)</em>
            </span>
          </div>
        )}
        <div className={s.kv}>
          <span className={s.kvKey}>Capacity reserved</span>
          <span className={s.kvValue}>{booking.capacityReserved}</span>
        </div>
      </Card>

      <Card padding="loose" className="mt-4">
        <Heading level={2} size="h4" className={s.sectionTitle}>
          Guest
        </Heading>
        <div className={s.kv}>
          <span className={s.kvKey}>Name</span>
          <span className={s.kvValue}>{booking.guestName}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Email</span>
          <span className={s.kvValue}>{booking.guestEmail}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Phone</span>
          <span className={s.kvValue}>{booking.guestPhone ?? "—"}</span>
        </div>
        {booking.guestNotes && (
          <div className={s.notesBlock}>{booking.guestNotes}</div>
        )}
      </Card>

      <Card padding="loose" className="mt-4">
        <Heading level={2} size="h4" className={s.sectionTitle}>
          Pricing
        </Heading>
        <div className={s.kv}>
          <span className={s.kvKey}>Estimated</span>
          <span className={s.kvValue}>{formatMoneyOrDash(booking.estimatedPrice)}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Confirmed</span>
          <span className={s.kvValue}>{formatMoneyOrDash(booking.confirmedPrice)}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Deposit</span>
          <span className={s.kvValue}>{formatMoneyOrDash(booking.depositAmount)}</span>
        </div>
      </Card>

      <Card padding="loose" className="mt-4">
        <Heading level={2} size="h4" className={s.sectionTitle}>
          Timeline
        </Heading>
        <div className={s.kv}>
          <span className={s.kvKey}>Created</span>
          <span className={s.kvValue}>{formatTimestamp(booking.createdAt, tz)}</span>
        </div>
        <div className={s.kv}>
          <span className={s.kvKey}>Updated</span>
          <span className={s.kvValue}>{formatTimestamp(booking.updatedAt, tz)}</span>
        </div>
      </Card>
    </PageShell>
  );
}

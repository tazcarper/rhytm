import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBidUrlForAdmin } from "@/src/services/bids/get-bid-url-for-admin";
import { Button, Card, Divider, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { getAdminBidDetail } from "@/src/services/admin/get-bid-detail";
import { getPropertyCatalog } from "@/src/services/admin/catalog";
import { BidStatusBadge } from "@/src/components/admin/bid-status-badge";
import { PaymentStatusBadge } from "@/src/components/admin/payment-status-badge";
import { BidActions } from "@/src/components/admin/bid-actions";
import { BidUrlCard } from "@/src/components/admin/bid-url-card";
import { WaiverQrButton } from "@/src/components/admin/waiver-qr-button";
import { BidWaiverRoster } from "@/src/components/admin/bid-waiver-roster";
import { BidContentDrawer } from "@/src/components/admin/bid-content-drawer";
import { PricingEditor } from "@/src/components/admin/pricing-editor";
import { BidLineItemsCard } from "@/src/components/admin/bid-line-items-card";
import {
  BidAddOnsEditor,
  type AvailableAddOn,
} from "@/src/components/admin/bid-add-ons-editor";
import { RefundDepositButton } from "@/src/components/admin/refund-deposit-button";
import { PropertyPill } from "@/src/components/admin/property-pill";
import { MarkdownProse } from "@/src/components/shared/markdown";
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

function siteOriginFromHeaders(h: Headers): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}


export default async function AdminBidDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const detail = await getAdminBidDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  const { bid, booking, property, disciplines, addOns, instructor } = detail;
  const tz = property.timezone;

  const origin = siteOriginFromHeaders(await headers());
  const { url: bidUrl } = await getBidUrlForAdmin(supabase, bid.id, origin);

  // Catalog drives which add-ons an admin may attach to each discipline:
  // active add-ons linked (via service_add_ons) to the booking's services.
  const catalog = await getPropertyCatalog(supabase, property.id);
  const linkedAddOnIdsByService = new Map<string, Set<string>>();
  for (const link of catalog.links) {
    const set = linkedAddOnIdsByService.get(link.serviceId) ?? new Set<string>();
    set.add(link.addOnId);
    linkedAddOnIdsByService.set(link.serviceId, set);
  }
  const availableByService: Record<string, AvailableAddOn[]> = {};
  for (const discipline of disciplines) {
    const linked = linkedAddOnIdsByService.get(discipline.id) ?? new Set<string>();
    availableByService[discipline.id] = catalog.addOns
      .filter((addOn) => addOn.isActive && linked.has(addOn.id))
      .map((addOn) => ({
        addOnId: addOn.id,
        name: addOn.name,
        price: addOn.price,
      }));
  }

  const addOnsEditable =
    bid.status === "pending_review" || bid.status === "confirmed";

  const addOnTotal = addOns.reduce(
    (sum, addOn) => sum + addOn.unitPrice * addOn.quantity,
    0,
  );

  // Show the waiver roster once signing is in play (confirmed onward) or as
  // soon as any waiver exists, so staff can track who in the party has signed.
  const showWaiverRoster =
    detail.waiver !== null ||
    detail.partyWaivers.length > 0 ||
    bid.status === "confirmed" ||
    bid.status === "signed" ||
    bid.status === "paid";

  // Primary (bid) signer + each party guest who signed via the QR.
  const signedWaiverCount =
    (detail.waiver ? 1 : 0) + detail.partyWaivers.length;

  return (
    <PageShell width="xl">
      <div className={s.header}>
        <div>
          <AdminBreadcrumb
            segments={[
              { label: "Admin", href: "/admin" },
              { label: "Bids", href: "/admin/bids" },
              { label: booking.guestName },
            ]}
          />
          <div className={s.titleRow}>
            <Heading level={1} size="h2" underline>
              {booking.guestName}
            </Heading>
            <BidStatusBadge status={bid.status} />
            {bid.status === "paid" && (
              <PaymentStatusBadge
                amountPaid={booking.amountPaid}
                depositAmount={booking.depositAmount}
                effectiveQuote={booking.effectiveQuote}
              />
            )}
            <span className={s.slug}>{bid.slug}</span>
          </div>
          <p className={s.bidId} title="Bid ID — click to select for copy">
            ID {bid.id}
          </p>
        </div>
      </div>

      {/* Walk-in waiver quick actions — surfaced up top since staff reach for
          the QR most when a party arrives. */}
      {(bid.status === "confirmed" || bid.status === "paid") && (
        <div className={s.quickBar}>
          <div className={s.quickBarInfo}>
            <span className={s.kvKey}>Waiver</span>
            <span className={s.quickBarStatus}>
              {signedWaiverCount > 0
                ? `${signedWaiverCount} of ${booking.guestCount} signed`
                : "Not signed yet"}
            </span>
          </div>
          <div className={s.quickBarActions}>
            <WaiverQrButton bidId={bid.id} variant="primary" size="lg" />
            {!detail.waiver && (
              <Button asChild variant="secondary" size="lg">
                <Link href={`/admin/bids/${bid.id}/sign`}>Sign in person</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={s.layout}>
        <div className={s.main}>
        <Card padding="loose" elevation="soft" className={s.section}>
          <h2 className={s.sectionTitle}>Booking</h2>
          <dl className={s.kv}>
            <dt className={s.kvKey}>Type</dt>
            <dd className={s.kvValue}>
              {BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType}
            </dd>

            <dt className={s.kvKey}>Property</dt>
            <dd className={s.kvValue}>
              <PropertyPill name={property.name} slug={property.slug} />
            </dd>

            <dt className={s.kvKey}>When</dt>
            <dd className={s.kvValue}>{formatTimestamp(booking.startTime, tz)}</dd>

            <dt className={s.kvKey}>Duration</dt>
            <dd className={s.kvValue}>
              {booking.durationHours} {booking.durationHours === 1 ? "hour" : "hours"}
            </dd>

            <dt className={s.kvKey}>Instructor</dt>
            <dd className={s.kvValue}>
              {instructor?.name ?? <span className={s.empty}>None</span>}
            </dd>

            <dt className={s.kvKey}>Capacity used</dt>
            <dd className={s.kvValue}>{booking.capacityReserved}</dd>

            <dt className={s.kvKey}>Channel</dt>
            <dd className={s.kvValue}>
              {AUDIENCE_LABEL[booking.audienceType] ?? booking.audienceType}
            </dd>

            {booking.bookedByStaff && (
              <>
                <dt className={s.kvKey}>Booked by</dt>
                <dd className={s.kvValue}>
                  {booking.bookedByStaff.name}
                  <br />
                  <a href={`mailto:${booking.bookedByStaff.email}`}>
                    {booking.bookedByStaff.email}
                  </a>{" "}
                  <em>(staff)</em>
                </dd>
              </>
            )}
          </dl>
        </Card>

        <Card padding="loose" elevation="soft" className={s.section}>
          <h2 className={s.sectionTitle}>Guest</h2>
          <dl className={s.kv}>
            <dt className={s.kvKey}>Name</dt>
            <dd className={s.kvValue}>{booking.guestName}</dd>

            <dt className={s.kvKey}>Email</dt>
            <dd className={s.kvValue}>
              <a href={`mailto:${booking.guestEmail}`}>{booking.guestEmail}</a>
            </dd>

            <dt className={s.kvKey}>Phone</dt>
            <dd className={s.kvValue}>
              {booking.guestPhone ? (
                <a href={`tel:${booking.guestPhone}`}>{booking.guestPhone}</a>
              ) : (
                <span className={s.empty}>—</span>
              )}
            </dd>

            <dt className={s.kvKey}>Party size</dt>
            <dd className={s.kvValue}>{booking.guestCount}</dd>
          </dl>

          {booking.guestNotes && (
            <>
              <Divider />
              <Text variant="caption" className="text-gray">
                Guest notes
              </Text>
              <div className={s.notesBlock}>{booking.guestNotes}</div>
            </>
          )}
        </Card>

        {showWaiverRoster && (
          <BidWaiverRoster
            className={`${s.section} ${s.mainSpan2}`}
            bidId={bid.id}
            partySize={booking.guestCount}
            timezone={tz}
            primary={
              detail.waiver
                ? { signedName: detail.waiver.signedName, signedAt: bid.signedAt }
                : null
            }
            partyWaivers={detail.partyWaivers}
          />
        )}

        <BidAddOnsEditor
          className={`${s.section} ${s.mainSpan2}`}
          bidId={bid.id}
          bookingId={booking.id}
          editable={addOnsEditable}
          disciplines={disciplines}
          addOns={addOns}
          availableByService={availableByService}
        />

        <Card padding="loose" elevation="soft" className={`${s.section} ${s.mainSpan2}`}>
          <h2 className={s.sectionTitle}>Bid content</h2>

          <Text variant="caption" className="text-gray">
            Schedule notes
          </Text>
          {bid.scheduleNotes ? (
            <div className={s.notesBlock}>
              <MarkdownProse>{bid.scheduleNotes}</MarkdownProse>
            </div>
          ) : (
            <p className={s.empty}>None.</p>
          )}

          <Divider />

          <Text variant="caption" className="text-gray">
            Gear list ({bid.gearList.length})
          </Text>
          {bid.gearList.length === 0 ? (
            <p className={s.empty}>None.</p>
          ) : (
            <ul className={s.list}>
              {bid.gearList.map((g, i) => (
                <li key={i} className={s.listItem}>
                  <p className={s.disciplineName}>{g.name}</p>
                  {g.description && (
                    <MarkdownProse small>{g.description}</MarkdownProse>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Divider />

          <Text variant="caption" className="text-gray">
            FAQ ({bid.faq.length})
          </Text>
          {bid.faq.length === 0 ? (
            <p className={s.empty}>None.</p>
          ) : (
            <ul className={s.list}>
              {bid.faq.map((f, i) => (
                <li key={i} className={s.faqItem}>
                  <p className={s.faqQ}>{f.question}</p>
                  <MarkdownProse small>{f.answer}</MarkdownProse>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="loose" elevation="soft" className={`${s.section} ${s.mainSpan2}`}>
          <h2 className={s.sectionTitle}>Staff notes</h2>
          <p className={s.privateBanner}>Internal — not shown to the guest.</p>
          {bid.staffNotes ? (
            <div className={s.notesBlock}>
              <MarkdownProse>{bid.staffNotes}</MarkdownProse>
            </div>
          ) : (
            <p className={s.empty}>No staff notes yet.</p>
          )}

          {bid.status === "denied" && bid.denialReason && (
            <>
              <Divider />
              <Text variant="caption" className="text-gray">
                Denial reason
              </Text>
              <div className={s.notesBlock}>
                <MarkdownProse>{bid.denialReason}</MarkdownProse>
              </div>
            </>
          )}
        </Card>
        </div>

        <aside className={s.rail}>
          <Card padding="loose" elevation="soft" className={s.section}>
            <h2 className={s.sectionTitle}>Actions</h2>
            <div className={s.railActions}>
              <BidContentDrawer
                bidId={bid.id}
                scheduleNotes={bid.scheduleNotes}
                staffNotes={bid.staffNotes}
                gearList={bid.gearList}
                faq={bid.faq}
              />
              <BidActions bidId={bid.id} status={bid.status} />
              {bid.status === "paid" &&
                bid.refundPaymentIntentId === null &&
                booking.amountPaid > 0 && (
                  <RefundDepositButton
                    bidId={bid.id}
                    amountPaid={booking.amountPaid}
                  />
                )}
            </div>
          </Card>

          <BidUrlCard bidId={bid.id} status={bid.status} bidUrl={bidUrl} />

          <PricingEditor
            bidId={bid.id}
            bookingId={booking.id}
            estimatedPrice={booking.estimatedPrice}
            confirmedPrice={booking.confirmedPrice}
            depositAmount={booking.depositAmount}
            amountPaid={booking.amountPaid}
            effectiveQuote={booking.effectiveQuote}
            quoteNote={bid.quoteNote}
            refundAmount={bid.refundAmount}
            paid={bid.paidAt !== null}
            addOnTotal={addOnTotal}
          />

          <BidLineItemsCard lineItems={detail.lineItems} />

          <Card padding="loose" elevation="soft" className={s.section}>
            <h2 className={s.sectionTitle}>Lifecycle</h2>
            <dl className={s.kv}>
              <dt className={s.kvKey}>Created</dt>
              <dd className={s.kvValue}>{formatTimestamp(bid.createdAt, tz)}</dd>

              <dt className={s.kvKey}>Updated</dt>
              <dd className={s.kvValue}>{formatTimestamp(bid.updatedAt, tz)}</dd>

              <dt className={s.kvKey}>Paid</dt>
              <dd className={s.kvValue}>
                {bid.paidAt ? (
                  formatTimestamp(bid.paidAt, tz)
                ) : (
                  <span className={s.empty}>—</span>
                )}
              </dd>

              <dt className={s.kvKey}>Signed</dt>
              <dd className={s.kvValue}>
                {bid.signedAt ? (
                  formatTimestamp(bid.signedAt, tz)
                ) : (
                  <span className={s.empty}>—</span>
                )}
              </dd>

              <dt className={s.kvKey}>Waiver</dt>
              <dd className={s.kvValue}>
                {detail.waiver ? (
                  <>
                    <a
                      href={`/admin/bids/${bid.id}/waiver`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View signed waiver →
                    </a>
                    <br />
                    <span
                      className={s.empty}
                      style={{ fontSize: "var(--text-micro)" }}
                      title={`SHA-256 ${detail.waiver.sha256}`}
                    >
                      verified · sha256 {detail.waiver.sha256.slice(0, 12)}…
                    </span>
                  </>
                ) : bid.dropboxSignEnvelopeId ? (
                  <code style={{ fontSize: "var(--text-micro)" }}>
                    {bid.dropboxSignEnvelopeId}
                  </code>
                ) : bid.status === "confirmed" || bid.status === "paid" ? (
                  <Link href={`/admin/bids/${bid.id}/sign`}>Sign in person →</Link>
                ) : (
                  <span className={s.empty}>—</span>
                )}
              </dd>

              <dt className={s.kvKey}>Cancelled</dt>
              <dd className={s.kvValue}>
                {bid.cancelledAt ? (
                  formatTimestamp(bid.cancelledAt, tz)
                ) : (
                  <span className={s.empty}>—</span>
                )}
              </dd>

              <dt className={s.kvKey}>Expires</dt>
              <dd className={s.kvValue}>
                {bid.expiresAt ? (
                  formatTimestamp(bid.expiresAt, tz)
                ) : (
                  <span className={s.empty}>—</span>
                )}
              </dd>
            </dl>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

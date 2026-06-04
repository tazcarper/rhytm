import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicAdventure } from "@/src/services/public/adventures";
import { adventureDateLabel } from "@/src/services/adventures/display";
import { Alert, Card, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { AdventureCheckout } from "@/src/components/public/adventure-checkout";
import { WaitlistForm } from "@/src/components/public/waitlist-form";

export const dynamic = "force-dynamic";

// Member-gated checkout for an adventure (full payment at RSVP). Non-
// members are sent to sign in; coming-soon / sold-out bounce back to the
// detail page. Members with no membership at this club see a notice.
export default async function ReserveAdventurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "member") {
    redirect(`/login?next=${encodeURIComponent(`/adventures/${id}/reserve`)}`);
  }

  const adventure = await getPublicAdventure(supabase, id);
  if (!adventure) notFound();
  if (adventure.comingSoon) {
    redirect(`/adventures/${id}`);
  }
  const soldOut = adventure.isSoldOut;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .eq("property_id", adventure.propertyId)
    .limit(1);
  const eligible = !!memberships?.[0];

  return (
    <PageShell width="narrow">
      <Link
        href={`/adventures/${id}`}
        className="inline-block font-sans text-[12px] tracking-[1px] uppercase text-tan-deep no-underline mb-4 hover:text-olive"
      >
        &larr; Back to adventure
      </Link>

      <Eyebrow as="div" className="mb-2">
        {soldOut ? "Waitlist" : "Reserve"}
      </Eyebrow>
      <Heading level={1} size="h2">
        {adventure.title}
      </Heading>
      <p className="font-serif italic text-[16px] text-gray mt-1 mb-6">
        {[adventure.location, adventureDateLabel(adventure)].filter(Boolean).join("  ·  ")}
      </p>

      {eligible ? (
        <Card padding="loose">
          {soldOut ? (
            <WaitlistForm
              adventureId={adventure.id}
              maxGuests={adventure.pricing.maxGuestsPerRsvp}
            />
          ) : (
            <AdventureCheckout
              adventureId={adventure.id}
              price={adventure.pricing.price}
              guestPrice={adventure.pricing.guestPrice}
              maxGuests={adventure.pricing.maxGuestsPerRsvp}
              paymentMode={adventure.paymentMode}
              depositAmount={adventure.depositAmount}
              freeCancellationDays={adventure.freeCancellationDays}
            />
          )}
        </Card>
      ) : (
        <Alert variant="info" title="Members only">
          This adventure is reserved for members of {adventure.propertyName}.
          Reach the concierge if you&rsquo;d like to join.
        </Alert>
      )}
    </PageShell>
  );
}

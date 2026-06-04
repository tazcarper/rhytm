import Link from "next/link";
import { Alert } from "@/lib/ui";
import type { MyAdventureTrip } from "@/src/services/members/adventures";
import { MyAdventureCard } from "./my-adventure-card";

// "My trips" list for /member/adventures — the adventures the member has
// reserved (confirmed or waitlisted). Read-only; browsing + sign-up are
// on the public /adventures surface.
export function AdventuresList({
  trips,
  error,
}: {
  trips: MyAdventureTrip[];
  error?: { message: string } | null;
}) {
  if (error) {
    return (
      <Alert variant="error" title="Could not load your adventures">
        {error.message}
      </Alert>
    );
  }

  if (trips.length === 0) {
    return (
      <Alert variant="info" title="No adventures yet">
        You haven&rsquo;t reserved any adventures.{" "}
        <Link href="/adventures" className="text-olive underline">
          Browse what&rsquo;s coming &rarr;
        </Link>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {trips.map((trip) => (
        <MyAdventureCard key={trip.adventureId} trip={trip} />
      ))}
    </div>
  );
}

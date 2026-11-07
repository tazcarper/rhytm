import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvent } from "@/src/services/public/events";
import { getPublicInstructorsForProperty } from "@/src/services/public/instructors";
import { EventDetailView } from "@/src/components/public/property-template/event-detail-view";

export const dynamic = "force-dynamic";

export default async function PacksaddleEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [event, { data: property }] = await Promise.all([
    getPublicEvent(supabase, id),
    getPublicPropertyBySlug(supabase, "packsaddle"),
  ]);

  if (!event) {
    notFound();
  }

  const instructorRoster = property ? await getPublicInstructorsForProperty(supabase, property.id) : [];

  return (
    <EventDetailView
      event={event}
      basePath="/packsaddle"
      propertyName={property?.name ?? "Packsaddle Precision"}
      instructorRoster={instructorRoster}
    />
  );
}

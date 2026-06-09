import type { SupabaseClient } from "@supabase/supabase-js";

// Reads for the instructor-first WHEN step. Each wraps a SECURITY DEFINER RPC
// (granted to anon) that computes availability from the staff-only schedule
// tables without exposing them. Times are property-local; slot keys are the raw
// "HH:MM:SS" the booking funnel already keys slots by.

export interface QualifiedInstructor {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  displayOrder: number;
  // First bookable date in the queried range, or null if none — used to default
  // the picker to the first *available* instructor.
  nextAvailableDate: string | null;
}

export async function getQualifiedInstructors(
  supabase: SupabaseClient,
  args: {
    propertyId: string;
    serviceIds: ReadonlyArray<string>;
    durationHours: number;
    fromISO: string;
    toISO: string;
  },
): Promise<QualifiedInstructor[]> {
  const { data, error } = await supabase.rpc("list_qualified_instructors", {
    p_property_id: args.propertyId,
    p_service_ids: args.serviceIds,
    p_duration_hours: args.durationHours,
    p_from: args.fromISO,
    p_to: args.toISO,
  });

  if (error) {
    throw new Error(`Qualified instructors failed: ${error.message}`);
  }

  return (
    (data ?? []) as Array<{
      instructor_id: string;
      name: string;
      bio: string | null;
      photo_url: string | null;
      display_order: number;
      next_available_date: string | null;
    }>
  ).map((row) => ({
    id: row.instructor_id,
    name: row.name,
    bio: row.bio,
    photoUrl: row.photo_url,
    displayOrder: row.display_order,
    nextAvailableDate: row.next_available_date,
  }));
}

export async function getInstructorAvailableDates(
  supabase: SupabaseClient,
  args: {
    instructorId: string;
    propertyId: string;
    durationHours: number;
    fromISO: string;
    toISO: string;
  },
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_instructor_available_dates", {
    p_instructor_id: args.instructorId,
    p_property_id: args.propertyId,
    p_duration_hours: args.durationHours,
    p_from: args.fromISO,
    p_to: args.toISO,
  });

  if (error) {
    throw new Error(`Instructor available dates failed: ${error.message}`);
  }

  return ((data ?? []) as Array<{ available_date: string }>).map(
    (row) => row.available_date,
  );
}

// Map of slotStart ("HH:MM:SS") → is the chosen instructor bookable then.
export async function getInstructorSlotAvailability(
  supabase: SupabaseClient,
  args: {
    instructorId: string;
    propertyId: string;
    dateISO: string;
    durationHours: number;
  },
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.rpc("get_instructor_slot_availability", {
    p_instructor_id: args.instructorId,
    p_property_id: args.propertyId,
    p_date: args.dateISO,
    p_duration_hours: args.durationHours,
  });

  if (error) {
    throw new Error(`Instructor slot availability failed: ${error.message}`);
  }

  const availabilityBySlot: Record<string, boolean> = {};
  for (const row of (data ?? []) as Array<{ slot_start: string; is_available: boolean }>) {
    availabilityBySlot[row.slot_start] = row.is_available;
  }
  return availabilityBySlot;
}

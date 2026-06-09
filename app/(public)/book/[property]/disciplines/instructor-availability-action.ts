"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getQualifiedInstructors,
  getInstructorAvailableDates,
  getInstructorSlotAvailability,
  type QualifiedInstructor,
} from "@/src/services/public/instructor-availability";

// Server Action wrappers for the instructor-first WHEN step, called by the
// client picker. The RPCs are SECURITY DEFINER + granted to anon, so the
// cookie-aware client is enough. Each fails safe so a transient RPC error never
// hard-crashes the funnel — the create path re-validates the instructor at
// submit regardless.

export async function getQualifiedInstructorsAction(args: {
  propertyId: string;
  serviceIds: string[];
  durationHours: number;
  fromISO: string;
  toISO: string;
}): Promise<QualifiedInstructor[]> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getQualifiedInstructors(supabase, args);
  } catch {
    return [];
  }
}

// null = couldn't compute → the calendar should NOT restrict dates (fail open).
export async function getInstructorAvailableDatesAction(args: {
  instructorId: string;
  propertyId: string;
  durationHours: number;
  fromISO: string;
  toISO: string;
}): Promise<string[] | null> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getInstructorAvailableDates(supabase, args);
  } catch {
    return null;
  }
}

// null = couldn't compute → the slot grid fails open (shows all); create path
// still rejects a genuinely unavailable slot at submit.
export async function getInstructorSlotAvailabilityAction(args: {
  instructorId: string;
  propertyId: string;
  dateISO: string;
  durationHours: number;
}): Promise<Record<string, boolean> | null> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getInstructorSlotAvailability(supabase, args);
  } catch {
    return null;
  }
}

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Admin schedule data for one instructor: the recurring weekly windows and the
// date-specific exceptions. Reads go through the caller's staff RLS scope;
// writes are delegated by the Server Actions to the service-role client (the
// recurring set via the save_instructor_schedule RPC for atomicity, exceptions
// as single-row insert/delete). Times are property-local "HH:MM" strings.

export type ExceptionKind = "unavailable" | "available";

export interface AvailabilityWindow {
  id: string;
  propertyId: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface ScheduleException {
  id: string;
  propertyId: string | null; // null = all properties
  date: string; // "YYYY-MM-DD"
  kind: ExceptionKind;
  startTime: string | null; // null = whole day
  endTime: string | null;
  reason: string | null;
}

export interface InstructorSchedule {
  windows: AvailabilityWindow[];
  exceptions: ScheduleException[];
}

export type ScheduleMutationResult = { ok: true } | { ok: false; error: string };

// Postgres `time` arrives as "HH:MM:SS"; <input type="time"> wants "HH:MM".
function toClockTime(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

export async function getInstructorSchedule(
  supabase: SupabaseClient,
  instructorId: string,
): Promise<InstructorSchedule> {
  const [windowsResult, exceptionsResult] = await Promise.all([
    supabase
      .from("instructor_availability")
      .select("id, property_id, day_of_week, start_time, end_time")
      .eq("instructor_id", instructorId)
      .order("property_id")
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("instructor_availability_exceptions")
      .select("id, property_id, exception_date, kind, start_time, end_time, reason")
      .eq("instructor_id", instructorId)
      .order("exception_date"),
  ]);

  if (windowsResult.error) {
    throw new Error(`Instructor availability read failed: ${windowsResult.error.message}`);
  }
  if (exceptionsResult.error) {
    throw new Error(`Instructor exceptions read failed: ${exceptionsResult.error.message}`);
  }

  const windows = (
    (windowsResult.data ?? []) as Array<{
      id: string;
      property_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>
  ).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  }));

  const exceptions = (
    (exceptionsResult.data ?? []) as Array<{
      id: string;
      property_id: string | null;
      exception_date: string;
      kind: ExceptionKind;
      start_time: string | null;
      end_time: string | null;
      reason: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    date: row.exception_date,
    kind: row.kind,
    startTime: toClockTime(row.start_time),
    endTime: toClockTime(row.end_time),
    reason: row.reason,
  }));

  return { windows, exceptions };
}

// =============================================================================
// Recurring weekly schedule (replace-all via RPC)
// =============================================================================

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time.");

const ScheduleWindowSchema = z
  .object({
    propertyId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: clockTime,
    endTime: clockTime,
  })
  // Zero-padded HH:MM compares correctly as a string.
  .refine((windowInput) => windowInput.startTime < windowInput.endTime, {
    message: "Each window's end time must be after its start time.",
    path: ["endTime"],
  });

export const SaveInstructorScheduleSchema = z.object({
  instructorId: z.string().uuid(),
  windows: z.array(ScheduleWindowSchema).max(200),
});
export type SaveInstructorScheduleInput = z.infer<typeof SaveInstructorScheduleSchema>;

export async function saveInstructorSchedule(
  admin: SupabaseClient,
  input: SaveInstructorScheduleInput,
): Promise<ScheduleMutationResult> {
  const { error } = await admin.rpc("save_instructor_schedule", {
    p_instructor_id: input.instructorId,
    p_windows: input.windows.map((windowInput) => ({
      property_id: windowInput.propertyId,
      day_of_week: windowInput.dayOfWeek,
      start_time: windowInput.startTime,
      end_time: windowInput.endTime,
    })),
  });

  if (error) {
    if (error.code === "P0002") return { ok: false, error: "Instructor not found." };
    // FK to instructor_properties — a window targets an unassigned property.
    if (error.code === "23503") {
      return {
        ok: false,
        error: "A window targets a property this instructor isn't assigned to.",
      };
    }
    if (error.code === "23514") {
      return { ok: false, error: "Each window's end time must be after its start time." };
    }
    return { ok: false, error: "Couldn't save the schedule — try again." };
  }
  return { ok: true };
}

// =============================================================================
// Date-specific exceptions (single-row add / delete)
// =============================================================================

export const AddInstructorExceptionSchema = z
  .object({
    instructorId: z.string().uuid(),
    propertyId: z.string().uuid().nullable(), // null = all properties
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    kind: z.enum(["unavailable", "available"]),
    startTime: clockTime.nullable(), // null = whole day
    endTime: clockTime.nullable(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((exception) => (exception.startTime === null) === (exception.endTime === null), {
    message: "Set both a start and end time, or neither.",
    path: ["endTime"],
  })
  .refine(
    (exception) =>
      exception.startTime === null ||
      exception.endTime === null ||
      exception.startTime < exception.endTime,
    { message: "End time must be after start time.", path: ["endTime"] },
  )
  .refine(
    (exception) =>
      exception.kind !== "available" ||
      (exception.propertyId !== null && exception.startTime !== null),
    {
      message: "One-off availability needs a specific property and a time window.",
      path: ["kind"],
    },
  );
export type AddInstructorExceptionInput = z.infer<typeof AddInstructorExceptionSchema>;

export async function addInstructorException(
  admin: SupabaseClient,
  input: AddInstructorExceptionInput,
): Promise<ScheduleMutationResult> {
  const { error } = await admin.from("instructor_availability_exceptions").insert({
    instructor_id: input.instructorId,
    property_id: input.propertyId,
    exception_date: input.date,
    kind: input.kind,
    start_time: input.startTime,
    end_time: input.endTime,
    reason: input.reason?.trim() || null,
  });

  if (error) {
    // CHECK constraints (window validity / available-must-be-scoped).
    if (error.code === "23514") {
      return { ok: false, error: "That exception's times aren't valid for its kind." };
    }
    return { ok: false, error: "Couldn't add the exception — try again." };
  }
  return { ok: true };
}

export async function deleteInstructorException(
  admin: SupabaseClient,
  instructorId: string,
  exceptionId: string,
): Promise<ScheduleMutationResult> {
  // Scope by instructor_id too, so an id alone can't delete another
  // instructor's exception.
  const { error } = await admin
    .from("instructor_availability_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("instructor_id", instructorId);

  if (error) {
    return { ok: false, error: "Couldn't remove the exception — try again." };
  }
  return { ok: true };
}

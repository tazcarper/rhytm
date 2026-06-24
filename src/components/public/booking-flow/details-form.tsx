"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { Alert, Button, FormField, Input, Textarea } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { StepBackLink } from "./step-back-link";
import { BookingSummary } from "./booking-summary";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  buildBookingSummary,
  type PricingByBookingType,
} from "@/src/services/public/pricing";
import type { PublicService } from "@/src/services/public/services";
import type { BookingFlowState, GuestInfo } from "./booking-flow-types";
import { isSubmittable } from "./booking-flow-types";
import { submitBookingAction } from "@/app/(public)/book/[property]/submit/action";
import s from "./details-form.module.css";

interface DetailsFormProps {
  propertyId: string;
  services: ReadonlyArray<PublicService>;
  pricingByType: PricingByBookingType;
}

type FieldErrors = Partial<Record<keyof GuestInfo, string>>;

export function DetailsForm({
  propertyId,
  services,
  pricingByType,
}: DetailsFormProps) {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state, setState } = useBookingFlow();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [company, setCompany] = useState(""); // honeypot — empty for real users
  const [isPending, startTransition] = useTransition();

  if (!state.bookingType) return null;
  const pricing = pricingByType[state.bookingType] ?? null;

  const guest = state.guest ?? {};

  function updateGuest(patch: Partial<GuestInfo>) {
    setState({ guest: { ...guest, ...patch } });
    const touched = Object.keys(patch) as Array<keyof GuestInfo>;
    if (touched.some((k) => errors[k] !== undefined)) {
      setErrors((prev) => {
        const next = { ...prev };
        for (const k of touched) delete next[k];
        return next;
      });
    }
    if (submitError) setSubmitError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const parsed = guestSchema.safeParse({
      name: guest.name ?? "",
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      notes: guest.notes ?? "",
    });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof GuestInfo;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setState({ guest: parsed.data });

    // Construct the "as if persisted" state — setState is async; the local
    // `state` still points at the pre-call value. isSubmittable() narrows the
    // type so the submit payload is built without non-null assertions.
    const nextState: BookingFlowState = { ...state, guest: parsed.data };
    if (!isSubmittable(nextState)) {
      setSubmitError(
        "Something's missing — please go back and check your selections.",
      );
      return;
    }

    const summary = buildBookingSummary({
      bookingType: nextState.bookingType,
      pricing,
      guestCount: nextState.guestCount,
      juniorGuestCount: nextState.juniorGuestCount,
      durationHours: nextState.durationHours,
      selections: nextState.disciplineSelections,
      services,
    });

    const flatAddOns = nextState.disciplineSelections.flatMap((d) =>
      d.addOns.map((sel) => ({
        serviceId: d.serviceId,
        addOnId: sel.addOnId,
        quantity: sel.quantity,
      })),
    );

    startTransition(async () => {
      const result = await submitBookingAction(
        {
          propertyId,
          bookingType: nextState.bookingType,
          date: nextState.date,
          slotStart: nextState.slotStart,
          durationHours: nextState.durationHours,
          instructorId: nextState.instructorId ?? null,
          guest: nextState.guest,
          guestCount: nextState.guestCount,
          juniorGuestCount: nextState.juniorGuestCount,
          estimatedPrice: summary.estimateTotal,
          disciplineIds: nextState.disciplineSelections.map((d) => d.serviceId),
          addOns: flatAddOns,
        },
        company,
      );

      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <>
      <StepBackLink
        href={`/book/${propertySlug}/disciplines`}
        label="Change booking"
      />
      {/* Honeypot — hidden from real users; bots that autofill it are rejected. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      {submitError && (
        <Alert variant="error" title="Couldn't submit your booking">
          {submitError}
        </Alert>
      )}

      <form className={s.layout} onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <FormField label="Name" required error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={guest.name ?? ""}
                onChange={(e) => updateGuest({ name: e.target.value })}
                autoComplete="name"
                maxLength={100}
                placeholder="Your full name"
                disabled={isPending}
              />
            )}
          </FormField>

          <FormField label="Email" required error={errors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={guest.email ?? ""}
                onChange={(e) => updateGuest({ email: e.target.value })}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={isPending}
              />
            )}
          </FormField>

          <FormField label="Phone (optional)" error={errors.phone}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                value={guest.phone ?? ""}
                onChange={(e) => updateGuest({ phone: e.target.value })}
                autoComplete="tel"
                placeholder="(512) 555-0100"
                disabled={isPending}
              />
            )}
          </FormField>

          <FormField label="Anything else? (optional)" error={errors.notes}>
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={guest.notes ?? ""}
                onChange={(e) => updateGuest({ notes: e.target.value })}
                maxLength={1000}
                placeholder="Special requests, accessibility needs, who else is coming..."
                disabled={isPending}
              />
            )}
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className={s.submit}
            loading={isPending}
          >
            {isPending ? "Submitting…" : "Submit booking →"}
          </Button>
        </div>

        <BookingSummary services={services} pricing={pricing} />
      </form>
    </>
  );
}

const guestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(100, "That's a bit too long."),
  email: z.string().trim().email("That doesn't look like a valid email."),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s+\-().]{7,}$/, "Please enter a valid phone number.")
    .or(z.literal(""))
    .default(""),
  notes: z.string().max(1000, "Keep notes under 1000 characters.").default(""),
});

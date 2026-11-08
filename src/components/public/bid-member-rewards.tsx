"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { linkMemberNumberAction } from "@/app/(public)/bids/[slug]/[code]/rewards-actions";
import s from "./deposit-payment-form.module.css";

// "Are you a member? Earn points on this booking." Lets a guest tie the
// booking to their membership by member number + last name before paying.
// Once linked, shows a one-line confirmation instead of the form.

interface BidMemberRewardsProps {
  bidSlug: string;
  bidAccessCode: string;
  linkedMemberNumber: string | null;
  /** True when the signed-in viewer can already apply points (no need to ask). */
  viewerIsLinkedMember: boolean;
}

export function BidMemberRewards({
  bidSlug,
  bidAccessCode,
  linkedMemberNumber,
  viewerIsLinkedMember,
}: BidMemberRewardsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberNumber, setMemberNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (linkedMemberNumber) {
    return (
      <p className={s.amountPickerHint}>
        Earning reward points for member #{linkedMemberNumber}.
      </p>
    );
  }
  if (viewerIsLinkedMember) {
    return (
      <p className={s.amountPickerHint}>
        You&rsquo;ll earn reward points on this payment.
      </p>
    );
  }

  if (!open) {
    return (
      <p className={s.amountPickerHint}>
        Are you a member?{" "}
        <button type="button" className="underline" onClick={() => setOpen(true)}>
          Add your member number
        </button>{" "}
        to earn reward points on this booking.
      </p>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await linkMemberNumberAction(bidSlug, bidAccessCode, memberNumber, lastName);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <form className={s.amountPicker} onSubmit={handleSubmit}>
      <p className={s.amountPickerLabel}>Earn reward points on this booking</p>
      <div className={s.amountPickerRow}>
        <input
          aria-label="Member number"
          className={s.amountPickerInput}
          placeholder="Member number"
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
          autoComplete="off"
          required
        />
        <input
          aria-label="Last name on the membership"
          className={s.amountPickerInput}
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          required
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Checking…" : "Add"}
        </Button>
      </div>
      {error && <Alert variant="warn">{error}</Alert>}
      <p className={s.amountPickerHint}>
        Members earn 1 point for every $1 paid. Your points show up in your member profile.
      </p>
    </form>
  );
}

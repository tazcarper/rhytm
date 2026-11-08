"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import formStyles from "@/src/components/admin/form-styles.module.css";
import { setRewardExpiryAction } from "@/app/admin/rewards/actions";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";

// Move a household's soft expiration date. The balance never changes —
// this only decides whether the points can be used.

export function RewardExpiryForm({
  membershipId,
  currentExpiresOn,
}: {
  membershipId: string;
  /** YYYY-MM-DD, or "" when no date is set yet. */
  currentExpiresOn: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentExpiresOn);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await setRewardExpiryAction(membershipId, value);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className={`${formStyles.row} items-end`}>
        <label className={`${formStyles.field} ${formStyles.fit}`}>
          <span className={formStyles.label}>Points can be used until</span>
          <input
            type="date"
            className={`${formStyles.input} ${formStyles.wDate}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="secondary" disabled={saving || !value}>
          {saving ? "Saving…" : "Update date"}
        </Button>
      </div>
      <p className={formStyles.help}>
        Resets automatically to {REWARDS_PROGRAM.expiryMonths} months out whenever the household earns or uses points.
      </p>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}

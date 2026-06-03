import type { SupabaseClient } from "@supabase/supabase-js";

// Reads the singleton `reminder_settings` row — the config-in-DB cadence
// knobs the pre-event reminder engine plans against. Admins edit these
// values (no redeploy) when the client confirms the cadence (Q15).
//
// Dependency-inverted: takes the Supabase client. The cadence engine passes
// the service-role client (bypasses RLS); an admin settings page would pass
// the cookie-aware server client.

export interface ReminderCadence {
  enabled: boolean;
  earlyOffsetDays: number;
  midOffsetDays: number;
  finalOffsetDays: number;
  followupOffsetDays: number;
  membershipCtaEnabled: boolean;
  // W2 staff digest of confirmed-but-unsigned bids.
  unsignedDigestEnabled: boolean;
  unsignedDigestHours: number;
}

type ReminderSettingsRow = {
  enabled: boolean;
  early_offset_days: number;
  mid_offset_days: number;
  final_offset_days: number;
  followup_offset_days: number;
  membership_cta_enabled: boolean;
  unsigned_digest_enabled: boolean;
  unsigned_digest_hours: number;
};

// Fallback used only if the singleton row is somehow missing (e.g. a fresh
// DB before the seed insert). Mirrors the migration defaults so the engine
// degrades to sensible behavior rather than throwing.
const DEFAULT_CADENCE: ReminderCadence = {
  enabled: true,
  earlyOffsetDays: 14,
  midOffsetDays: 3,
  finalOffsetDays: 1,
  followupOffsetDays: 1,
  membershipCtaEnabled: false,
  unsignedDigestEnabled: true,
  unsignedDigestHours: 48,
};

export async function getReminderCadence(
  supabase: SupabaseClient,
): Promise<ReminderCadence> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select(
      "enabled, early_offset_days, mid_offset_days, final_offset_days, followup_offset_days, membership_cta_enabled, unsigned_digest_enabled, unsigned_digest_hours",
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`reminder_settings read failed: ${error.message}`);
  }
  if (!data) return DEFAULT_CADENCE;

  const row = data as ReminderSettingsRow;
  return {
    enabled: row.enabled,
    earlyOffsetDays: row.early_offset_days,
    midOffsetDays: row.mid_offset_days,
    finalOffsetDays: row.final_offset_days,
    followupOffsetDays: row.followup_offset_days,
    membershipCtaEnabled: row.membership_cta_enabled,
    unsignedDigestEnabled: row.unsigned_digest_enabled,
    unsignedDigestHours: row.unsigned_digest_hours,
  };
}

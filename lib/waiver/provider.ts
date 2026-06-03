export type WaiverProvider = "native" | "dropbox_sign";

// Feature switch for the waiver signing backend.
//
// Defaults to the homegrown "native" path (typed signature -> PDF ->
// Supabase Storage). Set WAIVER_PROVIDER=dropbox_sign to revert to the
// (now deprecated) Dropbox Sign embedded flow, which is kept intact as a
// fallback.
//
// The native and vendor paths have genuinely different shapes — native is
// a synchronous submit; the vendor path is an async envelope + embedded
// iframe + webhook — so this is a deliberate strategy switch read at the
// call sites (bid page signature slot, confirmBid envelope creation)
// rather than a forced unified interface.
export function getWaiverProvider(): WaiverProvider {
  return process.env.WAIVER_PROVIDER === "dropbox_sign"
    ? "dropbox_sign"
    : "native";
}

// Client-facing release notes ("patch notes") shown in the admin portal at
// /admin/release-notes. Authored by hand — NOT an operational knob an admin
// edits, so it lives in code rather than the DB (cf. config-in-DB rule,
// which is for runtime knobs). To cut a new patch: add an entry to the TOP
// of RELEASE_PATCHES (newest first) summarizing user-facing changes since
// the previous patch's cutoff commit, written for the client, not the dev.
//
// Each patch is organized into thematic SECTIONS (e.g. "Member Adventures",
// "Emails & notifications"); every change carries a kind tag
// (new / improved / fixed) rendered as a chip.

export type ReleaseChangeKind = "new" | "improved" | "fixed";

export interface ReleaseChange {
  kind: ReleaseChangeKind;
  title: string;
  detail?: string;
}

export interface ReleaseSection {
  /** Feature-area heading, e.g. "Member Adventures". */
  title: string;
  changes: ReleaseChange[];
}

export interface ReleasePatch {
  /** Stable slug for anchors/keys, e.g. "patch-1". */
  id: string;
  /** Short label shown as a pill, e.g. "Patch 1". */
  label: string;
  /** Headline for the patch. */
  title: string;
  /** Release date, 'YYYY-MM-DD'. */
  date: string;
  /** One- or two-sentence intro, client-facing. */
  summary: string;
  /** Thematic sub-sections, in display order. */
  sections: ReleaseSection[];
}

// Newest patch first.
export const RELEASE_PATCHES: ReleasePatch[] = [
  {
    id: "patch-2",
    label: "Patch 2",
    title: "Your team & booking for customers",
    date: "2026-06-04",
    summary:
      "Tools for running your team — invite staff, onboard them, and manage their access — plus a way for staff to book visits on behalf of call-in and walk-in customers, with every booking attributed to whoever made it.",
    sections: [
      {
        title: "Your team",
        changes: [
          {
            kind: "new",
            title: "Invite teammates",
            detail:
              "Admins can add a staff member by email and role. They get an invite link and join the admin portal directly — no more behind-the-scenes setup.",
          },
          {
            kind: "new",
            title: "Everyone has a name",
            detail:
              "New staff set their name the first time they sign in (it's required), so bookings and records always show who did what.",
          },
          {
            kind: "new",
            title: "Manage access",
            detail:
              "Change a teammate's role, deactivate or remove their access, or resend their sign-in link — all from the new Team page.",
          },
          {
            kind: "new",
            title: "Profiles & passwords",
            detail:
              "Each staff member has a profile page to update their name and, if they like, set a password to sign in directly instead of waiting for an email link.",
          },
        ],
      },
      {
        title: "Booking for customers",
        changes: [
          {
            kind: "new",
            title: "Book for a customer",
            detail:
              "Staff can now book a visit on behalf of a customer who calls in or walks up. Start from the Bookings page, enter the customer's details, and they get a link to review, sign, and pay — or you can confirm and collect it your way.",
          },
          {
            kind: "new",
            title: "Booked by",
            detail:
              "Every booking now records which staff member created it, so it's always clear who handled each reservation.",
          },
        ],
      },
      {
        title: "Waivers",
        changes: [
          {
            kind: "new",
            title: "Walk-in waiver kiosk",
            detail:
              "Each property has a sign-in-person link you can open on an iPad and hand to a walk-in guest. They read the property's waiver, enter their name + email, and sign — no booking required. After signing it resets for the next person, so it's easy to run at an event.",
          },
          {
            kind: "new",
            title: "Collect a booking's waiver on the spot",
            detail:
              "From a booking, staff can have the guest sign their waiver in person; it's attached to that booking and marks it signed.",
          },
          {
            kind: "new",
            title: "Waivers list",
            detail:
              "A new Waivers area to search signed waivers by name or email, open the signed PDF, and grab each property's kiosk link.",
          },
        ],
      },
      {
        title: "Polish",
        changes: [
          {
            kind: "improved",
            title: "Cleaner property settings",
            detail:
              "The property settings page is reorganized — pick a property from the tabs at the top, then edit its booking rules, home-page info, notifications, and pre-visit details in clearly labeled sections.",
          },
          {
            kind: "improved",
            title: "Faster photos",
            detail:
              "Adventure and trip images now load faster and are automatically optimized and sized for each device.",
          },
        ],
      },
    ],
  },
  {
    id: "patch-1",
    label: "Patch 1",
    title: "Member Adventures, trip sharing & smarter communications",
    date: "2026-06-04",
    summary:
      "A big update centered on Member Adventures — members can now discover, reserve, and pay for curated trips end-to-end — plus shareable trip links, password sign-in, and a wave of automatic emails that keep guests and staff in the loop.",
    sections: [
      {
        title: "Member Adventures",
        changes: [
          {
            kind: "new",
            title: "Browse & discover trips",
            detail:
              "Members can explore curated adventures from the homepage and a new Adventures page, then open a full trip page with photo galleries and chapter-by-chapter detail. Anyone can look; only members can sign up.",
          },
          {
            kind: "new",
            title: "Reserve & pay online",
            detail:
              "Reserve and pay in a few taps, with pricing that updates live as guests are added. Each trip can take full payment up front, a deposit (balance settled with the concierge), or run as a request-to-reserve inquiry.",
          },
          {
            kind: "new",
            title: "Held-spot countdown",
            detail:
              "Starting a reservation holds the spot with a live countdown. If checkout isn’t finished in time, the spot is automatically released for the next member — so a half-finished booking never blocks a real one.",
          },
          {
            kind: "new",
            title: "Waitlist",
            detail:
              "When a trip is full, members can join the waitlist and be emailed the moment a spot opens — first come, first served.",
          },
          {
            kind: "new",
            title: "Flexible cancellations & automatic refunds",
            detail:
              "Free cancellation up to a cutoff you set per trip, with refunds issued automatically. Cancelling always frees the spot for someone else.",
          },
          {
            kind: "new",
            title: "Guest list (manifest)",
            detail:
              "Members can name the guests in their party, so staff know exactly who’s arriving. Guest names appear on the trip roster and CSV export.",
          },
          {
            kind: "new",
            title: "Adventure management for staff",
            detail:
              "A new Adventures area in the admin portal to create and edit trips: rich descriptions, photo galleries, type-of-stay icons, pricing and capacity, a free-cancellation window, and a per-trip roster you can export to CSV. Trips stay in Draft (staff-only) until you publish them.",
          },
          {
            kind: "new",
            title: "Photo uploads",
            detail:
              "Upload trip photos straight from the editor. Images are automatically resized, compressed, and optimized so pages stay fast — with recommended sizes shown right in the form.",
          },
          {
            kind: "improved",
            title: "Homepage leads with adventures",
            detail:
              "The homepage now features Member Adventures front and center, in a full-width, editorial layout.",
          },
          {
            kind: "fixed",
            title: "Descriptions format correctly",
            detail:
              "Bulleted and numbered lists in adventure descriptions now display properly.",
          },
          {
            kind: "fixed",
            title: "Photos display upright",
            detail:
              "Uploaded photos now show with the correct orientation, regardless of how the camera saved them.",
          },
        ],
      },
      {
        title: "Trip sharing",
        changes: [
          {
            kind: "new",
            title: "Shareable trip links",
            detail:
              "Once a booking is finalized, members can generate a private link to share trip details — dates, location, what to bring, good-to-knows — with their whole party, even non-members. Pricing, payment, and personal details are never shown, and the link can be revoked anytime.",
          },
        ],
      },
      {
        title: "Member sign-in",
        changes: [
          {
            kind: "new",
            title: "Password sign-in",
            detail:
              "Members can set a password to sign in directly, in addition to the emailed magic link. The magic link still works and doubles as the recovery path.",
          },
        ],
      },
      {
        title: "Emails & notifications",
        changes: [
          {
            kind: "new",
            title: "Pre-trip reminders for guests",
            detail:
              "Guests automatically receive timed reminders in the run-up to their visit, with the key details for the day.",
          },
          {
            kind: "new",
            title: "Waiver-signed confirmation",
            detail:
              "An email confirms when a guest’s waiver has been received.",
          },
          {
            kind: "new",
            title: "Unsigned-bid reminders",
            detail:
              "Guests who haven’t signed their bid get a gentle nudge, and staff get a digest of what’s still outstanding.",
          },
          {
            kind: "new",
            title: "Bid-declined notice",
            detail:
              "If a bid is declined, the guest receives a courteous note.",
          },
          {
            kind: "new",
            title: "New-bid staff alert",
            detail:
              "Staff are notified the moment a new bid comes in, so nothing slips through.",
          },
        ],
      },
      {
        title: "Bids & templates",
        changes: [
          {
            kind: "new",
            title: "Reusable FAQ & gear templates",
            detail:
              "Build a library of FAQ answers and gear-list items that auto-fill onto new bids — scoped to every bid, or to a specific property, discipline, or booking type. Editing a template only affects future bids.",
          },
          {
            kind: "improved",
            title: "Bids dashboard",
            detail:
              "Cleaner bid filtering, clearer status signals, and tidied-up bid pages.",
          },
        ],
      },
      {
        title: "Admin tools",
        changes: [
          {
            kind: "new",
            title: "Members directory",
            detail:
              "A read-only directory of memberships and households, with each member’s people and bookings, for quick staff reference.",
          },
          {
            kind: "improved",
            title: "Bookings: filters & calendar",
            detail:
              "The admin bookings area gained filtering and a calendar / day-schedule view for seeing the day at a glance.",
          },
          {
            kind: "new",
            title: "Per-property settings",
            detail:
              "Add a map/directions link and a notifications email address for each property.",
          },
        ],
      },
    ],
  },
];

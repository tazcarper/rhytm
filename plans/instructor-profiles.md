# Instructor Profiles & Booking Selection

Status: 🔲 Planned (2026-06-07) · Tracker: App 14

## Context — why

Instructors are catalog rows that already carry `bio`, `photo_url`, `is_active`, and `display_order`, but **nothing guest-facing uses them**. A guest booking a private lesson today never sees who they'll be working with — `create_public_booking` silently auto-assigns "the first active instructor at the property." That's a missed trust/conversion moment: at a sporting club the instructor *is* the product.

This feature:
1. Gives admins a real **profile builder** for each instructor — photo upload + bio (+ active/order/availability), reusing the adventures image stack.
2. Adds a **public instructors page** so guests can read instructor backgrounds.
3. Adds an **instructor-selection step** to the private-lesson booking funnel — a visually rich, card-based list of available instructors (photo + bio) so guests choose *who* to book.

It builds directly on the instructor work already shipped (2026-06-07): the `instructors` schema, the `instructor_properties` multi-property availability junction, the property-aware booking RPCs, and the `/admin/instructors` admin surface (create + portal onboarding). See `plans/hazy-spinning-quokka` lineage / migrations `20260607120000–140000`.

## What already exists — reuse, don't rebuild

- **Schema is ready.** `instructors.bio`, `instructors.photo_url`, `is_active`, `display_order` all exist → **no column migration** for the profile fields.
- **`instructor_properties`** junction (public-read RLS) = the per-property availability set; `instructors` has a `public read active` policy. Contact PII (email/phone) lives in `instructor_portal_access` (private) — keep it there.
- **Image upload stack (from adventures) — fully reusable:**
  - Public bucket pattern — `supabase/migrations/20260604160000_adventure_image_bucket.sql` (public, 10 MB, image MIME allowlist, no `storage.objects` RLS → service-role writes).
  - Storage adapter — `lib/storage/adventure-image-storage.ts`.
  - Upload service (validation, 10 MB cap, MIME→ext, UUID path) — `src/services/admin/upload-adventure-image.ts`.
  - Upload action — `uploadAdventureImageAction` in `app/admin/adventures/actions.ts` (auth gate + FormData → service-role storage).
  - Browser file picker + WebP downscale — `src/components/admin/adventure-image-input.tsx` + `downscale-image.ts`.
  - Smart public renderer — `src/components/public/adventure-image.tsx` (`AdventureImage`); `next.config.ts` already allows the Supabase storage host `/storage/v1/object/public/**`.
- **Admin editor blueprint** — adventures: `app/admin/adventures/[id]/page.tsx`, `src/components/admin/adventure-editor-form.tsx`, `saveAdventureAction`, `getAdminAdventure`. Tailwind utility classes (`labelCls`/`inputCls`), `useTransition`, discriminated `{ ok }` results.
- **Booking funnel** — `src/components/public/booking-flow/booking-builder.tsx` (steps array + numeric `subStep`), `booking-flow-types.ts` (`instructorId` already in funnel state, currently always null), submit path `details-form.tsx → submitBookingAction → createPublicBooking → create_public_booking` (auto-assigns only when `instructorId` is null).
- **Public catalog service pattern** — `src/services/public/{services,properties,slots}.ts` (anon reads via public-read RLS, cookie-aware client).
- **Existing admin instructors surface to extend** — `app/admin/instructors/page.tsx`, `src/components/admin/{create-instructor-form,instructor-portal-list}.tsx`, `app/admin/instructors/actions.ts`, `src/services/admin/instructors.ts`.

## Phase A — Storage + admin profile editor

1. **Migration:** new public Storage bucket `instructor-photos` (mirror the adventure-images bucket: public, 10 MB, image MIME allowlist, no `storage.objects` policies).
2. **Upload stack (clone or generalize):**
   - Prefer **generalizing** the adventure adapter into one `lib/storage/public-image-storage.ts` taking a `bucketId` (DRY/SOLID), or clone to `lib/storage/instructor-photo-storage.ts`.
   - `src/services/admin/upload-instructor-photo.ts` (clone `upload-adventure-image.ts`; same validation).
   - `uploadInstructorPhotoAction` added to `app/admin/instructors/actions.ts` (mirror `uploadAdventureImageAction`; `hasAdminAccess` gate; service-role storage).
   - Reuse `AdventureImageInput` (single-image variant) + `downscale-image.ts` in the editor (or a thin `InstructorPhotoInput` wrapper).
3. **Profile editor:**
   - `getAdminInstructor(supabase, id)` added to `src/services/admin/instructors.ts` (one instructor + properties + portal/contact).
   - New route `app/admin/instructors/[id]/page.tsx` → renders the editor.
   - New `src/components/admin/instructor-profile-editor-form.tsx` (client; mirror `adventure-editor-form`): **name, bio (textarea), photo (upload), is_active (toggle), display_order, available-at properties (checkbox multiselect — reuse the create form's toggle)**. Tailwind classes.
   - `saveInstructorProfileAction` in `app/admin/instructors/actions.ts`: zod-validated, updates the `instructors` row + syncs `instructor_properties`, `revalidatePath`. Gate to super_admin/admin (+ property_manager for own property), consistent with the existing actions.
   - Add an **"Edit profile"** link per row in `instructor-portal-list.tsx` → `/admin/instructors/[id]`.

## Phase B — Public instructors page

1. **Service** `src/services/public/instructors.ts` → `getPublicInstructors(supabase)` (and/or `…ForProperty(propertyId)`): anon read of active `instructors` embedding `instructor_properties!inner ( properties ( name, slug ) )`, ordered by `display_order`. Returns `{ id, name, bio, photoUrl, properties[] }`. **Selects public columns only** (never the contact table).
2. **Page** `app/(public)/instructors/page.tsx` — index of instructor cards (photo via `AdventureImage`, name, bio, the properties they teach at), grouped/filterable by property. Mirror the `/adventures` index pattern (PageShell + public header); `export const dynamic = "force-dynamic"`.
3. **(Optional)** detail page `app/(public)/instructors/[id]/page.tsx` — full bio + photo + properties. Cards may suffice for v1.
4. Link from the public header / property pages ("Meet our instructors").

## Phase C — Booking funnel instructor selection (new UI)

1. **Make availability instructor-aware** (so a chosen instructor's slots are accurate, not "any instructor free"):
   - Migration: extend `get_slot_availability` with optional `p_instructor_id uuid DEFAULT NULL` — when set, the private-lesson EXISTS check pins to that instructor; when null, today's "any active instructor available at the property" behavior. (Reproduce the function with the added param; still junction-aware.)
   - Pass `instructorId` through `src/services/public/slots.ts` + the availability action.
2. **New funnel step "Instructor"** (private_lesson only):
   - `src/components/public/booking-flow/instructor-picker.tsx` — cards (photo, name, bio) of instructors available at the property (new public service), plus a **"No preference — we'll assign"** option. Selecting calls `setState({ instructorId })`.
   - Insert into the `booking-builder.tsx` steps array **conditionally** (after Guests, before When) when `bookingType === 'private_lesson'`; extend the numeric `subStep` nav to account for the conditional step.
   - Fetch the instructor list via the disciplines page server component or a small server action (like the availability action).
3. **Wire-through:** `instructorId` already flows state → `details-form` → `submitBookingAction` → `create_public_booking` (sets `p_instructor_id`; auto-assigns only when null). **No submit-path changes needed.** The exclusion constraint stays the final guard.

## Files (representative)

- Migrations: `…_instructor_photo_bucket.sql`, `…_slot_availability_by_instructor.sql`
- Storage/upload: `lib/storage/public-image-storage.ts` (generalized) or `…/instructor-photo-storage.ts`; `src/services/admin/upload-instructor-photo.ts`
- Admin: `app/admin/instructors/[id]/page.tsx`, `src/components/admin/instructor-profile-editor-form.tsx`; extend `app/admin/instructors/actions.ts` + `src/services/admin/instructors.ts`; link from `instructor-portal-list.tsx`
- Public page: `src/services/public/instructors.ts`, `app/(public)/instructors/page.tsx` (+ optional `[id]/page.tsx`)
- Funnel: `src/components/public/booking-flow/instructor-picker.tsx`; edits to `booking-builder.tsx`, `src/services/public/slots.ts`, the availability action

## Out of scope / notes

- No new instructor profile columns (bio/photo_url already exist).
- Per-instructor calendars/scheduling beyond the existing exclusion-constraint conflict check (deferred).
- Instructor self-service profile editing — admins manage profiles; instructors stay read-only in their gameplan portal.

## Verification

- **Admin:** upload a photo + write a bio → saved, photo renders; toggle active + reorder; edit availability properties.
- **Public:** `/instructors` lists active instructors with photos/bios grouped by property; inactive hidden; contact (email/phone) never exposed.
- **Booking:** private lesson at a property → Instructor step shows available instructors as cards + "no preference"; picking one → When step reflects *that* instructor's real availability; submit persists the chosen `bookings.instructor_id`; "no preference" auto-assigns.
- **RLS:** anon can read active instructor profiles + the junction; cannot read `instructor_portal_access`.
- `npm run typecheck`; apply migrations via `supabase db push` (file-based, not MCP).

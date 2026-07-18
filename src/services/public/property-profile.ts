import type { SupabaseClient } from "@supabase/supabase-js";
import { getPropertyProfile, type PropertyProfile } from "@/src/constants/public/property-profiles";
import { getPublicPropertyBySlug } from "./properties";
import { getPropertyPageSection } from "./property-page-content";

// Merges the admin-editable 'basics'/'layout' content (logo, footer logo,
// address, contact, office hours, social links, footer newsletter copy) over the
// hardcoded PROPERTY_PROFILES fallback — same "DB override, hardcoded
// default" pattern as every other property_page_content-backed section.
// Properties that haven't had their basics/layout touched in the admin
// (or that don't exist in PROPERTY_PROFILES at all yet, like Hog Heaven/
// Packsaddle before their own front-end migration) just get the fallback
// untouched.
export async function getResolvedPropertyProfile(
  supabase: SupabaseClient,
  slug: string,
): Promise<PropertyProfile | null> {
  const fallback = getPropertyProfile(slug);
  if (!fallback) return null;

  const { data: property } = await getPublicPropertyBySlug(supabase, slug);
  if (!property) return fallback;

  const [logo, footerLogo, address, contact, hours, social, footer] = await Promise.all([
    getPropertyPageSection(supabase, property.id, "basics", "logo"),
    getPropertyPageSection(supabase, property.id, "basics", "footer-logo"),
    getPropertyPageSection(supabase, property.id, "basics", "address"),
    getPropertyPageSection(supabase, property.id, "basics", "contact-info"),
    getPropertyPageSection(supabase, property.id, "basics", "office-hours"),
    getPropertyPageSection(supabase, property.id, "basics", "social-links"),
    getPropertyPageSection(supabase, property.id, "layout", "footer"),
  ]);

  const emailItem = contact?.items?.find((item) => item.title === "Email");
  const phoneItem = contact?.items?.find((item) => item.title === "Phone");
  const phone = phoneItem?.body || fallback.phone;
  const phoneHref = phoneItem?.body ? `+1${phoneItem.body.replace(/\D/g, "")}` : fallback.phoneHref;

  return {
    ...fallback,
    logoSrc: logo?.imageUrl || fallback.logoSrc,
    footerLogoSrc: footerLogo?.imageUrl || fallback.footerLogoSrc,
    addressLines: address?.body
      ? address.body.split("\n").map((line) => line.trim()).filter(Boolean)
      : fallback.addressLines,
    email: emailItem?.body || fallback.email,
    phone,
    phoneHref,
    officeHours: hours?.items?.length
      ? hours.items.map((item) => ({ label: item.title ?? "", hours: item.body ?? "" }))
      : fallback.officeHours,
    socialLinks: social?.items?.length
      ? social.items.map((item) => ({ label: item.title ?? "", href: item.linkHref ?? "" }))
      : fallback.socialLinks,
    newsletterHeading: footer?.heading || fallback.newsletterHeading,
    newsletterBlurb: footer?.body || fallback.newsletterBlurb,
  };
}

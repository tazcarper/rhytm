// Each club's own brand color — deliberately outside the admin app's own
// olive/tan palette. Used as the monogram-fallback background wherever a
// property's real logo hasn't been uploaded yet (the sidebar's Properties
// group, the properties workspace's top rail). One source of truth so the
// two surfaces can't drift apart.
export const PROPERTY_BRAND_TINTS: Record<string, string> = {
  "horseshoe-bay": "#3f6e32",
  "hog-heaven": "#b88240",
  packsaddle: "#325a8c",
};

export const DEFAULT_PROPERTY_BRAND_TINT = "#6b6b62";

export function getPropertyBrandTint(slug: string | undefined): string {
  return (slug && PROPERTY_BRAND_TINTS[slug]) || DEFAULT_PROPERTY_BRAND_TINT;
}

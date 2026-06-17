export interface PropertyEditorialCopy {
  locale: string;
  tagline: string;
}

export const PROPERTY_COPY: Record<string, PropertyEditorialCopy> = {
  "horseshoe-bay": {
    locale: "Texas Hill Country",
    tagline:
      "Clays, helice, and instruction on the lake — book a visit, a private lesson, or take the property for the day.",
  },
  "hog-heaven": {
    locale: "Dripping Springs, Texas",
    tagline:
      "Wing-shooting and wedding weekends on six hundred acres, paired with Camp Lucy when the occasion asks for it.",
  },
  "packsaddle": {
    locale: "Llano County",
    tagline:
      "Precision rifle, suppressed and unhurried — book coaching for marksmen who want range time without a crowd.",
  },
};

export const PROPERTY_COPY_FALLBACK: PropertyEditorialCopy = {
  locale: "—",
  tagline: "Choose this property to begin.",
};

const ORDINAL_NUMERALS = [
  "I", "II", "III", "IV", "V",
  "VI", "VII", "VIII", "IX", "X",
] as const;

export function propertyOrdinal(zeroBasedIndex: number): string {
  return ORDINAL_NUMERALS[zeroBasedIndex] ?? String(zeroBasedIndex + 1);
}

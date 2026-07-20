import { cn } from "@/lib/ui";

// The thin 2px accent divider that sits under a heading, one per
// section. See the .property-rule spec in src/styles/property-themes.css.
export function RuleDivider({ center = false }: { center?: boolean }) {
  return <div className={cn("property-rule", center && "property-rule-center")} aria-hidden />;
}

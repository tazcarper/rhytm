import Link from "next/link";

// The two lists on the Feature requests page, as links (?tab=…) so the
// page stays a server render and each tab has its own URL. A badge counts
// the items in each list that aren't done yet.

export type FeatureRequestTab = "features" | "fixes";

export const FEATURE_REQUEST_TABS: ReadonlyArray<{ key: FeatureRequestTab; label: string }> = [
  { key: "features", label: "New features" },
  { key: "fixes", label: "Problem fixes" },
];

export function isFeatureRequestTab(value: string | undefined): value is FeatureRequestTab {
  return FEATURE_REQUEST_TABS.some((tab) => tab.key === value);
}

export function FeatureRequestTabs({
  active,
  openCounts,
  basePath,
}: {
  active: FeatureRequestTab;
  openCounts: Readonly<Record<FeatureRequestTab, number>>;
  basePath: string;
}) {
  return (
    <nav aria-label="Feature request lists" className="mb-6 flex gap-8 border-b border-rule">
      {FEATURE_REQUEST_TABS.map((tab) => {
        const current = tab.key === active;
        const count = openCounts[tab.key];
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            aria-current={current ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-3 pt-1 text-body font-semibold no-underline transition-colors ${
              current ? "border-tan text-olive-darker" : "border-transparent text-gray hover:text-olive"
            }`}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums ${
                  current ? "bg-olive text-white" : "bg-paper-warm text-olive-darker"
                }`}
              >
                {count}
                <span className="sr-only"> not done</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

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

// Within each list: what's still being worked on, and what's finished
// (built, or declined). Pills under the main tabs, also links (?view=…).

export type FeatureRequestView = "active" | "done";

export const FEATURE_REQUEST_VIEWS: ReadonlyArray<{ key: FeatureRequestView; label: string }> = [
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
];

export function isFeatureRequestView(value: string | undefined): value is FeatureRequestView {
  return FEATURE_REQUEST_VIEWS.some((view) => view.key === value);
}

export function FeatureRequestViewTabs({
  tab,
  active,
  counts,
  basePath,
}: {
  tab: FeatureRequestTab;
  active: FeatureRequestView;
  counts: Readonly<Record<FeatureRequestView, number>>;
  basePath: string;
}) {
  return (
    <nav aria-label="Show active or done" className="mb-6 inline-flex gap-1 rounded-full border border-rule bg-white p-1">
      {FEATURE_REQUEST_VIEWS.map((view) => {
        const current = view.key === active;
        return (
          <Link
            key={view.key}
            href={`${basePath}?tab=${tab}&view=${view.key}`}
            aria-current={current ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold no-underline transition-colors ${
              current ? "bg-olive text-white" : "text-gray hover:bg-paper-warm hover:text-olive"
            }`}
          >
            {view.label}
            <span className={`tabular-nums text-[12px] ${current ? "text-white/80" : "text-gray"}`}>{counts[view.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import type {
  ReleaseChange,
  ReleaseChangeKind,
  ReleasePatch,
} from "@/src/constants/release-notes";
import s from "./release-notes.module.css";

// Presentational patch-notes list. Props in, JSX out. Each patch is broken
// into thematic sections (Member Adventures, Emails & notifications, …); each
// change carries a New / Improved / Fixed chip. Within a section, changes are
// ordered new → improved → fixed for consistency regardless of authoring.

const KIND_ORDER: ReleaseChangeKind[] = ["new", "improved", "fixed"];

const KIND_META: Record<ReleaseChangeKind, { label: string; chipClass: string }> = {
  new: { label: "New", chipClass: s.chipNew },
  improved: { label: "Improved", chipClass: s.chipImproved },
  fixed: { label: "Fixed", chipClass: s.chipFixed },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Construct in UTC to avoid an off-by-one from the local timezone.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function byKind(a: ReleaseChange, b: ReleaseChange): number {
  return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
}

export function ReleaseNotesView({ patches }: { patches: ReleasePatch[] }) {
  return (
    <div className={s.list}>
      {patches.map((patch) => (
        <article key={patch.id} className={s.patch} id={patch.id}>
          <header className={s.head}>
            <div className={s.meta}>
              <span className={s.label}>{patch.label}</span>
              <span className={s.date}>{formatDate(patch.date)}</span>
            </div>
            <h2 className={s.title}>{patch.title}</h2>
            <p className={s.summary}>{patch.summary}</p>
          </header>

          <div className={s.body}>
            {patch.sections.map((section) => (
              <section key={section.title} className={s.section}>
                <h3 className={s.sectionTitle}>{section.title}</h3>
                <ul className={s.items}>
                  {[...section.changes].sort(byKind).map((change, i) => (
                    <li key={i} className={s.item}>
                      <span className={`${s.chip} ${KIND_META[change.kind].chipClass}`}>
                        {KIND_META[change.kind].label}
                      </span>
                      <span>
                        <span className={s.itemTitle}>{change.title}</span>
                        {change.detail && (
                          <span className={s.itemDetail}>{change.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

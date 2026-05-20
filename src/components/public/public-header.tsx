import Link from "next/link";
import s from "./public-header.module.css";

// No auth affordances mid-funnel — login lives at /login, separately.
export function PublicHeader() {
  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link
          href="/book"
          className={s.brand}
          aria-label="Rhythm Outdoors — start a booking"
        >
          <span className={s.eyebrow}>Rhythm</span>
          <span className={s.wordmark}>Outdoors</span>
        </Link>
      </div>
    </header>
  );
}

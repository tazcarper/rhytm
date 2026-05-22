import Link from "next/link";
import s from "./admin-breadcrumb.module.css";

export interface AdminBreadcrumbSegment {
  label: string;
  /** Omit on the last segment to render it as the current location. */
  href?: string;
}

interface AdminBreadcrumbProps {
  segments: ReadonlyArray<AdminBreadcrumbSegment>;
  className?: string;
}

export function AdminBreadcrumb({ segments, className }: AdminBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={className ? `${s.crumbs} ${className}` : s.crumbs}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={`${segment.label}-${index}`} style={{ display: "contents" }}>
            {segment.href && !isLast ? (
              <Link href={segment.href} className={s.link}>
                {segment.label}
              </Link>
            ) : (
              <span
                className={isLast ? s.current : s.link}
                aria-current={isLast ? "page" : undefined}
              >
                {segment.label}
              </span>
            )}
            {!isLast && <span className={s.sep}>/</span>}
          </span>
        );
      })}
    </nav>
  );
}

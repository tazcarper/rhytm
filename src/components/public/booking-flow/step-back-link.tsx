import Link from "next/link";
import s from "./step-back-link.module.css";

interface StepBackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function StepBackLink({ href, label, className }: StepBackLinkProps) {
  return (
    <Link href={href} className={className ? `${s.back} ${className}` : s.back}>
      <span className={s.arrow} aria-hidden="true">
        ←
      </span>
      {label}
    </Link>
  );
}

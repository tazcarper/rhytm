import type { ReactNode } from "react";
import { PageShell } from "@/lib/ui";
import { StepBackLink } from "./step-back-link";
import s from "./step-page.module.css";

interface StepPageProps {
  width?: "narrow" | "wide";
  back?: { href: string; label: string };
  className?: string;
  children: ReactNode;
}

export function StepPage({
  width = "narrow",
  back,
  className,
  children,
}: StepPageProps) {
  return (
    <PageShell
      width={width}
      className={className ? `${s.shell} ${className}` : s.shell}
    >
      {back && <StepBackLink href={back.href} label={back.label} />}
      {children}
    </PageShell>
  );
}

export function StepPageHead({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <header className={className ? `${s.head} ${className}` : s.head}>
      {children}
    </header>
  );
}

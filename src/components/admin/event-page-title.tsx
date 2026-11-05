import type { ReactNode } from "react";
import f from "./event-flow.module.css";

// Page and section headings for the event pages, on the event-flow type
// scale (event-flow.module.css). The shared Heading primitive stays as it
// is on every other admin page.
export function EventPageTitle({ children }: { children: ReactNode }) {
  return <h1 className={f.pageTitle}>{children}</h1>;
}

export function EventPageSubhead({ children }: { children: ReactNode }) {
  return <h2 className={`${f.formTitle} mb-4`}>{children}</h2>;
}

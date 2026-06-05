import type { ReactNode } from "react";
import { Eyebrow, Heading } from "@/lib/ui";
import s from "../dev.module.css";

// Presentational frame for one dev-dashboard section: an optional eyebrow,
// a heading, an optional description, then the section's content. Extracted
// from the page so it's reused, not redefined inline.
export function DevSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className={s.sectionTitle}>
        {eyebrow && <Eyebrow as="div">{eyebrow}</Eyebrow>}
        <Heading level={2} size="h3" underline>
          {title}
        </Heading>
      </div>
      {description && <p className={s.sectionDescription}>{description}</p>}
      {children}
    </section>
  );
}

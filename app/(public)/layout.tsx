import type { ReactNode } from "react";
import { PublicHeader } from "@/src/components/public/public-header";

// proxy.ts allowlist excludes /book — anon visitors pass through.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Dims the page around its children (like an app tour) until the person
// clicks anywhere, presses Escape or "Got it". Dismissing also drops the URL
// parameter that turned it on, so a reload doesn't show it again.
export function Spotlight({
  active,
  clearParam,
  children,
}: {
  active: boolean;
  // Query parameter to remove from the URL when dismissed.
  clearParam?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dismiss = useCallback(() => {
    setOpen(false);
    if (clearParam && searchParams.has(clearParam)) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(clearParam);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [clearParam, pathname, router, searchParams]);

  useEffect(() => {
    if (!open) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    ref.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return <>{children}</>;

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-olive-darker/60 transition-opacity" onClick={dismiss} />
      <div
        ref={ref}
        tabIndex={-1}
        onClick={dismiss}
        className="relative z-50 rounded-[12px] shadow-[0_0_0_6px_rgba(255,255,255,0.9),0_12px_40px_rgba(0,0,0,0.35)] outline-none"
      >
        {children}
        <div className="absolute -bottom-12 right-0 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-[10px] bg-white px-4 py-2 text-[15px] font-semibold text-olive-darker shadow"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

// Counts down to a held-spot expiry (the pending_payment release window).
// Member-only UI — purely informational, the server sweep is the actual
// authority. Mount-gated (remaining stays null until the client ticks) so
// SSR and the client agree on first paint.
export function HoldCountdown({
  expiresAt,
  onExpire,
  prefix = "Spot held",
  className,
}: {
  expiresAt: string;
  onExpire?: () => void;
  prefix?: string;
  className?: string;
}) {
  const target = new Date(expiresAt).getTime();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => setRemainingMs(target - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [remainingMs, onExpire]);

  let text = prefix;
  if (remainingMs !== null) {
    if (remainingMs <= 0) {
      text = "Your hold has expired";
    } else {
      const totalSec = Math.ceil(remainingMs / 1000);
      const mm = Math.floor(totalSec / 60);
      const ss = totalSec % 60;
      text = `${prefix} · ${mm}:${String(ss).padStart(2, "0")}`;
    }
  }

  return (
    <span className={className} aria-live="polite">
      {text}
    </span>
  );
}

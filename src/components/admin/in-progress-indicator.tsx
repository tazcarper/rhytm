import { Hammer } from "lucide-react";

// "Being built" marker for a feature the developer is working on: a hammer
// that gently flashes. It holds still for people who ask for reduced motion.
export function InProgressIndicator({ size = 14 }: { size?: number }) {
  return (
    <Hammer
      aria-hidden="true"
      size={size}
      strokeWidth={2.4}
      className="shrink-0 motion-safe:animate-[pulse_1.4s_ease-in-out_infinite]"
    />
  );
}

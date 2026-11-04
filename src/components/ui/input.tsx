"use client";

import * as React from "react";

import { useFieldSize } from "./field";
import { cn } from "./utils";

// Inside a <Field>/<FieldGroup> the control takes the field's size, so a
// "lg" form gets tall 18px controls without repeating a prop on each one.
// Invalid styling comes from aria-invalid, which React Hook Form forms set.

const BASE =
  "flex w-full text-foreground transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50";

const BY_SIZE = {
  default:
    "h-9 rounded-md border border-input bg-paper px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[invalid=true]:border-accent-error",
  lg: "min-h-[54px] rounded-[10px] border-2 border-gray-light bg-white px-4 py-3 text-[18px] leading-snug text-olive-darker placeholder:text-gray hover:border-tan focus-visible:border-olive focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[rgba(63,74,33,0.35)] disabled:bg-paper-warm disabled:opacity-100 aria-[invalid=true]:border-accent-error",
} as const;

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const size = useFieldSize();
  return <input type={type} data-slot="input" className={cn(BASE, BY_SIZE[size], className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const size = useFieldSize();
  return (
    <textarea
      data-slot="textarea"
      className={cn(BASE, BY_SIZE[size], "h-auto resize-y", size === "lg" ? "min-h-[140px]" : "min-h-[80px]", className)}
      {...props}
    />
  );
}

// Native select styled to match. Swapped for the Radix-based shadcn Select
// where a custom list is worth it.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  const size = useFieldSize();
  return <select data-slot="native-select" className={cn(BASE, BY_SIZE[size], "cursor-pointer", className)} {...props} />;
}

export { Input, NativeSelect, Textarea };

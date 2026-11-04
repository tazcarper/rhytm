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
    "h-9 rounded-md border border-input bg-paper px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[invalid=true]:border-[#b3261e]",
  lg: "min-h-[54px] rounded-[10px] border-2 border-[#b9c4bd] bg-white px-4 py-3 text-[18px] leading-snug text-[#1c2420] placeholder:text-[#7a857f] hover:border-[#8f9c94] focus-visible:border-[#1f5b45] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[rgba(31,91,69,0.35)] disabled:bg-[#f3f5f2] disabled:opacity-100 aria-[invalid=true]:border-[#b3261e]",
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
